import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_APP_CONFIG, fetchAppConfig, getCachedAppConfig } from './appConfig';
import type { AppConfig } from './appConfig';

interface AppConfigContextValue {
  config: AppConfig;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

/**
 * Giữ cấu hình (logo, tên tỉnh...) ở một chỗ duy nhất. Nhờ vậy header các tab dùng
 * chung logo đã tải, không mỗi tab lại gọi API và nháy logo mặc định.
 */
export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => getCachedAppConfig() ?? DEFAULT_APP_CONFIG);
  const [isLoading, setIsLoading] = useState(() => !getCachedAppConfig());

  const refresh = useCallback(async () => {
    try {
      setConfig(await fetchAppConfig(true));
    } catch {
      // Giữ cấu hình hiện tại; lần mở app sau sẽ thử lại.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => undefined);
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <AppConfigContext.Provider value={{ config, isLoading, refresh }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const value = useContext(AppConfigContext);
  if (!value) throw new Error('useAppConfig phải dùng trong <AppConfigProvider>');
  return value;
}
