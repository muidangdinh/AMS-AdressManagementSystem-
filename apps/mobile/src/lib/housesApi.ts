import type { HouseSummary, PaginatedResult } from '@tayninh/shared';
import { apiFetch } from './api';

/** Tìm đúng hồ sơ theo mã QR nhà (so khớp chính xác, không phân biệt hoa thường). */
export async function findHouseByQrCode(code: string): Promise<HouseSummary | null> {
  const qrCode = code.trim();
  if (!qrCode) return null;

  const res = await apiFetch<PaginatedResult<HouseSummary>>(
    `/api/houses?search=${encodeURIComponent(qrCode)}&pageSize=10`,
  );
  return res.items.find((house) => house.qrCode.toLowerCase() === qrCode.toLowerCase()) ?? null;
}

/** Sửa riêng số nhà (non-admin chỉ trong 48 giờ kể từ lúc tạo hồ sơ). */
export function updateHouseNumber(id: string, houseNumber: string): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}/number`, {
    method: 'PATCH',
    body: JSON.stringify({ houseNumber }),
  });
}

/** Chỉnh riêng tọa độ GPS (kéo chấm nhà trên bản đồ). */
export function updateHouseLocation(
  id: string,
  latitude: number,
  longitude: number,
): Promise<HouseSummary> {
  return apiFetch<HouseSummary>(`/api/houses/${id}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ latitude, longitude }),
  });
}
