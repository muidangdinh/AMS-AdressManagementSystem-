import type { Hamlet, Street, Ward } from '@tayninh/shared';
import { apiFetch } from './api';

/**
 * Phase 6 — danh mục địa chỉ chuẩn hoá dùng cho picker chọn Đường/Phường ở
 * màn hình khảo sát. Chỉ đọc (GET mở cho mọi vai trò đã đăng nhập) — quản lý
 * danh mục làm ở web (`/houses/addresses`, chỉ ADMIN).
 */
export function fetchWards(): Promise<Ward[]> {
  return apiFetch<Ward[]>('/api/wards');
}

export function fetchStreets(): Promise<Street[]> {
  return apiFetch<Street[]>('/api/streets');
}

/**
 * TN-07 — danh mục Ấp/Thôn (góp ý khách hàng 11/09/2026), LUÔN lọc theo xã
 * (khác `fetchWards`/`fetchStreets` tải hết rồi lọc phía client) vì Ấp bắt
 * buộc thuộc 1 xã (`Hamlet.wardId` required trong schema.prisma) — không có
 * lý do tải toàn bộ ấp của mọi xã trên máy khảo sát.
 */
export function fetchHamlets(wardId: string): Promise<Hamlet[]> {
  return apiFetch<Hamlet[]>(`/api/hamlets?wardId=${encodeURIComponent(wardId)}`);
}
