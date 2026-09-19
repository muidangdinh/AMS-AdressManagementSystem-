import { apiFetch } from './api';

/** Trả về của `GET /api/app-config` (TN-02) — công khai, không cần đăng nhập. */
export interface AppConfig {
  provinceName: string;
  appShortName: string;
}

/**
 * TN-11 — hằng số toàn hệ thống (tên tỉnh, tên viết tắt ứng dụng "AMS") cho
 * màn Đăng nhập (góp ý khách hàng 11/09/2026). Route công khai
 * (`@Public()` ở API) nên gọi được trước khi có token.
 */
export function fetchAppConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/app-config');
}
