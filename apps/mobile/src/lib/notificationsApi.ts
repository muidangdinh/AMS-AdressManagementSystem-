import type { AppNotification } from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 11 — thông báo trong app (lấy bằng polling; chưa có push khi app đóng). */
export function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>(`/api/notifications?limit=${limit}`);
}

export function fetchUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/api/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/api/notifications/read-all', { method: 'POST' });
}
