/**
 * PHASE 17 — Danh mục QUYỀN (permission) cố định của hệ thống.
 *
 * Đây là NGUỒN SỰ THẬT: mỗi permission ứng với một chức năng thật trong code.
 * Permission KHÔNG tạo động từ UI (chỉ vai trò và việc gán quyền cho vai trò là động).
 * Danh mục này được đồng bộ (upsert) vào bảng `permission` qua seed.
 *
 * Chuỗi mã dưới đây được nhân bản sang `packages/shared` cho frontend (theo đúng
 * pattern enum đang được nhân bản, vì API không import shared lúc runtime).
 */

export const PERMISSIONS = {
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  ADDRESS_WRITE: 'address:write',
  HOUSE_CREATE: 'house:create',
  HOUSE_UPDATE: 'house:update',
  HOUSE_RESURVEY: 'house:resurvey',
  HOUSE_PHOTO_ADD: 'house:photo:add',
  HOUSE_PHOTO_DELETE: 'house:photo:delete',
  SCHEME_MANAGE: 'scheme:manage',
  SCHEME_APPROVE: 'scheme:approve',
  PLATE_ISSUE: 'plate:issue',
  PLATE_INSTALL: 'plate:install',
  PLATE_REVOKE: 'plate:revoke',
  SURVEY_MANAGE: 'survey:manage',
  ASSIGNMENT_EXECUTE: 'assignment:execute',
  ASSIGNMENT_REVIEW: 'assignment:review',
  CASE_MANAGE: 'case:manage',
  NOTIFICATION_REMIND: 'notification:remind',
  NOTIFICATION_RUN_REMINDERS: 'notification:run-reminders',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDef {
  code: PermissionCode;
  /** Nhãn tiếng Việt hiển thị trên UI. */
  name: string;
  /** Nhóm để gom quyền trên UI. */
  group: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  { code: PERMISSIONS.USER_MANAGE, name: 'Quản lý tài khoản người dùng', group: 'Người dùng & phân quyền' },
  { code: PERMISSIONS.ROLE_MANAGE, name: 'Quản lý vai trò & phân quyền', group: 'Người dùng & phân quyền' },
  { code: PERMISSIONS.ADDRESS_WRITE, name: 'Thêm/sửa/xóa danh mục địa chỉ', group: 'Danh mục địa chỉ' },
  { code: PERMISSIONS.HOUSE_CREATE, name: 'Tạo mới hồ sơ số nhà', group: 'Hồ sơ nhà' },
  { code: PERMISSIONS.HOUSE_UPDATE, name: 'Sửa hồ sơ số nhà', group: 'Hồ sơ nhà' },
  { code: PERMISSIONS.HOUSE_RESURVEY, name: 'Khảo sát lại hồ sơ bị đánh dấu', group: 'Hồ sơ nhà' },
  { code: PERMISSIONS.HOUSE_PHOTO_ADD, name: 'Tải ảnh lên hồ sơ', group: 'Hồ sơ nhà' },
  { code: PERMISSIONS.HOUSE_PHOTO_DELETE, name: 'Xóa ảnh của hồ sơ', group: 'Hồ sơ nhà' },
  { code: PERMISSIONS.SCHEME_MANAGE, name: 'Lập/sửa phương án đánh số, sinh số, trình duyệt', group: 'Phương án đánh số' },
  { code: PERMISSIONS.SCHEME_APPROVE, name: 'Phê duyệt/từ chối phương án đánh số', group: 'Phương án đánh số' },
  { code: PERMISSIONS.PLATE_ISSUE, name: 'Cấp biển số (mới/đổi/lại)', group: 'Biển số' },
  { code: PERMISSIONS.PLATE_INSTALL, name: 'Xác nhận đã gắn/chưa gắn biển', group: 'Biển số' },
  { code: PERMISSIONS.PLATE_REVOKE, name: 'Thu hồi biển số', group: 'Biển số' },
  { code: PERMISSIONS.SURVEY_MANAGE, name: 'Tạo đợt/phân vùng, giao nhiệm vụ khảo sát', group: 'Khảo sát' },
  { code: PERMISSIONS.ASSIGNMENT_EXECUTE, name: 'Thực hiện nhiệm vụ (bắt đầu/gửi duyệt/báo vấn đề)', group: 'Khảo sát' },
  { code: PERMISSIONS.ASSIGNMENT_REVIEW, name: 'Nghiệm thu/yêu cầu khảo sát lại', group: 'Khảo sát' },
  { code: PERMISSIONS.CASE_MANAGE, name: 'Tiếp nhận & xử lý hồ sơ hành chính', group: 'Hồ sơ hành chính' },
  { code: PERMISSIONS.NOTIFICATION_REMIND, name: 'Gửi nhắc việc thủ công', group: 'Thông báo' },
  { code: PERMISSIONS.NOTIFICATION_RUN_REMINDERS, name: 'Chạy quét nhắc việc toàn hệ thống', group: 'Thông báo' },
];

const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.code);

export interface DefaultRoleDef {
  code: string;
  name: string;
  description: string;
  permissions: PermissionCode[];
}

/**
 * 3 vai trò hệ thống seed sẵn — GIỮ NGUYÊN hành vi phân quyền hiện tại
 * (suy ra trực tiếp từ bản đồ @Roles cũ). Seed với isSystem=true.
 */
export const DEFAULT_ROLES: DefaultRoleDef[] = [
  {
    code: 'admin',
    name: 'Quản trị viên',
    description: 'Toàn quyền trên hệ thống',
    permissions: ALL_PERMISSIONS,
  },
  {
    code: 'cadastral',
    name: 'Cán bộ địa chính',
    description: 'Nghiệp vụ tại trụ sở: hồ sơ, phương án, biển số, khảo sát, hồ sơ hành chính',
    permissions: [
      PERMISSIONS.HOUSE_CREATE,
      PERMISSIONS.HOUSE_UPDATE,
      PERMISSIONS.HOUSE_PHOTO_ADD,
      PERMISSIONS.HOUSE_PHOTO_DELETE,
      PERMISSIONS.SCHEME_MANAGE,
      PERMISSIONS.PLATE_ISSUE,
      PERMISSIONS.PLATE_INSTALL,
      PERMISSIONS.PLATE_REVOKE,
      PERMISSIONS.SURVEY_MANAGE,
      PERMISSIONS.ASSIGNMENT_REVIEW,
      PERMISSIONS.CASE_MANAGE,
      PERMISSIONS.NOTIFICATION_REMIND,
    ],
  },
  {
    code: 'surveyor',
    name: 'Cán bộ khảo sát',
    description: 'Khảo sát hiện trường: tạo hồ sơ, tải ảnh, gắn biển, thực hiện nhiệm vụ',
    permissions: [
      PERMISSIONS.HOUSE_CREATE,
      PERMISSIONS.HOUSE_RESURVEY,
      PERMISSIONS.HOUSE_PHOTO_ADD,
      PERMISSIONS.PLATE_INSTALL,
      PERMISSIONS.ASSIGNMENT_EXECUTE,
    ],
  },
];

/** Map enum Role (legacy) → mã vai trò mới, dùng để backfill `user_role`. */
export const LEGACY_ROLE_TO_CODE: Record<string, string> = {
  ADMIN: 'admin',
  CADASTRAL: 'cadastral',
  SURVEYOR: 'surveyor',
};
