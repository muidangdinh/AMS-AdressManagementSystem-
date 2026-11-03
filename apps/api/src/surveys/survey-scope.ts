import { PERMISSIONS } from '../auth/permissions';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Cán bộ khảo sát "thuần" (có `assignment:execute` nhưng không có `survey:manage`/`assignment:review`) chỉ được
 * xem đợt/phân vùng/tuyến/nhiệm vụ được giao cho CHÍNH MÌNH. Quản trị viên và người giao việc/nghiệm thu xem tất cả.
 */
export function isSurveyRestricted(
  user?: (Pick<AuthenticatedUser, 'permissions'> & Partial<Pick<AuthenticatedUser, 'level'>>) | null,
): boolean {
  if (!user) return false;
  // Nhân sự ấp/thôn luôn chỉ thấy nhiệm vụ được giao cho chính mình, kể cả khi không có quyền thực hiện.
  if (user.level === 'HAMLET') return true;
  const perms = user.permissions ?? [];
  return (
    perms.includes(PERMISSIONS.ASSIGNMENT_EXECUTE) &&
    !perms.includes(PERMISSIONS.SURVEY_MANAGE) &&
    !perms.includes(PERMISSIONS.ASSIGNMENT_REVIEW)
  );
}
