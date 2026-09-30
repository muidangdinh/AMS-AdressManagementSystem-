import type {
  CreateRoleRequest,
  PermissionDef,
  RoleSummary,
  SetPermissionsRequest,
  UpdateRoleRequest,
} from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * PHASE 17 — Client API quản trị vai trò động + danh mục quyền
 * (`/api/roles`, `/api/permissions` — cần quyền role:manage).
 */
export const rolesApi = {
  list: () => apiFetch<RoleSummary[]>('/api/roles'),
  get: (id: string) => apiFetch<RoleSummary>(`/api/roles/${id}`),
  create: (dto: CreateRoleRequest) =>
    apiFetch<RoleSummary>('/api/roles', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateRoleRequest) =>
    apiFetch<RoleSummary>(`/api/roles/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' }),
  setPermissions: (id: string, dto: SetPermissionsRequest) =>
    apiFetch<RoleSummary>(`/api/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  listPermissions: () => apiFetch<PermissionDef[]>('/api/permissions'),
};
