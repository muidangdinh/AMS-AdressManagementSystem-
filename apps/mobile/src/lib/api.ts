import AsyncStorage from '@react-native-async-storage/async-storage';

// Đổi thành IP LAN của máy chạy backend khi test trên điện thoại thật/emulator
// (Android emulator dùng 10.0.2.2 để trỏ về localhost máy host; iOS simulator
// dùng thẳng localhost). Xem README.md phần "Cấu hình API_URL".
// TẠM THỜI cho test qua USB (adb reverse tcp:3001 tcp:3001) — đổi lại
// 'https://rv.librasoft.vn' khi build bản thật/không còn cắm dây debug.
export const API_URL = 'http://localhost:4002';
// export const API_URL = 'https://rv.librasoft.vn';
// export const API_URL = ' http://10.0.2.2:3001';


const TOKEN_KEY = 'tayninh_token';
const USER_KEY = 'tayninh_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
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

/**
 * Fetch wrapper: tự đính JWT (nếu có), ném ApiError khi thất bại.
 * 401 (token hết hạn/bị thu hồi) sẽ xóa token cũ để màn hình Login biết
 * mà yêu cầu đăng nhập lại — giống hệt cơ chế bên web (apps/web/src/lib/api.ts).
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) await clearToken();
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // ignore: body không phải JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
