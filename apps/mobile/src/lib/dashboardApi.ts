import type { DashboardMine, DashboardSummary } from '@tayninh/shared';
import { apiFetch } from './api';

/** Báo cáo nhanh cá nhân (mobile nhóm 10) — GET /api/dashboard/mine. */
export function fetchMyDashboard(): Promise<DashboardMine> {
  return apiFetch<DashboardMine>('/api/dashboard/mine');
}

/**
 * Báo cáo toàn hệ thống (nhóm 10.1-10.12) — cùng dữ liệu với dashboard web.
 * TN-10 — truyền `wardId` (xã đang làm việc) để lấy `byHamlet`/`byStreet`
 * riêng của xã đó thay vì `byWard` gộp toàn tỉnh.
 */
export function fetchSystemDashboard(wardId?: string): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(
    `/api/dashboard/summary${wardId ? `?wardId=${encodeURIComponent(wardId)}` : ''}`,
  );
}
