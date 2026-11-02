import type { AuthTokens } from '@tayninh/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'tayninh_token';
const REFRESH_TOKEN_KEY = 'tayninh_refresh_token';
/** Các route tự xử lý 401 của mình: 401 ở đây không có nghĩa access token hết hạn. */
const NO_REFRESH_PATHS = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']);

export function getApiUrl() {
  return API_URL;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens) {
  window.localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let unauthorizedHandler: (() => void) | null = null;

/** AuthProvider đăng ký để đưa người dùng về trang đăng nhập khi phiên không thể làm mới. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    message = body.message ?? message;
  } catch {
    // ignore: body không phải JSON
  }
  return new ApiError(res.status, message);
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Đổi refresh token lấy cặp token mới; nhiều request cùng gặp 401 chỉ gọi 1 lần.
 * `false` = phiên đã chết (không có token, hoặc server từ chối). Lỗi mạng/5xx được ném ra để KHÔNG đăng
 * xuất người dùng chỉ vì mất kết nối tạm thời.
 */
function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 400 || res.status === 401) return false;
    if (!res.ok) throw await toApiError(res);
    setTokens((await res.json()) as AuthTokens);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function send(path: string, options: RequestInit, token: string | null) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

/** Gửi request kèm JWT; gặp 401 thì làm mới token và gửi lại đúng 1 lần. */
async function authorizedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await send(path, options, token);
  if (res.status !== 401 || !token || NO_REFRESH_PATHS.has(path)) return res;

  // Tab khác hoặc request song song có thể đã làm mới xong trong lúc request này chạy.
  const current = getToken();
  const hasNewToken = !!current && current !== token;
  if (hasNewToken || (await refreshTokens())) return send(path, options, getToken());

  clearToken();
  unauthorizedHandler?.();
  return res;
}

/** Fetch wrapper: tự đính kèm JWT, tự làm mới phiên khi token hết hạn, ném ApiError khi thất bại. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authorizedFetch(path, options);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Như `apiFetch` nhưng trả Blob — dùng cho tệp cần JWT (không phải URL static). */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await authorizedFetch(path);
  if (!res.ok) throw await toApiError(res);
  return res.blob();
}
