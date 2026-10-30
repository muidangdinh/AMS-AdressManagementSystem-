import type { AppConfig } from './app-config';
import { apiFetch } from './api';

export interface UpdateMapSettingsRequest {
  hidePoi?: boolean;
}

export const mapSettingsApi = {
  update(body: UpdateMapSettingsRequest): Promise<AppConfig> {
    return apiFetch<AppConfig>('/api/app-config/map', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
