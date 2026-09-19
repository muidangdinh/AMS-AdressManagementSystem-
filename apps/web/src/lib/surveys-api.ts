import type {
  AssignmentStatus,
  CampaignStatus,
  CreateAssignmentRequest,
  CreateCampaignRequest,
  CreateZoneRequest,
  SurveyAssignment,
  SurveyCampaign,
  SurveyZone,
  UpdateAssignmentRequest,
  UpdateCampaignRequest,
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
};

export const assignmentsApi = {
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
  complete: (id: string) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/complete`, { method: 'POST' }),
  requestRevisit: (id: string, reviewNote: string) =>
    apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/request-revisit`, {
      method: 'POST',
      body: JSON.stringify({ reviewNote }),
    }),
  listMine: (status?: AssignmentStatus) =>
    apiFetch<SurveyAssignment[]>(
      `/api/survey-assignments?mine=true${status ? `&status=${status}` : ''}`,
    ),
};
