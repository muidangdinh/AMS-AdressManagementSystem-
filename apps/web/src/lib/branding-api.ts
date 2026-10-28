import type { AppConfig } from './app-config';
import { apiFetch } from './api';

export type BrandLogoKind = 'web' | 'app';

export const brandingApi = {
  upload(kind: BrandLogoKind, file: File): Promise<AppConfig> {
    const body = new FormData();
    body.append('file', file);
    return apiFetch<AppConfig>(`/api/app-config/branding/${kind}`, {
      method: 'PUT',
      body,
    });
  },

  reset(kind: BrandLogoKind): Promise<AppConfig> {
    return apiFetch<AppConfig>(`/api/app-config/branding/${kind}`, {
      method: 'DELETE',
    });
  },
};
