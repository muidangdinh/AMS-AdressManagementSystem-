import type {
  Alley,
  CreateAlleyRequest,
  CreateDistrictRequest,
  CreateHamletRequest,
  CreateStreetRequest,
  CreateWardRequest,
  District,
  Hamlet,
  Street,
  UpdateAlleyRequest,
  UpdateDistrictRequest,
  UpdateHamletRequest,
  UpdateStreetRequest,
  UpdateWardRequest,
  Ward,
} from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Phase 6 — client API cho danh mục địa chỉ chuẩn hoá (District/Ward/Hamlet/
 * Street/Alley). Dùng chung giữa trang quản trị danh mục
 * (`/houses/addresses`) và dropdown chọn địa chỉ trên form House.
 */
export const districtsApi = {
  list: () => apiFetch<District[]>('/api/districts'),
  create: (dto: CreateDistrictRequest) =>
    apiFetch<District>('/api/districts', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateDistrictRequest) =>
    apiFetch<District>(`/api/districts/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/districts/${id}`, { method: 'DELETE' }),
};

export const wardsApi = {
  list: (districtId?: string) =>
    apiFetch<Ward[]>(`/api/wards${districtId ? `?districtId=${districtId}` : ''}`),
  create: (dto: CreateWardRequest) =>
    apiFetch<Ward>('/api/wards', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateWardRequest) =>
    apiFetch<Ward>(`/api/wards/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/wards/${id}`, { method: 'DELETE' }),
};

export const hamletsApi = {
  list: (wardId?: string) =>
    apiFetch<Hamlet[]>(`/api/hamlets${wardId ? `?wardId=${wardId}` : ''}`),
  create: (dto: CreateHamletRequest) =>
    apiFetch<Hamlet>('/api/hamlets', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateHamletRequest) =>
    apiFetch<Hamlet>(`/api/hamlets/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/hamlets/${id}`, { method: 'DELETE' }),
};

export const streetsApi = {
  list: (wardId?: string) =>
    apiFetch<Street[]>(`/api/streets${wardId ? `?wardId=${wardId}` : ''}`),
  create: (dto: CreateStreetRequest) =>
    apiFetch<Street>('/api/streets', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateStreetRequest) =>
    apiFetch<Street>(`/api/streets/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/streets/${id}`, { method: 'DELETE' }),
};

export const alleysApi = {
  list: (streetId?: string) =>
    apiFetch<Alley[]>(`/api/alleys${streetId ? `?streetId=${streetId}` : ''}`),
  create: (dto: CreateAlleyRequest) =>
    apiFetch<Alley>('/api/alleys', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateAlleyRequest) =>
    apiFetch<Alley>(`/api/alleys/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  remove: (id: string) => apiFetch<void>(`/api/alleys/${id}`, { method: 'DELETE' }),
};
