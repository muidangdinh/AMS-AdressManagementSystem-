import type { UserLevel } from '@prisma/client';
import { effectivePermissions } from './permissions';
import type { AuthenticatedUser } from './types/authenticated-user';

/** Include dùng chung để dựng thông tin tài khoản: vai trò → quyền, kèm xã/ấp. */
export const AUTH_USER_INCLUDE = {
  roleLinks: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
  ward: { select: { id: true, name: true } },
  hamlet: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
} as const;

export interface UserWithAuthRelations {
  id: string;
  username: string;
  fullName: string;
  role: AuthenticatedUser['role'];
  unit: string | null;
  position: string | null;
  level: UserLevel;
  wardId: string | null;
  hamletId: string | null;
  ward: { id: string; name: string } | null;
  hamlet: { id: string; name: string } | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  roleLinks: {
    role: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      permissions: { permission: { code: string } }[];
    };
  }[];
}

/**
 * Vai trò đang hoạt động + quyền thực tế (đã trừ quyền bị bỏ theo cấp tài khoản).
 * Dùng chung cho JwtStrategy (mỗi request), phản hồi đăng nhập và API quản lý người dùng,
 * để 3 nơi luôn trả cùng một bộ quyền.
 */
export function resolveRolesAndPermissions(user: Pick<UserWithAuthRelations, 'level' | 'roleLinks'>) {
  const activeRoles = user.roleLinks.map((l) => l.role).filter((r) => r.isActive);
  const roles = activeRoles.map((r) => ({ id: r.id, code: r.code, name: r.name }));
  const permissions = effectivePermissions(
    user.level,
    activeRoles.flatMap((r) => r.permissions.map((rp) => rp.permission.code)),
  );
  return { roles, permissions };
}

export function toAuthenticatedUser(user: UserWithAuthRelations): AuthenticatedUser {
  const { roles, permissions } = resolveRolesAndPermissions(user);
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    roles,
    permissions,
    unit: user.unit,
    position: user.position,
    level: user.level,
    wardId: user.wardId,
    hamletId: user.hamletId,
    ward: user.ward,
    hamlet: user.hamlet,
    departmentId: user.departmentId,
    department: user.department,
  };
}
