import { PERMISSIONS } from '../auth/permissions';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Cán bộ khảo sát "thuần" (có `assignment:execute` nhưng không có `survey:manage`/`assignment:review`) chỉ được
 * xem đợt/phân vùng/tuyến/nhiệm vụ được giao cho CHÍNH MÌNH. Quản trị viên và người giao việc/nghiệm thu xem tất cả.
 */
export function isSurveyRestricted(user?: Pick<AuthenticatedUser, 'permissions'> | null): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  return (
    perms.includes(PERMISSIONS.ASSIGNMENT_EXECUTE) &&
    !perms.includes(PERMISSIONS.SURVEY_MANAGE) &&
    !perms.includes(PERMISSIONS.ASSIGNMENT_REVIEW)
  );
}
