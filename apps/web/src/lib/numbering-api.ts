import type {
  CreateSchemeItemRequest,
  CreateSchemeRequest,
  NumberingScheme,
  NumberingSchemeStatus,
  SchemeValidationResult,
  UpdateSchemeItemRequest,
  UpdateSchemeRequest,
} from '@tayninh/shared';
import { apiFetch } from './api';

/** Phase 7 — client API cho lập phương án đánh số (/api/numbering-schemes). */
export const numberingSchemesApi = {
  list: (params?: { streetId?: string; status?: NumberingSchemeStatus }) => {
    const qs = new URLSearchParams();
    if (params?.streetId) qs.set('streetId', params.streetId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<NumberingScheme[]>(`/api/numbering-schemes${suffix}`);
  },
  get: (id: string) => apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}`),
  validate: (id: string) =>
    apiFetch<SchemeValidationResult>(`/api/numbering-schemes/${id}/validate`),
  create: (dto: CreateSchemeRequest) =>
    apiFetch<NumberingScheme>('/api/numbering-schemes', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  update: (id: string, dto: UpdateSchemeRequest) =>
    apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  remove: (id: string) => apiFetch<void>(`/api/numbering-schemes/${id}`, { method: 'DELETE' }),
  addItem: (id: string, dto: CreateSchemeItemRequest) =>
    apiFetch(`/api/numbering-schemes/${id}/items`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  updateItem: (id: string, itemId: string, dto: UpdateSchemeItemRequest) =>
    apiFetch(`/api/numbering-schemes/${id}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  removeItem: (id: string, itemId: string) =>
    apiFetch(`/api/numbering-schemes/${id}/items/${itemId}`, { method: 'DELETE' }),
  generate: (id: string) =>
    apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}/generate`, { method: 'POST' }),
  submit: (id: string) =>
    apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}/submit`, { method: 'POST' }),
  approve: (id: string) =>
    apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    apiFetch<NumberingScheme>(`/api/numbering-schemes/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
