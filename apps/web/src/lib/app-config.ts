import { apiFetch } from './api';

/** Trả về của `GET /api/app-config` (TN-02) — công khai, không cần đăng nhập. */
export interface AppConfig {
  provinceName: string;
  appShortName: string;
}

/** TN-21 — tên tỉnh dùng cho địa chỉ đầy đủ 5 cấp ở ngăn chi tiết hồ sơ. */
export function fetchAppConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/app-config');
}
