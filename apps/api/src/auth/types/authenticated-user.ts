import { Role } from '@prisma/client';

/** Thông tin người dùng được gắn vào `request.user` sau khi xác thực JWT. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  /** TN-05/TN-13 — dùng cho lời chào có chức vụ + đơn vị trên dashboard mobile. */
  unit: string | null;
  position: string | null;
}
