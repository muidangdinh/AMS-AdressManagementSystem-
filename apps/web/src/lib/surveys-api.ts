import type {
  AssignmentHouse,
  AssignmentStatus,
  CampaignStatus,
  CreateAssignmentRequest,
  CreateCampaignRequest,
  CreateSurveyRouteRequest,
  CreateZoneRequest,
  SurveyAssignment,
  SurveyCampaign,
  SurveyRoute,
  SurveyZone,
  RequestRevisitRequest,
  UpdateAssignmentRequest,
  UpdateCampaignRequest,
  UpdateSurveyRouteRequest,
  UpdateZoneRequest,
} from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 9 — client API cho khảo sát có tổ chức (đợt/phân vùng/nhiệm vụ). */
export const campaignsApi = {
  list: (status?: CampaignStatus) =>
    apiFetch<SurveyCampaign[]>(`/api/survey-campaigns${status ? `?status=${status}` : ''}`),
  get: (id: string) => apiFetch<SurveyCampaign>(`/api/survey-campaigns/${id}`),
  create: (dto: CreateCampaignRequest) =>
    apiFetch<SurveyCampaign>('/api/survey-campaigns', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateCampaignRequest) =>
    apiFetch<SurveyCampaign>(`/api/survey-campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  remove: (id: string) => apiFetch<void>(`/api/survey-campaigns/${id}`, { method: 'DELETE' }),
};

export const zonesApi = {
  create: (dto: CreateZoneRequest) =>
    apiFetch<SurveyZone>('/api/survey-zones', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateZoneRequest) =>
    apiFetch<SurveyZone>(`/api/survey-zones/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/survey-zones/${id}`, { method: 'DELETE' }),
  /** Tạo tuyến mới: vào kho tuyến chung và gắn luôn vào phân vùng. */
  createRoute: (zoneId: string, dto: CreateSurveyRouteRequest) =>
    apiFetch<SurveyRoute>(`/api/survey-zones/${zoneId}/routes`, { method: 'POST', body: JSON.stringify(dto) }),
  /** Chọn tuyến có sẵn trong kho vào phân vùng. */
  linkRoutes: (zoneId: string, routeIds: string[]) =>
    apiFetch<SurveyRoute[]>(`/api/survey-zones/${zoneId}/routes/link`, {
      method: 'POST',
      body: JSON.stringify({ routeIds }),
    }),
  /** Gỡ tuyến khỏi phân vùng; tuyến vẫn còn trong kho. */
  unlinkRoute: (zoneId: string, routeId: string) =>
    apiFetch<void>(`/api/survey-zones/${zoneId}/routes/${routeId}`, { method: 'DELETE' }),
};

/** Kho tuyến đường dùng chung (phân hệ "Quản lý tuyến đường"). */
export const routesApi = {
  list: (params: { zoneId?: string; campaignId?: string; wardId?: string; includeNoWard?: boolean; activeOnly?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.zoneId) qs.set('zoneId', params.zoneId);
    if (params.campaignId) qs.set('campaignId', params.campaignId);
    if (params.wardId) qs.set('wardId', params.wardId);
    if (params.includeNoWard) qs.set('includeNoWard', 'true');
    if (params.activeOnly) qs.set('activeOnly', 'true');
    return apiFetch<SurveyRoute[]>(`/api/survey-routes?${qs.toString()}`);
  },
  create: (dto: CreateSurveyRouteRequest) =>
    apiFetch<SurveyRoute>('/api/survey-routes', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateSurveyRouteRequest) =>
    apiFetch<SurveyRoute>(`/api/survey-routes/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  duplicate: (id: string) => apiFetch<SurveyRoute>(`/api/survey-routes/${id}/duplicate`, { method: 'POST' }),
  remove: (id: string) => apiFetch<void>(`/api/survey-routes/${id}`, { method: 'DELETE' }),
};

export const assignmentsApi = {
  /** Chi tiết kèm dòng thời gian (`events`) — Phase 11 Đợt 2. */
  get: (id: string) => apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}`),
  listSurveyors: () =>
    apiFetch<{ id: string; fullName: string; username: string }[]>(
      '/api/survey-assignments/surveyors',
    ),
  create: (dto: CreateAssignmentRequest) =>
    apiFetch<SurveyAssignment>('/api/survey-assignments', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  update: (id: string, dto: UpdateAssignmentRequest) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  remove: (id: string) => apiFetch<void>(`/api/survey-assignments/${id}`, { method: 'DELETE' }),
  /** Đổi người thực hiện — chỉ khi nhiệm vụ chưa bắt đầu. */
  reassign: (id: string, assigneeId: string) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId }),
    }),
  complete: (id: string) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/complete`, { method: 'POST' }),
  /** Phase 11 Đợt 2b — kèm danh sách nhà cần khảo sát lại (bỏ trống = khảo sát lại chung). */
  requestRevisit: (id: string, body: RequestRevisitRequest) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/request-revisit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Nhà của nhiệm vụ; `revisitOnly` = chỉ nhà còn cờ khảo sát lại. */
  listHouses: (id: string, revisitOnly = false) =>
    apiFetch<AssignmentHouse[]>(`/api/survey-assignments/${id}/houses${revisitOnly ? '?revisit=true' : ''}`),
  listMine: (status?: AssignmentStatus) =>
    apiFetch<SurveyAssignment[]>(
      `/api/survey-assignments?mine=true${status ? `&status=${status}` : ''}`,
    ),
};
