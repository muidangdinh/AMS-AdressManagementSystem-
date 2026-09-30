import type { AppNotification, RemindRequest } from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 11 — client API cho thông báo trong app (/api/notifications). */
export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number; before?: string }) => {
    const qs = new URLSearchParams();
    if (params?.unreadOnly) qs.set('unreadOnly', 'true');
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.before) qs.set('before', params.before);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<AppNotification[]>(`/api/notifications${suffix}`);
  },
  unreadCount: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: string) => apiFetch<{ ok: true }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => apiFetch<{ updated: number }>('/api/notifications/read-all', { method: 'POST' }),
  remind: (dto: RemindRequest) =>
    apiFetch<{ ok: true }>('/api/notifications/remind', { method: 'POST', body: JSON.stringify(dto) }),
};
