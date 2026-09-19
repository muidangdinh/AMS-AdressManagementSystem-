import type { DashboardSummary, HouseSummary, PaginatedResult } from '@tayninh/shared';
import { apiFetch } from './api';

const SEARCH_PAGE_SIZE = 20;

/** Dashboard tổng quan (nhóm 1) — client API cho `/api/dashboard`. */
export const dashboardApi = {
  summary: () => apiFetch<DashboardSummary>('/api/dashboard/summary'),
  /** Tìm nhanh theo tên đường/chủ hộ/SĐT/CCCD + lọc theo ấp — dùng cho ô tìm kiếm trên dashboard. */
  searchHouses: (params: { search?: string; hamletId?: string }, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    qs.set('pageSize', String(SEARCH_PAGE_SIZE));
    if (params.search) qs.set('search', params.search);
    if (params.hamletId) qs.set('hamletId', params.hamletId);
    return apiFetch<PaginatedResult<HouseSummary>>(`/api/houses?${qs.toString()}`, { signal });
  },
};
