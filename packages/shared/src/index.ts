// ============================================================
//  @tayninh/shared — kiểu dữ liệu & hằng số dùng chung FE/BE
//  Phase 0: kiểu cho Health. Phase 1: Auth & User. Phase 2: House.
//  Sẽ mở rộng thêm ở các phase sau (SurveyRecord, Sign...).
// ============================================================

/** Trạng thái phê duyệt số nhà — khớp enum HouseStatus trong Prisma schema. */
export enum HouseStatus {
  PENDING = 'PENDING', // Chờ duyệt
  APPROVED = 'APPROVED', // Đã cấp biển & QR
  NEEDS_ADJUST = 'NEEDS_ADJUST', // Cần hiệu chỉnh
}

/** Nhãn tiếng Việt hiển thị cho HouseStatus. */
export const HOUSE_STATUS_LABELS: Record<HouseStatus, string> = {
  [HouseStatus.PENDING]: 'Chờ duyệt',
  [HouseStatus.APPROVED]: 'Đã cấp biển & QR',
  [HouseStatus.NEEDS_ADJUST]: 'Cần hiệu chỉnh',
};

/**
 * Loại công trình — khớp enum BuildingType trong Prisma schema. APARTMENT
 * giữ nguyên tên giá trị (không backfill dữ liệu cũ) — nhãn hiển thị đổi
 * từ "Chung cư đô thị" sang "Nhà chung cư"; COMPANY_FACTORY/RESIDENTIAL_AREA
 * là 2 giá trị mới (TN-04, góp ý khách hàng 11/09/2026).
 */
export enum BuildingType {
  SINGLE_HOUSE = 'SINGLE_HOUSE', // Nhà ở riêng lẻ
  SHOP = 'SHOP', // Cửa hàng kinh doanh
  OFFICE_BUILDING = 'OFFICE_BUILDING', // Tòa nhà văn phòng
  APARTMENT = 'APARTMENT', // Nhà chung cư
  COMPANY_FACTORY = 'COMPANY_FACTORY', // Công ty/Nhà máy
  RESIDENTIAL_AREA = 'RESIDENTIAL_AREA', // Khu dân cư
}

/** Nhãn tiếng Việt hiển thị cho BuildingType. */
export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  [BuildingType.SINGLE_HOUSE]: 'Nhà ở riêng lẻ',
  [BuildingType.SHOP]: 'Cửa hàng kinh doanh',
  [BuildingType.OFFICE_BUILDING]: 'Tòa nhà văn phòng',
  [BuildingType.APARTMENT]: 'Nhà chung cư',
  [BuildingType.COMPANY_FACTORY]: 'Công ty/Nhà máy',
  [BuildingType.RESIDENTIAL_AREA]: 'Khu dân cư',
};

/** Loại ảnh đính kèm hồ sơ số nhà. */
export enum PhotoType {
  FACADE = 'FACADE', // Ảnh mặt tiền
  CONDITION = 'CONDITION', // Ảnh hiện trạng khác
  PLATE = 'PLATE', // Ảnh biển số nhà
}

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  [PhotoType.FACADE]: 'Ảnh mặt tiền',
  [PhotoType.CONDITION]: 'Ảnh hiện trạng',
  [PhotoType.PLATE]: 'Ảnh biển số nhà',
};

/** Tình trạng sử dụng nhà lúc khảo sát — khớp enum HouseUsageStatus trong Prisma schema. */
export enum HouseUsageStatus {
  RESIDENTIAL = 'RESIDENTIAL', // Nhà ở
  VACANT = 'VACANT', // Bỏ trống
  UNDER_CONSTRUCTION = 'UNDER_CONSTRUCTION', // Đang xây dựng
  BUSINESS = 'BUSINESS', // Kinh doanh / cho thuê
}

export const HOUSE_USAGE_STATUS_LABELS: Record<HouseUsageStatus, string> = {
  [HouseUsageStatus.RESIDENTIAL]: 'Nhà ở',
  [HouseUsageStatus.VACANT]: 'Bỏ trống',
  [HouseUsageStatus.UNDER_CONSTRUCTION]: 'Đang xây dựng',
  [HouseUsageStatus.BUSINESS]: 'Kinh doanh / cho thuê',
};

/** Nhu cầu gắn biển của chủ hộ lúc khảo sát — khớp enum PlateNeed trong Prisma schema. */
export enum PlateNeed {
  NEEDED = 'NEEDED', // Có nhu cầu
  NOT_NEEDED = 'NOT_NEEDED', // Không có nhu cầu
  ALREADY_HAS = 'ALREADY_HAS', // Đã có biển
}

export const PLATE_NEED_LABELS: Record<PlateNeed, string> = {
  [PlateNeed.NEEDED]: 'Có nhu cầu',
  [PlateNeed.NOT_NEEDED]: 'Không có nhu cầu',
  [PlateNeed.ALREADY_HAS]: 'Đã có biển',
};

/**
 * 5 giai đoạn phân loại nhà (thiết kế tham khảo UI/2-3.jpg) — ĐỘC LẬP với
 * HouseStatus (status vẫn dùng nguyên cho logic duyệt phương án đánh số/cấp
 * biển/màu marker bản đồ). reviewStage chỉ phục vụ khối thống kê "Phân loại
 * số nhà" và có thể chuyển tay từ web.
 */
export enum HouseReviewStage {
  PROPOSED = 'PROPOSED', // Đề xuất
  CHECKED = 'CHECKED', // Đã kiểm tra
  APPROVED = 'APPROVED', // Đã duyệt
  SIGNED = 'SIGNED', // Đã ký duyệt
  REJECTED = 'REJECTED', // Từ chối
}

export const HOUSE_REVIEW_STAGE_LABELS: Record<HouseReviewStage, string> = {
  [HouseReviewStage.PROPOSED]: 'Đề xuất',
  [HouseReviewStage.CHECKED]: 'Đã kiểm tra',
  [HouseReviewStage.APPROVED]: 'Đã duyệt',
  [HouseReviewStage.SIGNED]: 'Đã ký duyệt',
  [HouseReviewStage.REJECTED]: 'Từ chối',
};

/** Vai trò người dùng (MVP) — khớp với enum Role trong Prisma schema. */
export enum UserRole {
  ADMIN = 'ADMIN',
  CADASTRAL = 'CADASTRAL', // Cán bộ địa chính
  SURVEYOR = 'SURVEYOR', // Cán bộ khảo sát
}

/** Nhãn tiếng Việt hiển thị cho UserRole. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Quản trị viên',
  [UserRole.CADASTRAL]: 'Cán bộ địa chính',
  [UserRole.SURVEYOR]: 'Cán bộ khảo sát',
};

/** Vai trò được phép ghi/sửa dữ liệu nghiệp vụ (House...). */
export const EDITOR_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CADASTRAL];

/** Kết quả trả về của endpoint /api/health. */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    api: 'up' | 'down';
    database: 'up' | 'down';
    postgis: 'enabled' | 'unknown';
  };
  postgisVersion: string | null;
  error: string | null;
}

/** Body gửi lên POST /api/auth/login. */
export interface LoginRequest {
  username: string;
  password: string;
}

/** Thông tin người dùng an toàn (không bao giờ chứa mật khẩu). */
export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  unit?: string | null;
  /** Chức vụ (TN-05, góp ý khách hàng 11/09/2026) — tự do nhập, tuỳ chọn. */
  position?: string | null;
  isActive: boolean;
}

/** Kết quả trả về của POST /api/auth/login. */
export interface LoginResponse {
  accessToken: string;
  /** unit/position kèm theo để dashboard mobile dựng lời chào (TN-13) mà không cần gọi thêm /auth/me. */
  user: Pick<UserSummary, 'id' | 'username' | 'fullName' | 'role' | 'unit' | 'position'>;
}

// ============================================================
//  Phase 2 — CSDL số nhà (II. Quản lý cơ sở dữ liệu số nhà)
// ============================================================

export interface HousePhotoSummary {
  id: string;
  url: string;
  type: PhotoType;
  createdAt: string;
}

/** Một mục thay đổi trong lịch sử ({ field, old, new }). */
export interface HouseHistoryChange {
  field: string;
  old: unknown;
  new: unknown;
}

/** Thông tin gọn của người dùng, đính kèm mỗi mục lịch sử hoặc hồ sơ (người tạo). */
export interface HouseUserRef {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
}

export interface HouseHistoryEntry {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'PHOTO_ADD' | 'PHOTO_DELETE';
  changes: HouseHistoryChange[] | null;
  changedById: string | null;
  /** null nếu tài khoản đã bị xóa (changedById set null do onDelete: SetNull) */
  changedBy: HouseUserRef | null;
  createdAt: string;
}

/** Giá trị change khi action là PHOTO_ADD/PHOTO_DELETE. */
export interface HousePhotoChangeValue {
  url: string;
  type: PhotoType;
}

/** Phase 6 — tham chiếu rút gọn tới 1 dòng danh mục địa chỉ (chỉ id + tên hiển thị). */
export interface AddressRef {
  id: string;
  name: string;
}

export interface HouseSummary {
  id: string;
  houseNumber: string;
  street: string;
  ward: string;
  district?: string | null;
  /** Phase 6 — liên kết danh mục địa chỉ chuẩn hoá (song song với text tự do ở trên). */
  districtId?: string | null;
  wardId?: string | null;
  hamletId?: string | null;
  streetId?: string | null;
  alleyId?: string | null;
  districtRef?: AddressRef | null;
  wardRef?: AddressRef | null;
  hamlet?: AddressRef | null;
  streetRef?: AddressRef | null;
  alley?: AddressRef | null;
  ownerName: string;
  ownerPhone?: string | null;
  ownerIdNumber?: string | null;
  buildingType: BuildingType;
  floors?: number | null;
  area?: number | null;
  status: HouseStatus;
  qrCode: string;
  latitude: number;
  longitude: number;
  soTo?: string | null;
  soThua?: string | null;
  usageStatus?: HouseUsageStatus | null;
  plateNeed?: PlateNeed | null;
  side: NumberingSide;
  reviewStage: HouseReviewStage;
  note?: string | null;
  createdById: string | null;
  /** null nếu tài khoản đã bị xóa (createdById set null do onDelete: SetNull) */
  createdBy?: HouseUserRef | null;
  createdAt: string;
  updatedAt: string;
  photos?: HousePhotoSummary[];
  /** Phase 9 — nhiệm vụ khảo sát đã tạo ra hồ sơ này, nếu có (tùy chọn, không bắt buộc). */
  surveyAssignmentId?: string | null;
}

/** Tên tỉnh mặc định khi chưa tải được `/api/app-config` (TN-02) — dùng làm dự phòng cho `formatFullAddress`. */
export const DEFAULT_PROVINCE_NAME = 'Tỉnh Tây Ninh';

/**
 * TN-21 — dựng chuỗi địa chỉ đầy đủ 5 cấp (góp ý khách hàng 11/09/2026, mục
 * "Thông tin hộ"): số nhà, đường, ấp, xã, tỉnh. Dùng chung web + mobile.
 * `hamletName` bỏ qua nếu hồ sơ chưa gán ấp (dữ liệu cũ trước TN-07/TN-09).
 *
 * LƯU Ý: API (NestJS chạy `node dist/main.js`) không import được hàm này
 * từ `@tayninh/shared` — cùng lý do đã ghi ở `apps/api/src/houses/houses.service.ts`
 * (dòng 32-39, package trỏ thẳng vào TS nguồn). Nếu backend cần chuỗi này
 * (vd xuất Excel), viết bản cục bộ bên API theo đúng tiền lệ đã có.
 */
export function formatFullAddress(
  house: { houseNumber: string; street: string; ward: string; hamletName?: string | null },
  provinceName: string = DEFAULT_PROVINCE_NAME,
): string {
  return [
    `${house.houseNumber} ${house.street}`.trim(),
    house.hamletName || null,
    house.ward ? `Xã ${house.ward}` : null,
    provinceName,
  ]
    .filter((part): part is string => !!part)
    .join(', ');
}

/** Body gửi lên POST /api/houses. */
export interface CreateHouseRequest {
  houseNumber: string;
  street: string;
  ward: string;
  district?: string;
  /** Phase 6 — liên kết danh mục địa chỉ chuẩn hoá (tùy chọn, song song với text ở trên). */
  districtId?: string;
  wardId?: string;
  hamletId?: string;
  streetId?: string;
  alleyId?: string;
  /** Phase 9 — nhiệm vụ khảo sát đang active lúc tạo (tùy chọn, không bắt buộc). */
  surveyAssignmentId?: string;
  ownerName: string;
  ownerPhone?: string;
  ownerIdNumber?: string;
  buildingType: BuildingType;
  floors?: number;
  area?: number;
  status?: HouseStatus;
  latitude: number;
  longitude: number;
  soTo?: string;
  soThua?: string;
  usageStatus?: HouseUsageStatus;
  plateNeed?: PlateNeed;
  side?: NumberingSide;
  note?: string;
}

/**
 * Body gửi lên PATCH /api/houses/:id — mọi field của CreateHouseRequest đều
 * tùy chọn, cộng thêm `reviewStage` (chỉ có ý nghĩa lúc update — mobile tạo
 * mới luôn khởi tạo PROPOSED server-side, ADMIN/CADASTRAL mới chuyển giai
 * đoạn được từ web).
 */
export type UpdateHouseRequest = Partial<CreateHouseRequest> & {
  reviewStage?: HouseReviewStage;
};

/** Query params cho GET /api/houses. */
export interface ListHousesQuery {
  page?: number;
  pageSize?: number;
  street?: string;
  ward?: string;
  wardId?: string;
  streetId?: string;
  status?: HouseStatus;
  reviewStage?: HouseReviewStage;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================
//  Phase 6 — Danh mục địa chỉ chuẩn hoá (IV. Quản lý dữ liệu địa chỉ)
//  DTO cho /api/districts, /api/wards, /api/hamlets, /api/streets, /api/alleys.
//  Phạm vi 1 tỉnh Tây Ninh — không mô hình đa tỉnh.
// ============================================================

export interface District {
  id: string;
  name: string;
  code?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateDistrictRequest = { name: string; code?: string };
export type UpdateDistrictRequest = Partial<CreateDistrictRequest>;

export interface Ward {
  id: string;
  name: string;
  code?: string | null;
  districtId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateWardRequest = { name: string; code?: string; districtId?: string };
export type UpdateWardRequest = Partial<CreateWardRequest>;

export interface Hamlet {
  id: string;
  name: string;
  wardId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateHamletRequest = { name: string; wardId: string };
export type UpdateHamletRequest = Partial<CreateHamletRequest>;

export interface Street {
  id: string;
  name: string;
  wardId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateStreetRequest = { name: string; wardId?: string };
export type UpdateStreetRequest = Partial<CreateStreetRequest>;

export interface Alley {
  id: string;
  name: string;
  streetId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateAlleyRequest = { name: string; streetId: string };
export type UpdateAlleyRequest = Partial<CreateAlleyRequest>;

// ============================================================
//  Phase 7 — Lập phương án đánh số (V. Đánh số nhà)
//  DTO cho /api/numbering-schemes. Vòng đời: DRAFT → SUBMITTED →
//  APPROVED (ghi vào House.houseNumber hàng loạt, coi như khoá) / REJECTED
//  (sửa lại quay về DRAFT).
// ============================================================

export enum NumberingSchemeStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export const NUMBERING_SCHEME_STATUS_LABELS: Record<NumberingSchemeStatus, string> = {
  [NumberingSchemeStatus.DRAFT]: 'Nháp',
  [NumberingSchemeStatus.SUBMITTED]: 'Chờ duyệt',
  [NumberingSchemeStatus.APPROVED]: 'Đã duyệt',
  [NumberingSchemeStatus.REJECTED]: 'Bị từ chối',
};

/// Bên đường của 1 nhà trong phương án — chỉ có ý nghĩa khi `oddEvenSplit=true`.
export enum NumberingSide {
  ODD = 'ODD',
  EVEN = 'EVEN',
  NONE = 'NONE',
}

export const NUMBERING_SIDE_LABELS: Record<NumberingSide, string> = {
  [NumberingSide.ODD]: 'Bên lẻ',
  [NumberingSide.EVEN]: 'Bên chẵn',
  [NumberingSide.NONE]: 'Không phân biệt',
};

export interface NumberingSchemeItem {
  id: string;
  schemeId: string;
  houseId: string;
  house: {
    id: string;
    houseNumber: string;
    street: string;
    ward: string;
    ownerName: string;
    latitude: number;
    longitude: number;
    status: HouseStatus;
    streetId?: string | null;
  };
  side: NumberingSide;
  sequenceOrder: number;
  proposedNumber?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NumberingScheme {
  id: string;
  name: string;
  streetId: string;
  street: AddressRef;
  wardId?: string | null;
  ward?: AddressRef | null;
  description?: string | null;
  oddEvenSplit: boolean;
  startNumber: number;
  step: number;
  status: NumberingSchemeStatus;
  createdById?: string | null;
  createdBy?: { id: string; fullName: string; username: string } | null;
  submittedAt?: string | null;
  approvedById?: string | null;
  approvedBy?: { id: string; fullName: string; username: string } | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Chỉ có ở GET /numbering-schemes/:id (list không kèm để nhẹ payload). */
  items?: NumberingSchemeItem[];
}

export interface CreateSchemeRequest {
  name: string;
  streetId: string;
  description?: string;
  oddEvenSplit?: boolean;
  startNumber?: number;
  step?: number;
}

export type UpdateSchemeRequest = Partial<CreateSchemeRequest>;

export interface CreateSchemeItemRequest {
  houseId: string;
  side?: NumberingSide;
  sequenceOrder?: number;
}

export interface UpdateSchemeItemRequest {
  side?: NumberingSide;
  sequenceOrder?: number;
  proposedNumber?: string;
  note?: string;
}

export interface SchemeValidationResult {
  duplicateNumbers: { number: string; itemIds: string[] }[];
  duplicateOrders: { side: NumberingSide; order: number; itemIds: string[] }[];
  wrongStreetItemIds: string[];
  missingNumberItemIds: string[];
}

// ============================================================
//  Phase 8 — Biển số nhà như tài sản quản lý riêng (VI. Quản lý biển số nhà)
//  DTO cho /api/house-plates. Tách khỏi House.qrCode cũ (giữ nguyên cho
//  trang in tem hiện có) — mỗi House có 0..n HousePlate theo thời gian.
// ============================================================

export enum PlateStatus {
  ISSUED = 'ISSUED',
  INSTALLED = 'INSTALLED',
  REVOKED = 'REVOKED',
}

export const PLATE_STATUS_LABELS: Record<PlateStatus, string> = {
  [PlateStatus.ISSUED]: 'Đã cấp — chờ gắn',
  [PlateStatus.INSTALLED]: 'Đã gắn',
  [PlateStatus.REVOKED]: 'Đã thu hồi',
};

export enum PlateIssueReason {
  NEW = 'NEW',
  REPLACEMENT = 'REPLACEMENT',
  REISSUE = 'REISSUE',
}

export const PLATE_ISSUE_REASON_LABELS: Record<PlateIssueReason, string> = {
  [PlateIssueReason.NEW]: 'Cấp mới',
  [PlateIssueReason.REPLACEMENT]: 'Cấp đổi',
  [PlateIssueReason.REISSUE]: 'Cấp lại',
};

export interface HousePlate {
  id: string;
  plateCode: string;
  houseId: string;
  house: {
    id: string;
    houseNumber: string;
    street: string;
    ward: string;
    ownerName: string;
    latitude: number;
    longitude: number;
    status: HouseStatus;
  };
  status: PlateStatus;
  issueReason: PlateIssueReason;
  issuedAt: string;
  issuedById?: string | null;
  installedAt?: string | null;
  installedById?: string | null;
  installPhotoUrl?: string | null;
  notInstalledAt?: string | null;
  notInstalledReason?: string | null;
  revokedAt?: string | null;
  revokedById?: string | null;
  revokedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssuePlateRequest {
  houseId: string;
  reason?: PlateIssueReason;
  note?: string;
}

// ============================================================
//  Phase 9 — Khảo sát có tổ chức (VII. Quản lý khảo sát thực địa)
//  DTO cho /api/survey-campaigns, /api/survey-zones, /api/survey-assignments.
//  Quyết định #5: KHÔNG bắt buộc có nhiệm vụ mới được tạo House trên mobile
//  — surveyAssignmentId trên House chỉ để theo dõi tiến độ.
// ============================================================

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'Nháp',
  [CampaignStatus.ACTIVE]: 'Đang triển khai',
  [CampaignStatus.COMPLETED]: 'Đã hoàn tất',
};

export enum AssignmentStatus {
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  COMPLETED = 'COMPLETED',
  NEEDS_REVISIT = 'NEEDS_REVISIT',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.ASSIGNED]: 'Đã giao — chưa bắt đầu',
  [AssignmentStatus.IN_PROGRESS]: 'Đang khảo sát',
  [AssignmentStatus.SUBMITTED]: 'Chờ duyệt',
  [AssignmentStatus.COMPLETED]: 'Đã hoàn tất',
  [AssignmentStatus.NEEDS_REVISIT]: 'Cần khảo sát lại',
};

export interface SurveyCampaign {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: CampaignStatus;
  createdById?: string | null;
  createdBy?: { id: string; fullName: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Chỉ có ở danh sách. */
  _count?: { zones: number };
  /** Chỉ có ở GET :id. */
  zones?: SurveyZone[];
}

export interface SurveyZone {
  id: string;
  campaignId: string;
  campaign?: { id: string; name: string; status: CampaignStatus };
  name: string;
  wardId?: string | null;
  ward?: AddressRef | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { assignments: number };
  assignments?: SurveyAssignment[];
}

export interface SurveyAssignment {
  id: string;
  zoneId: string;
  zone: SurveyZone;
  assigneeId: string;
  assignee: { id: string; fullName: string; username: string };
  dueDate?: string | null;
  status: AssignmentStatus;
  note?: string | null;
  submittedAt?: string | null;
  reviewedById?: string | null;
  reviewedBy?: { id: string; fullName: string; username: string } | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdById?: string | null;
  createdBy?: { id: string; fullName: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { houses: number };
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  status?: CampaignStatus;
}

export interface CreateZoneRequest {
  campaignId: string;
  name: string;
  wardId?: string;
  description?: string;
}

export type UpdateZoneRequest = Partial<Omit<CreateZoneRequest, 'campaignId'>>;

export interface CreateAssignmentRequest {
  zoneId: string;
  assigneeId: string;
  dueDate?: string;
  note?: string;
}

export type UpdateAssignmentRequest = Partial<Pick<CreateAssignmentRequest, 'dueDate' | 'note'>>;

// ============================================================
//  Phase 10 — Hồ sơ – quy trình (IX. Quản lý hồ sơ – quy trình)
//  DTO cho /api/house-cases. Lớp theo dõi hành chính mỏng bọc ngoài
//  House/NumberingScheme/SurveyAssignment/HousePlate đã có (Phase 6-9).
// ============================================================

export enum CaseStatus {
  RECEIVED = 'RECEIVED',
  ASSIGNED = 'ASSIGNED',
  REVIEWING = 'REVIEWING',
  SURVEYING = 'SURVEYING',
  NUMBERING = 'NUMBERING',
  APPROVED = 'APPROVED',
  PLATE_ISSUED = 'PLATE_ISSUED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.RECEIVED]: 'Tiếp nhận',
  [CaseStatus.ASSIGNED]: 'Đã phân công',
  [CaseStatus.REVIEWING]: 'Đang thẩm định',
  [CaseStatus.SURVEYING]: 'Đang khảo sát',
  [CaseStatus.NUMBERING]: 'Đang lập phương án',
  [CaseStatus.APPROVED]: 'Đã duyệt / cấp số',
  [CaseStatus.PLATE_ISSUED]: 'Đã cấp biển',
  [CaseStatus.COMPLETED]: 'Đã trả kết quả',
  [CaseStatus.REJECTED]: 'Bị từ chối',
};

export enum CaseRequestType {
  NEW = 'NEW',
  CHANGE = 'CHANGE',
  REISSUE = 'REISSUE',
}

export const CASE_REQUEST_TYPE_LABELS: Record<CaseRequestType, string> = {
  [CaseRequestType.NEW]: 'Cấp số nhà mới',
  [CaseRequestType.CHANGE]: 'Điều chỉnh/đổi số',
  [CaseRequestType.REISSUE]: 'Cấp lại',
};

export interface CaseEvent {
  id: number;
  caseId: string;
  action: string;
  note?: string | null;
  fromStatus?: CaseStatus | null;
  toStatus?: CaseStatus | null;
  actorId?: string | null;
  actor?: { id: string; fullName: string; username: string } | null;
  createdAt: string;
}

export interface HouseCase {
  id: string;
  caseNumber: string;
  applicantName: string;
  applicantPhone?: string | null;
  requestType: CaseRequestType;
  description?: string | null;
  status: CaseStatus;
  houseId?: string | null;
  house?: {
    id: string;
    houseNumber: string;
    street: string;
    ward: string;
    status: HouseStatus;
    qrCode: string;
  } | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; fullName: string; username: string } | null;
  rejectedReason?: string | null;
  createdById?: string | null;
  createdBy?: { id: string; fullName: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Chỉ có ở GET /house-cases/:id. */
  events?: CaseEvent[];
}

export interface CreateCaseRequest {
  applicantName: string;
  applicantPhone?: string;
  requestType?: CaseRequestType;
  description?: string;
}

export type UpdateCaseRequest = Partial<CreateCaseRequest>;

// ============================================================
//  Dashboard tổng quan (nhóm 1 + nhóm 10 "Báo cáo – thống kê", 10.1-10.12).
//  GET /api/dashboard/summary (web + mobile, toàn hệ thống) và
//  GET /api/dashboard/mine (mobile, báo cáo nhanh cá nhân — mobile nhóm 10).
// ============================================================

/**
 * TN-10 — báo cáo hai mức xã → ấp (góp ý khách hàng 11/09/2026, mục Tổng
 * quan). `id: null` = nhóm "Chưa xác định" (hồ sơ chưa gán danh mục địa chỉ
 * tương ứng) — chỉ xuất hiện khi có ít nhất 1 hồ sơ thuộc nhóm đó.
 */
export interface AddressBreakdownItem {
  id: string | null;
  name: string;
  approved: number;
  withoutNumber: number;
}

export interface DashboardSummary {
  /** 10.1 số lượng, 10.4 chưa có số, 10.6 cần điều chỉnh. */
  houses: {
    total: number;
    approved: number;
    pending: number;
    needsAdjust: number;
    /** = pending + needsAdjust (10.4 "báo cáo nhà chưa có số"). */
    withoutNumber: number;
  };
  /** 10.7 đã cấp, 10.8 đã gắn, 10.9 chưa gắn. */
  plates: {
    total: number;
    issued: number;
    installed: number;
    revoked: number;
    /** 10.12 tiến độ gắn biển = installed / total, làm tròn %. */
    installedPct: number;
  };
  cases: {
    total: number;
    open: number;
    completed: number;
    rejected: number;
  };
  /** 10.10 tiến độ khảo sát. */
  surveys: {
    campaignsActive: number;
    assignments: {
      assigned: number;
      inProgress: number;
      submitted: number;
      completed: number;
      needsRevisit: number;
    };
    /** completed / tổng nhiệm vụ, làm tròn %. */
    completedPct: number;
  };
  /** 10.11 tiến độ đánh số. */
  numberingSchemes: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    /** approved / tổng phương án, làm tròn %. */
    approvedPct: number;
  };
  /** 10.2 báo cáo theo địa bàn — top phường/xã nhiều nhà nhất. */
  topWards: { ward: string; houseCount: number }[];
  /** 10.3 báo cáo theo tuyến đường — top đường nhiều nhà nhất (không đổi khi `wardId` được truyền). */
  topStreets: { street: string; houseCount: number }[];
  /**
   * TN-10 — chỉ có khi gọi KHÔNG kèm `wardId`: đủ danh mục xã/phường (kể cả
   * xã 0 nhà), mỗi xã 2 chỉ số (đã cấp số / chưa-chờ cấp số). Thay cho
   * `topWards` (top 5, không đủ) ở khối "Theo xã/phường" khi đang xem toàn tỉnh.
   */
  byWard?: AddressBreakdownItem[];
  /**
   * TN-10 — chỉ có khi gọi KÈM `wardId`: đủ ấp của xã đó (kể cả ấp 0 nhà),
   * mỗi ấp 2 chỉ số.
   */
  byHamlet?: AddressBreakdownItem[];
  /**
   * TN-10 — chỉ có khi gọi KÈM `wardId`: đủ đường của xã đó (kể cả đường 0
   * nhà), mỗi đường 2 chỉ số.
   */
  byStreet?: AddressBreakdownItem[];
  /**
   * 10.5 báo cáo số nhà trùng — nhóm nhà cùng phường/xã + đường + số nhà
   * (>= 2 nhà). `totalGroups` là tổng số nhóm trùng thật (chưa cắt), `groups`
   * chỉ chứa tối đa 20 nhóm trùng nhiều nhất để hiển thị.
   */
  duplicates: {
    totalGroups: number;
    groups: { ward: string; street: string; houseNumber: string; count: number }[];
  };
  /**
   * Phân loại số nhà theo 5 giai đoạn (thiết kế tham khảo UI/2-3.jpg) — độc
   * lập với `houses` (vẫn theo HouseStatus). `pct` làm tròn %.
   */
  reviewStages: {
    total: number;
    byStage: Record<HouseReviewStage, { count: number; pct: number }>;
  };
}

export interface DashboardMine {
  myHouses: {
    total: number;
    withNumber: number;
    withoutNumber: number;
    needsAdjust: number;
  };
  myAssignments: {
    active: number;
    submitted: number;
    completed: number;
    needsRevisit: number;
  };
  platesPendingInstall: number;
  /** Phân loại số nhà DO TÔI TẠO theo 5 giai đoạn — xem DashboardSummary.reviewStages. */
  reviewStages: {
    total: number;
    byStage: Record<HouseReviewStage, { count: number; pct: number }>;
  };
}

/** Tra cứu công khai bằng QR — GET /api/houses/:id/public (không cần đăng nhập). */
export interface PublicHouseSummary {
  id: string;
  houseNumber: string;
  street: string;
  ward: string;
  district?: string | null;
  buildingType: BuildingType;
  status: HouseStatus;
  qrCode: string;
}
