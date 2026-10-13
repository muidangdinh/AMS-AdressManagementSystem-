import { PERMISSIONS } from '../auth/permissions';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Cán bộ thi công "thuần" (có `install:execute` nhưng không có `install:manage`/`install:review`) chỉ được xem
 * đợt/phân vùng/nhiệm vụ/biển được giao cho CHÍNH MÌNH. Quản trị viên và người giao việc/nghiệm thu xem tất cả.
 */
export function isInstallRestricted(user?: Pick<AuthenticatedUser, 'permissions'> | null): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  return (
    perms.includes(PERMISSIONS.INSTALL_EXECUTE) &&
    !perms.includes(PERMISSIONS.INSTALL_MANAGE) &&
    !perms.includes(PERMISSIONS.INSTALL_REVIEW)
  );
}
