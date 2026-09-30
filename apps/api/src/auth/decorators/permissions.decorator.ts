import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '../permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * PHASE 17 — Yêu cầu người dùng có ĐỦ các quyền liệt kê mới được gọi route.
 * Không gắn = chỉ cần đăng nhập hợp lệ (giống @Roles cũ khi bỏ trống).
 */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
