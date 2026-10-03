import type {
  AssignmentHouse,
  AssignmentIssueKind,
  AssignmentStatus,
  HouseSummary,
  NearbyHouseItem,
  OwnerSearchResult,
  ResurveyHouseRequest,
  SurveyAssignment,
} from '@tayninh/shared';
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

/**
 * Phase 11 Đợt 2 — báo vấn đề hiện trường (`ISSUE`) hoặc xin hỗ trợ (`HELP`) tới người giao việc.
 * Không đổi trạng thái nhiệm vụ. Trả về nhiệm vụ kèm dòng thời gian (`events`).
 */
export function reportAssignmentIssue(
  id: string,
  kind: AssignmentIssueKind,
  note: string,
): Promise<SurveyAssignment> {
  return apiFetch<SurveyAssignment>(`/api/survey-assignments/${id}/issues`, {
    method: 'POST',
    body: JSON.stringify({ kind, note }),
  });
}

/**
 * Phase 11 Đợt 2b — nhà của nhiệm vụ. `revisitOnly` = chỉ các nhà còn cờ "cần khảo sát lại".
 * Cán bộ khảo sát chỉ xem được nhiệm vụ của chính mình.
 */
export function fetchAssignmentHouses(id: string, revisitOnly = false): Promise<AssignmentHouse[]> {
  return apiFetch<AssignmentHouse[]>(`/api/survey-assignments/${id}/houses${revisitOnly ? '?revisit=true' : ''}`);
}

/** Chi tiết 1 nhà (điền sẵn form khi sửa lại) — cần có mạng. */
/** Nhà quanh một toạ độ (PostGIS) — sắp gần → xa. Dùng cho thẻ "Chủ hộ gần bạn" ở form khảo sát. */
export function fetchNearbyHouses(
  lat: number,
  lng: number,
  radius: number,
  limit: number,
  signal?: AbortSignal,
): Promise<NearbyHouseItem[]> {
  return apiFetch<NearbyHouseItem[]>(
    `/api/houses/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`,
    { signal },
  );
}

/**
 * Gợi ý chủ hộ theo tên hoặc SĐT (không dấu) cho form khảo sát — GET /api/houses/owners.
 * Hủy được bằng AbortSignal khi người dùng gõ tiếp.
 */
export function searchOwners(q: string, signal?: AbortSignal): Promise<OwnerSearchResult[]> {
  return apiFetch<OwnerSearchResult[]>(`/api/houses/owners?q=${encodeURIComponent(q)}`, { signal });
}

export function fetchHouse(id: string): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}`);
}

/**
 * Sửa lại đúng nhà bị yêu cầu khảo sát lại (thay vì tạo nhà mới trùng). Chỉ được khi nhà đang có cờ, thuộc
 * nhiệm vụ của mình và nhiệm vụ đang thực hiện; sửa xong server tự xoá cờ. Cần có mạng.
 */
export function resurveyHouse(id: string, body: ResurveyHouseRequest): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}/resurvey`, { method: 'POST', body: JSON.stringify(body) });
}
