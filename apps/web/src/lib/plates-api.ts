import type { HousePlate, IssuePlateRequest, PlateStatus } from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 8 — client API cho biển số nhà (/api/house-plates). */
export const platesApi = {
  listForHouse: (houseId: string) =>
    apiFetch<HousePlate[]>(`/api/house-plates?houseId=${houseId}`),
  list: (params?: { status?: PlateStatus; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<HousePlate[]>(`/api/house-plates${suffix}`);
  },
  issue: (dto: IssuePlateRequest) =>
    apiFetch<HousePlate>('/api/house-plates', { method: 'POST', body: JSON.stringify(dto) }),
  revoke: (id: string, reason: string) =>
    apiFetch<HousePlate>(`/api/house-plates/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  install: (id: string) =>
    apiFetch<HousePlate>(`/api/house-plates/${id}/install`, { method: 'POST' }),
};
