'use client';

import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface AppConfig {
  provinceName: string;
  appShortName: string;
  webLogoLightUrl: string | null;
  webLogoDarkUrl: string | null;
  appLogoUrl: string | null;
  /** Ẩn lớp icon địa điểm (nhà hàng, cửa hàng…) của nền bản đồ — Hệ thống → Cấu hình bản đồ. */
  mapHidePoi: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  provinceName: 'Tỉnh Tây Ninh',
  appShortName: 'AMS',
  webLogoLightUrl: null,
  webLogoDarkUrl: null,
  appLogoUrl: null,
  // Giống mặc định phía API — tránh icon địa điểm hiện chớp lên rồi mới ẩn lúc tải trang.
  mapHidePoi: true,
};

export function fetchAppConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/app-config');
}

interface AppConfigContextValue {
  config: AppConfig;
  refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchAppConfig();
      setConfig({
        ...DEFAULT_CONFIG,
        ...next,
        webLogoLightUrl: next.webLogoLightUrl ?? null,
        webLogoDarkUrl: next.webLogoDarkUrl ?? null,
        appLogoUrl: next.appLogoUrl ?? null,
        mapHidePoi: next.mapHidePoi ?? DEFAULT_CONFIG.mapHidePoi,
      });
    } catch {
      // Giữ logo mặc định khi API chưa sẵn sàng.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AppConfigContext.Provider value={{ config, refresh }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const value = useContext(AppConfigContext);
  if (!value) throw new Error('useAppConfig phải dùng trong AppConfigProvider');
  return value;
}
