import { PhotoType } from '@tayninh/shared';
import type {
  AssignmentHouse,
  AssignmentIssueKind,
  AssignmentStatus,
  CreateHouseRequest,
  HouseSummary,
  NearbyHouseItem,
  OwnerSearchResult,
  ResurveyHouseRequest,
  SurveyAssignment,
} from '@tayninh/shared';
import { apiFetch } from './api';

export const ROUTE_WARN_DISTANCE_M = 200;
export const MAX_PHOTOS = 5;
export const MAX_REQUIRED_PHOTOS = 2;

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

export function fetchAssignmentHouses(id: string, revisitOnly = false): Promise<AssignmentHouse[]> {
  return apiFetch<AssignmentHouse[]>(
    `/api/survey-assignments/${id}/houses${revisitOnly ? '?revisit=true' : ''}`,
  );
}

export function fetchHouse(id: string): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}`);
}

export function fetchStreetSuggestions(wardId?: string): Promise<string[]> {
  return apiFetch<string[]>(
    `/api/houses/street-suggestions${wardId ? `?wardId=${encodeURIComponent(wardId)}` : ''}`,
  );
}

export function searchOwners(q: string, signal?: AbortSignal): Promise<OwnerSearchResult[]> {
  return apiFetch<OwnerSearchResult[]>(`/api/houses/owners?q=${encodeURIComponent(q)}`, { signal });
}

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

export function createHouse(body: CreateHouseRequest): Promise<HouseSummary> {
  return apiFetch<HouseSummary>('/api/houses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateHouseNumber(id: string, houseNumber: string): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}/number`, {
    method: 'PATCH',
    body: JSON.stringify({ houseNumber }),
  });
}

export function uploadHousePhoto(houseId: string, file: File, type: PhotoType): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiFetch<void>(`/api/houses/${houseId}/photos`, { method: 'POST', body: formData });
}

export function resurveyHouse(id: string, body: ResurveyHouseRequest): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}/resurvey`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
