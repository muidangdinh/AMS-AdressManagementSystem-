import type { HousePlate } from '@tayninh/shared';
import { PlateStatus } from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Phase 8 — biển số nhà (mobile nhóm 7: quản lý gắn biển). Chỉ cần đọc danh
 * sách "chờ gắn" + 2 hành động hiện trường (xác nhận đã gắn kèm ảnh / ghi
 * nhận chưa gắn kèm lý do) — cấp/thu hồi/cấp đổi là thao tác quản trị, làm
 * ở web (`apps/web/src/app/houses/page.tsx`, panel "Biển số nhà").
 */
export function fetchPendingPlates(): Promise<HousePlate[]> {
  return apiFetch<HousePlate[]>(`/api/house-plates?status=${PlateStatus.ISSUED}`);
}

/** Xác nhận đã gắn (7.6), kèm ảnh hiện trường nếu chụp được (7.5). */
export function installPlate(plateId: string, photoUri?: string): Promise<HousePlate> {
  if (!photoUri) {
    return apiFetch<HousePlate>(`/api/house-plates/${plateId}/install`, { method: 'POST' });
  }
  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    type: 'image/jpeg',
    name: `plate-${plateId}.jpg`,
  } as unknown as Blob);
  return apiFetch<HousePlate>(`/api/house-plates/${plateId}/install`, {
    method: 'POST',
    body: formData,
  });
}

/** Ghi nhận chưa gắn được + lý do (7.7-7.8). */
export function markPlateNotInstalled(plateId: string, reason: string): Promise<HousePlate> {
  return apiFetch<HousePlate>(`/api/house-plates/${plateId}/not-installed`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
