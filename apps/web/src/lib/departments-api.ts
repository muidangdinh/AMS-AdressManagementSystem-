import type { CreateDepartmentRequest, Department, UpdateDepartmentRequest } from '@tayninh/shared';
import { apiFetch } from './api';

/** Danh mục phòng ban (`/api/departments` — tài khoản hệ thống có quyền user:manage). */
export const departmentsApi = {
  /** `level: 'UNSET'` = phòng ban cấp tỉnh cũ chưa phân cấp; `wardId` gồm cả phòng ban các ấp của xã đó. */
  list: (
    params: { level?: 'WARD' | 'HAMLET' | 'UNSET'; wardId?: string; hamletId?: string; activeOnly?: boolean } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.level) qs.set('level', params.level);
    if (params.wardId) qs.set('wardId', params.wardId);
    if (params.hamletId) qs.set('hamletId', params.hamletId);
    if (params.activeOnly) qs.set('activeOnly', 'true');
    return apiFetch<Department[]>(`/api/departments?${qs.toString()}`);
  },
  create: (dto: CreateDepartmentRequest) =>
    apiFetch<Department>('/api/departments', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateDepartmentRequest) =>
    apiFetch<Department>(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/departments/${id}`, { method: 'DELETE' }),
};
