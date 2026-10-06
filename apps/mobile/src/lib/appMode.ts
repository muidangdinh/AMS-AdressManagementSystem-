/** Phân hệ của app: khảo sát, thi công, hoặc 'all' (có cả 2 quyền → đủ tab). Xem KE_HOACH_TACH_MOBILE.md. */
export type AppMode = 'survey' | 'install' | 'all';

export const APP_MODE_LABELS: Record<AppMode, string> = {
  survey: 'Khảo sát',
  install: 'Thi công',
  all: 'Tất cả',
};

/** Màu nhận diện từng phân hệ (tab đang chọn, chip trên header). */
export const APP_MODE_COLORS: Record<AppMode, string> = {
  survey: '#2563eb',
  install: '#ea580c',
  all: '#2563eb',
};

const SURVEY_PERMISSIONS = ['assignment:execute', 'house:create', 'house:resurvey'];
const INSTALL_PERMISSIONS = ['install:execute'];

/** Các phân hệ người dùng có quyền (thứ tự cố định: khảo sát trước), suy ra từ danh sách quyền. */
export function availableModes(permissions: string[] | undefined): ('survey' | 'install')[] {
  const perms = permissions ?? [];
  const modes: ('survey' | 'install')[] = [];
  if (SURVEY_PERMISSIONS.some((p) => perms.includes(p))) modes.push('survey');
  if (INSTALL_PERMISSIONS.some((p) => perms.includes(p))) modes.push('install');
  return modes;
}
