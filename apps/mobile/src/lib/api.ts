import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthTokens } from '@tayninh/shared';

// Đổi thành IP LAN của máy chạy backend khi test trên điện thoại thật/emulator
// (Android emulator dùng 10.0.2.2 để trỏ về localhost máy host; iOS simulator
// dùng thẳng localhost). Xem README.md phần "Cấu hình API_URL".
// TẠM THỜI cho test qua USB (adb reverse tcp:3001 tcp:3001) — đổi lại
// 'https://rv.librasoft.vn' khi build bản thật/không còn cắm dây debug.
// export const API_URL = 'http://localhost:4002';
export const API_URL = 'https://ams.librasoft.vn';//Thạnh Hóa 
// export const API_URL = 'https://myan.amstn.vn';//Mỹ An
// export const API_URL = 'https://tanan.amstn.vn';//Tân An
// export const API_URL = ' http://10.0.2.2:3001';


const TOKEN_KEY = 'tayninh_token';
const REFRESH_TOKEN_KEY = 'tayninh_refresh_token';
const USER_KEY = 'tayninh_user';
/** Các route tự xử lý 401 của mình: 401 ở đây không có nghĩa access token hết hạn. */
const NO_REFRESH_PATHS = new Set(['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']);

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
  ]);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
}

let unauthorizedHandler: (() => void) | null = null;

/** AuthProvider đăng ký để đưa người dùng về màn đăng nhập khi phiên không thể làm mới. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function getStoredUser<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setStoredUser(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
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
 * `false` = phiên đã chết (không có token, hoặc server từ chối). Lỗi mạng/5xx được ném ra để cán bộ ở
 * vùng sóng yếu KHÔNG bị đăng xuất; hồ sơ nháp vẫn nằm trên máy và đồng bộ lại sau.
 */
function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 400 || res.status === 401) return false;
    if (!res.ok) throw await toApiError(res);
    await setTokens((await res.json()) as AuthTokens);
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

/**
 * Fetch wrapper: tự đính JWT, gặp 401 thì làm mới token và gửi lại đúng 1 lần, ném ApiError khi thất bại.
 * Không làm mới được thì xóa phiên để về màn hình Login — cùng cơ chế với web (apps/web/src/lib/api.ts).
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  let res = await send(path, options, token);

  if (res.status === 401 && token && !NO_REFRESH_PATHS.has(path)) {
    // Request song song có thể đã làm mới xong trong lúc request này chạy.
    const current = await getToken();
    const hasNewToken = !!current && current !== token;
    if (hasNewToken || (await refreshTokens())) {
      res = await send(path, options, await getToken());
    } else {
      await clearToken();
      unauthorizedHandler?.();
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
