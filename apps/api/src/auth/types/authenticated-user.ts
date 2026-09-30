import { Role } from '@prisma/client';

/** Thông tin người dùng được gắn vào `request.user` sau khi xác thực JWT. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  /**
   * LEGACY (Phase 1) — vai trò enum đơn. Giữ tạm để tương thích ngược trong
   * giai đoạn chuyển đổi; ưu tiên dùng `roles`/`permissions` (Phase 17).
   */
  role: Role;
  /** PHASE 17 — các vai trò động được gán (id + mã + tên hiển thị). */
  roles: { id: string; code: string; name: string }[];
  /** PHASE 17 — hợp các quyền từ mọi vai trò (vd ["house:update", ...]). */
  permissions: string[];
  /** TN-05/TN-13 — dùng cho lời chào có chức vụ + đơn vị trên dashboard mobile. */
  unit: string | null;
  position: string | null;
}
