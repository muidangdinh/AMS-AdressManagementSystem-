import type {
  CaseStatus,
  CreateCaseRequest,
  HouseCase,
  PublicHouseSummary,
  UpdateCaseRequest,
} from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 10 — client API cho hồ sơ – quy trình (/api/house-cases). */
export const casesApi = {
  listStaff: () =>
    apiFetch<{ id: string; fullName: string; username: string }[]>('/api/house-cases/staff'),
  list: (params?: { status?: CaseStatus; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<HouseCase[]>(`/api/house-cases${suffix}`);
  },
  get: (id: string) => apiFetch<HouseCase>(`/api/house-cases/${id}`),
  create: (dto: CreateCaseRequest) =>
    apiFetch<HouseCase>('/api/house-cases', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateCaseRequest) =>
    apiFetch<HouseCase>(`/api/house-cases/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  assign: (id: string, assignedToId: string) =>
    apiFetch<HouseCase>(`/api/house-cases/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedToId }),
    }),
  linkHouse: (id: string, houseId: string) =>
    apiFetch<HouseCase>(`/api/house-cases/${id}/link-house`, {
      method: 'POST',
      body: JSON.stringify({ houseId }),
    }),
  advance: (id: string) => apiFetch<HouseCase>(`/api/house-cases/${id}/advance`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    apiFetch<HouseCase>(`/api/house-cases/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  reopen: (id: string) => apiFetch<HouseCase>(`/api/house-cases/${id}/reopen`, { method: 'POST' }),
  addNote: (id: string, note: string) =>
    apiFetch<HouseCase>(`/api/house-cases/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
};

/** Tra cứu công khai bằng QR — không cần token. */
export function fetchPublicHouse(houseId: string) {
  return apiFetch<PublicHouseSummary>(`/api/houses/${houseId}/public`);
}
