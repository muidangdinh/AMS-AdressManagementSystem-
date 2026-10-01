import type {
  CampaignStatus,
  CreateInstallAssignmentRequest,
  CreateInstallCampaignRequest,
  CreateInstallZoneRequest,
  InstallAssignment,
  InstallCampaign,
  InstallPlateItem,
  InstallZone,
  RequestInstallRevisitRequest,
  UpdateInstallAssignmentRequest,
  UpdateInstallCampaignRequest,
  UpdateInstallZoneRequest,
  AssignmentStatus,
} from '@tayninh/shared';
import { apiFetch } from './api';

/** Thi công gắn biển (tương tự khảo sát) — client API cho /api/install-*. */
export const installCampaignsApi = {
  list: (status?: CampaignStatus) =>
    apiFetch<InstallCampaign[]>(`/api/install-campaigns${status ? `?status=${status}` : ''}`),
  get: (id: string) => apiFetch<InstallCampaign>(`/api/install-campaigns/${id}`),
  create: (dto: CreateInstallCampaignRequest) =>
    apiFetch<InstallCampaign>('/api/install-campaigns', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateInstallCampaignRequest) =>
    apiFetch<InstallCampaign>(`/api/install-campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/install-campaigns/${id}`, { method: 'DELETE' }),
};

export const installZonesApi = {
  create: (dto: CreateInstallZoneRequest) =>
    apiFetch<InstallZone>('/api/install-zones', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateInstallZoneRequest) =>
    apiFetch<InstallZone>(`/api/install-zones/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/install-zones/${id}`, { method: 'DELETE' }),
};

export const installAssignmentsApi = {
  list: (params: { campaignId?: string; status?: AssignmentStatus; mine?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.campaignId) qs.set('campaignId', params.campaignId);
    if (params.status) qs.set('status', params.status);
    if (params.mine) qs.set('mine', 'true');
    return apiFetch<InstallAssignment[]>(`/api/install-assignments?${qs.toString()}`);
  },
  /** Chi tiết kèm dòng thời gian (`events`). */
  get: (id: string) => apiFetch<InstallAssignment>(`/api/install-assignments/${id}`),
  /** Danh sách biển của nhiệm vụ (kèm thông tin nhà) — vẽ lên bản đồ và danh sách. */
  plates: (id: string) => apiFetch<InstallPlateItem[]>(`/api/install-assignments/${id}/plates`),
  /** Cán bộ có quyền thực hiện thi công — để chọn người giao việc. */
  listInstallers: () =>
    apiFetch<{ id: string; fullName: string; username: string }[]>('/api/install-assignments/installers'),
  create: (dto: CreateInstallAssignmentRequest) =>
    apiFetch<InstallAssignment>('/api/install-assignments', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateInstallAssignmentRequest) =>
    apiFetch<InstallAssignment>(`/api/install-assignments/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  reassign: (id: string, assigneeId: string) =>
    apiFetch<InstallAssignment>(`/api/install-assignments/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId }),
    }),
  /** Bổ sung biển mới cấp trong phạm vi vào nhiệm vụ đang mở. */
  refreshPlates: (id: string) =>
    apiFetch<{ added: number }>(`/api/install-assignments/${id}/refresh-plates`, { method: 'POST' }),
  remove: (id: string) => apiFetch<void>(`/api/install-assignments/${id}`, { method: 'DELETE' }),
  complete: (id: string) =>
    apiFetch<InstallAssignment>(`/api/install-assignments/${id}/complete`, { method: 'POST' }),
  requestRevisit: (id: string, body: RequestInstallRevisitRequest) =>
    apiFetch<InstallAssignment>(`/api/install-assignments/${id}/request-revisit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
