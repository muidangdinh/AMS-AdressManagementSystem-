import { apiFetch } from './api';

/** Trả về của `GET /api/app-config` (TN-02) — công khai, không cần đăng nhập. */
export interface AppConfig {
  provinceName: string;
  appShortName: string;
  appLogoUrl: string | null;
  /** Ẩn lớp icon địa điểm của nền bản đồ (giống tuỳ chọn bên web). */
  mapHidePoi: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  provinceName: 'Tỉnh Tây Ninh',
  appShortName: 'AMS',
  appLogoUrl: null,
  mapHidePoi: true,
};

let cachedConfig: AppConfig | null = null;
let inflight: Promise<AppConfig> | null = null;

/** Cấu hình đã tải trong phiên hiện tại — dùng để render logo ngay, không chờ API. */
export function getCachedAppConfig(): AppConfig | null {
  return cachedConfig;
}

/**
 * TN-11 — tải cấu hình toàn hệ thống. Mặc định dùng cache; `force` để làm mới khi app
 * quay lại foreground. Các lời gọi song song dùng chung một request.
 */
export function fetchAppConfig(force = false): Promise<AppConfig> {
  if (!force && cachedConfig) return Promise.resolve(cachedConfig);
  if (inflight) return inflight;

  inflight = apiFetch<AppConfig>('/api/app-config')
    .then((config) => {
      cachedConfig = {
        ...DEFAULT_APP_CONFIG,
        ...config,
        mapHidePoi: config.mapHidePoi ?? DEFAULT_APP_CONFIG.mapHidePoi,
      };
      return cachedConfig;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
