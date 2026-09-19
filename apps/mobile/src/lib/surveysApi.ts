import type { AssignmentStatus, SurveyAssignment } from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Phase 9 — nhiệm vụ khảo sát (mobile nhóm 9: quản lý nhiệm vụ). Chỉ cần đọc
 * "nhiệm vụ của tôi" + 2 hành động tự thân (bắt đầu/gửi duyệt) — giao việc/
 * duyệt là thao tác quản trị, làm ở web (`/houses/surveys`).
 */
export function fetchMyAssignments(status?: AssignmentStatus): Promise<SurveyAssignment[]> {
  return apiFetch<SurveyAssignment[]>(
    `/api/survey-assignments?mine=true${status ? `&status=${status}` : ''}`,
  );
}

export function getAssignment(id: string): Promise<SurveyAssignment> {
  return apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}`);
}

export function startAssignment(id: string): Promise<SurveyAssignment> {
  return apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/start`, { method: 'POST' });
}

export function submitAssignment(id: string): Promise<SurveyAssignment> {
  return apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/submit`, { method: 'POST' });
}
