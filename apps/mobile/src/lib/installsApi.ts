import type { InstallAssignment, InstallPlateItem } from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Thi công gắn biển (mobile — cán bộ thi công). Chỉ cần đọc "nhiệm vụ của tôi" + 2 hành động tự thân
 * (bắt đầu/gửi duyệt); giao việc/nghiệm thu là thao tác quản trị, làm ở web (`/houses/installs`).
 * Gắn biển / ghi nhận chưa gắn được dùng lại `platesApi` (cùng endpoint house-plates).
 */
export function fetchMyInstallAssignments(): Promise<InstallAssignment[]> {
  return apiFetch<InstallAssignment[]>('/api/install-assignments?mine=true');
}

export function getInstallAssignment(id: string): Promise<InstallAssignment> {
  return apiFetch<InstallAssignment>(`/api/install-assignments/${id}`);
}

/** Danh sách biển của nhiệm vụ (kèm thông tin nhà, đã loại biển bị thu hồi). */
export function fetchInstallPlates(id: string): Promise<InstallPlateItem[]> {
  return apiFetch<InstallPlateItem[]>(`/api/install-assignments/${id}/plates`);
}

/** Bấm "Bắt đầu thi công" — cũng dùng để mở lại nhiệm vụ bị yêu cầu thi công lại. */
export function startInstallAssignment(id: string): Promise<InstallAssignment> {
  return apiFetch<InstallAssignment>(`/api/install-assignments/${id}/start`, { method: 'POST' });
}

/** Gửi duyệt — API chặn nếu còn biển chưa xử lý hoặc còn biển bị yêu cầu thi công lại. */
export function submitInstallAssignment(id: string): Promise<InstallAssignment> {
  return apiFetch<InstallAssignment>(`/api/install-assignments/${id}/submit`, { method: 'POST' });
}
