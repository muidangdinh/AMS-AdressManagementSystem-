import type { CreateUserRequest, UpdateUserRequest, UserSummary } from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Client API quản lý tài khoản (`/api/users` — chỉ ADMIN). Dùng ở trang
 * `/houses/users` để tạo cán bộ khảo sát/địa chính trên server mà không cần
 * gọi API thủ công.
 */
export const usersApi = {
  list: () => apiFetch<UserSummary[]>('/api/users'),
  create: (dto: CreateUserRequest) =>
    apiFetch<UserSummary>('/api/users', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateUserRequest) =>
    apiFetch<UserSummary>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
};
