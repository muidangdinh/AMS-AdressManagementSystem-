import type { CreateDepartmentRequest, Department, UpdateDepartmentRequest } from '@tayninh/shared';
import { apiFetch } from './api';

/** Danh mục phòng ban (`/api/departments` — tài khoản hệ thống có quyền user:manage). */
export const departmentsApi = {
  /** `wardId: 'province'` = chỉ phòng ban cấp tỉnh; `includeProvince` = kèm phòng ban cấp tỉnh khi lọc theo xã. */
  list: (params: { wardId?: string; includeProvince?: boolean; activeOnly?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.wardId) qs.set('wardId', params.wardId);
    if (params.includeProvince) qs.set('includeProvince', 'true');
    if (params.activeOnly) qs.set('activeOnly', 'true');
    return apiFetch<Department[]>(`/api/departments?${qs.toString()}`);
  },
  create: (dto: CreateDepartmentRequest) =>
    apiFetch<Department>('/api/departments', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateDepartmentRequest) =>
    apiFetch<Department>(`/api/departments/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/departments/${id}`, { method: 'DELETE' }),
};
