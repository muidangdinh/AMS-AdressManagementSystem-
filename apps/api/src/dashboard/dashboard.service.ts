import { Injectable } from '@nestjs/common';
import {
  AssignmentStatus,
  CampaignStatus,
  CaseStatus,
  HouseStatus,
  HouseReviewStage,
  NumberingSchemeStatus,
  PlateStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

const TOP_WARDS_LIMIT = 5;
const TOP_STREETS_LIMIT = 5;
const DUPLICATE_GROUPS_LIMIT = 20;

/** Nhãn nhóm "Chưa xác định" — hồ sơ chưa gán danh mục địa chỉ tương ứng (TN-10). */
const UNASSIGNED_LABEL = 'Chưa xác định';

export interface AddressBreakdownItem {
  id: string | null;
  name: string;
  approved: number;
  withoutNumber: number;
}

/**
 * Dashboard tổng quan (nhóm 1 — I.1.1-1.7 — và nhóm 10 "Báo cáo – thống kê",
 * 10.1-10.12). Chỉ tổng hợp số liệu đã có sẵn ở các module khác (houses/
 * house-plates/house-cases/surveys/numbering-schemes) bằng groupBy/count —
 * không thêm bảng mới. Bỏ qua có chủ đích 1.8 (bản đồ tổng quan — dùng lại
 * `/houses/geojson` + view bản đồ hiện có ở `/houses`), 1.9 (biểu đồ theo
 * thời gian), 1.10 (cảnh báo dữ liệu bất thường ngoài trùng số) và
 * 10.13-10.15 (xuất Excel/PDF/in bản đồ — đã có xuất Excel riêng ở
 * `/houses/export.xlsx`) — cần thiết kế riêng, ngoài phạm vi các lần thêm
 * dashboard đã làm.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tổng quan toàn hệ thống — dùng cho web `/houses/dashboard` (mọi vai trò đã đăng nhập). */
  async getSummary(query: DashboardSummaryQueryDto = {}) {
    const { wardId } = query;

    const [
      housesByStatus,
      houseReviewStageGroups,
      platesByStatus,
      casesByStatus,
      campaignsActive,
      assignmentsByStatus,
      schemesByStatus,
      wardGroups,
      streetGroups,
      duplicateGroups,
    ] = await Promise.all([
      this.prisma.house.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.house.groupBy({ by: ['reviewStage'], _count: { _all: true } }),
      this.prisma.housePlate.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.houseCase.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.surveyCampaign.count({ where: { status: CampaignStatus.ACTIVE } }),
      this.prisma.surveyAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.numberingScheme.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.house.groupBy({
        by: ['ward'],
        _count: { _all: true },
        orderBy: { _count: { ward: 'desc' } },
        take: TOP_WARDS_LIMIT,
      }),
      // 10.3 — báo cáo theo tuyến đường. Nhóm theo tên đường tự do (giống topWards) —
      // không nhóm theo streetId vì nhiều nhà cũ chưa gán danh mục chuẩn hoá.
      this.prisma.house.groupBy({
        by: ['street'],
        _count: { _all: true },
        orderBy: { _count: { street: 'desc' } },
        take: TOP_STREETS_LIMIT,
      }),
      // 10.5 — báo cáo số nhà trùng. Trùng = cùng phường/xã + đường + số nhà.
      // Không "take" ở đây — cần quét hết để lọc count>1 chính xác (quy mô 1
      // tỉnh, đã có tiền lệ quét hết bảng house ở export/geojson với cap riêng).
      this.prisma.house.groupBy({
        by: ['ward', 'street', 'houseNumber'],
        _count: { _all: true },
      }),
    ]);

    const houses = countByKey(housesByStatus, Object.values(HouseStatus));
    const reviewStages = reviewStageBreakdown(houseReviewStageGroups);
    const plates = countByKey(platesByStatus, Object.values(PlateStatus));
    const cases = countByKey(casesByStatus, Object.values(CaseStatus));
    const assignments = countByKey(assignmentsByStatus, Object.values(AssignmentStatus));
    const schemes = countByKey(schemesByStatus, Object.values(NumberingSchemeStatus));

    const casesOpen =
      cases.total -
      (cases.byStatus[CaseStatus.COMPLETED] ?? 0) -
      (cases.byStatus[CaseStatus.REJECTED] ?? 0);

    const assignmentsDone =
      assignments.byStatus[AssignmentStatus.COMPLETED] ?? 0;

    const duplicates = duplicateGroups
      .filter((g) => g._count._all > 1)
      .sort((a, b) => b._count._all - a._count._all);

    // TN-10 — báo cáo hai mức xã → ấp (góp ý khách hàng 11/09/2026). Có
    // wardId thì trả byHamlet/byStreet (đủ danh mục của xã đó); không có
    // thì trả byWard (gộp theo xã toàn tỉnh) — topWards/topStreets phía
    // trên GIỮ NGUYÊN hành vi cũ (top 5, dạng chữ) cho tương thích ngược.
    const wardBreakdown = wardId
      ? await this.getWardScopedBreakdown(wardId)
      : await this.getWardLevelBreakdown();

    return {
      houses: {
        total: houses.total,
        approved: houses.byStatus[HouseStatus.APPROVED] ?? 0,
        pending: houses.byStatus[HouseStatus.PENDING] ?? 0,
        needsAdjust: houses.byStatus[HouseStatus.NEEDS_ADJUST] ?? 0,
        withoutNumber:
          (houses.byStatus[HouseStatus.PENDING] ?? 0) +
          (houses.byStatus[HouseStatus.NEEDS_ADJUST] ?? 0),
      },
      plates: {
        total: plates.total,
        issued: plates.byStatus[PlateStatus.ISSUED] ?? 0,
        installed: plates.byStatus[PlateStatus.INSTALLED] ?? 0,
        revoked: plates.byStatus[PlateStatus.REVOKED] ?? 0,
        installedPct: pctOf(plates.byStatus[PlateStatus.INSTALLED] ?? 0, plates.total),
      },
      cases: {
        total: cases.total,
        open: casesOpen,
        completed: cases.byStatus[CaseStatus.COMPLETED] ?? 0,
        rejected: cases.byStatus[CaseStatus.REJECTED] ?? 0,
      },
      surveys: {
        campaignsActive,
        assignments: {
          assigned: assignments.byStatus[AssignmentStatus.ASSIGNED] ?? 0,
          inProgress: assignments.byStatus[AssignmentStatus.IN_PROGRESS] ?? 0,
          submitted: assignments.byStatus[AssignmentStatus.SUBMITTED] ?? 0,
          completed: assignmentsDone,
          needsRevisit: assignments.byStatus[AssignmentStatus.NEEDS_REVISIT] ?? 0,
        },
        completedPct: pctOf(assignmentsDone, assignments.total),
      },
      numberingSchemes: {
        total: schemes.total,
        draft: schemes.byStatus[NumberingSchemeStatus.DRAFT] ?? 0,
        submitted: schemes.byStatus[NumberingSchemeStatus.SUBMITTED] ?? 0,
        approved: schemes.byStatus[NumberingSchemeStatus.APPROVED] ?? 0,
        rejected: schemes.byStatus[NumberingSchemeStatus.REJECTED] ?? 0,
        approvedPct: pctOf(schemes.byStatus[NumberingSchemeStatus.APPROVED] ?? 0, schemes.total),
      },
      topWards: wardGroups.map((g) => ({ ward: g.ward, houseCount: g._count._all })),
      topStreets: streetGroups.map((g) => ({ street: g.street, houseCount: g._count._all })),
      duplicates: {
        totalGroups: duplicates.length,
        groups: duplicates.slice(0, DUPLICATE_GROUPS_LIMIT).map((g) => ({
          ward: g.ward,
          street: g.street,
          houseNumber: g.houseNumber,
          count: g._count._all,
        })),
      },
      reviewStages,
      ...wardBreakdown,
    };
  }

  /**
   * TN-10 — khi gọi KÈM `wardId`: đủ ấp/đường của xã đó, kể cả mục 0 nhà.
   * Phạm vi tính là "hồ sơ thuộc xã này" (`house.wardId = wardId`) — cùng
   * phạm vi cho cả byHamlet lẫn byStreet nên tổng 2 chỉ số của mỗi khối đều
   * bằng nhau và bằng tổng số nhà của xã.
   */
  private async getWardScopedBreakdown(
    wardId: string,
  ): Promise<{ byHamlet: AddressBreakdownItem[]; byStreet: AddressBreakdownItem[] }> {
    const [hamlets, streets, houseByHamlet, houseByStreet] = await Promise.all([
      this.prisma.hamlet.findMany({ where: { wardId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.street.findMany({ where: { wardId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.house.groupBy({ by: ['hamletId', 'status'], where: { wardId }, _count: { _all: true } }),
      this.prisma.house.groupBy({ by: ['streetId', 'status'], where: { wardId }, _count: { _all: true } }),
    ]);

    return {
      byHamlet: buildAddressBreakdown(hamlets, houseByHamlet, (g) => g.hamletId),
      byStreet: buildAddressBreakdown(streets, houseByStreet, (g) => g.streetId),
    };
  }

  /**
   * TN-10 — khi gọi KHÔNG kèm `wardId`: đủ danh mục xã/phường toàn tỉnh, kể
   * cả xã 0 nhà, thay cho `topWards` (top 5) ở khối "Theo xã/phường" trên
   * mobile khi đang xem toàn tỉnh.
   */
  private async getWardLevelBreakdown(): Promise<{ byWard: AddressBreakdownItem[] }> {
    const [wards, houseByWard] = await Promise.all([
      this.prisma.ward.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.house.groupBy({ by: ['wardId', 'status'], _count: { _all: true } }),
    ]);

    return { byWard: buildAddressBreakdown(wards, houseByWard, (g) => g.wardId) };
  }

  /**
   * Báo cáo nhanh cá nhân (mobile nhóm 10 — 10.1-10.7). Chỉ tính trên dữ liệu
   * đã đồng bộ lên server (`House.createdById`) — số bản nháp chưa đồng bộ
   * (10.8) lấy từ `AsyncStorage` trên máy, không đi qua API này.
   */
  async getMine(userId: string) {
    const [housesByStatus, myReviewStageGroups, myAssignmentsByStatus, platesIssued] = await Promise.all([
      this.prisma.house.groupBy({
        by: ['status'],
        where: { createdById: userId },
        _count: { _all: true },
      }),
      this.prisma.house.groupBy({
        by: ['reviewStage'],
        where: { createdById: userId },
        _count: { _all: true },
      }),
      this.prisma.surveyAssignment.groupBy({
        by: ['status'],
        where: { assigneeId: userId },
        _count: { _all: true },
      }),
      this.prisma.housePlate.count({ where: { status: PlateStatus.ISSUED } }),
    ]);

    const houses = countByKey(housesByStatus, Object.values(HouseStatus));
    const reviewStages = reviewStageBreakdown(myReviewStageGroups);
    const assignments = countByKey(myAssignmentsByStatus, Object.values(AssignmentStatus));

    return {
      myHouses: {
        total: houses.total,
        withNumber: houses.byStatus[HouseStatus.APPROVED] ?? 0,
        withoutNumber:
          (houses.byStatus[HouseStatus.PENDING] ?? 0) +
          (houses.byStatus[HouseStatus.NEEDS_ADJUST] ?? 0),
        needsAdjust: houses.byStatus[HouseStatus.NEEDS_ADJUST] ?? 0,
      },
      myAssignments: {
        active:
          (assignments.byStatus[AssignmentStatus.ASSIGNED] ?? 0) +
          (assignments.byStatus[AssignmentStatus.IN_PROGRESS] ?? 0),
        submitted: assignments.byStatus[AssignmentStatus.SUBMITTED] ?? 0,
        completed: assignments.byStatus[AssignmentStatus.COMPLETED] ?? 0,
        needsRevisit: assignments.byStatus[AssignmentStatus.NEEDS_REVISIT] ?? 0,
      },
      /** Toàn hệ thống (không riêng của tôi) — biển đang chờ gắn ở bất kỳ nhà nào. */
      platesPendingInstall: platesIssued,
      reviewStages,
    };
  }
}

/** Phần trăm làm tròn (0 khi mẫu số <= 0) — dùng cho các báo cáo tiến độ (10.10-10.12). */
function pctOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Gộp kết quả `groupBy` thành map theo trạng thái + tổng, điền 0 cho trạng thái không xuất hiện. */
function countByKey<S extends string>(
  grouped: { status: S; _count: { _all: number } }[],
  allStatuses: S[],
): { total: number; byStatus: Record<S, number> } {
  const byStatus = Object.fromEntries(allStatuses.map((s) => [s, 0])) as Record<S, number>;
  let total = 0;
  for (const g of grouped) {
    byStatus[g.status] = g._count._all;
    total += g._count._all;
  }
  return { total, byStatus };
}

/**
 * Gộp kết quả `groupBy(['reviewStage'])` thành "Phân loại số nhà" 5 giai
 * đoạn (thiết kế tham khảo UI/2-3.jpg) — độc lập với `countByKey`/`status`
 * vì cần thêm % mỗi giai đoạn ngay trong response.
 */
function reviewStageBreakdown(
  grouped: { reviewStage: HouseReviewStage; _count: { _all: number } }[],
): { total: number; byStage: Record<HouseReviewStage, { count: number; pct: number }> } {
  const counts = Object.fromEntries(
    Object.values(HouseReviewStage).map((s) => [s, 0]),
  ) as Record<HouseReviewStage, number>;
  let total = 0;
  for (const g of grouped) {
    counts[g.reviewStage] = g._count._all;
    total += g._count._all;
  }
  const byStage = Object.fromEntries(
    Object.values(HouseReviewStage).map((s) => [s, { count: counts[s], pct: pctOf(counts[s], total) }]),
  ) as Record<HouseReviewStage, { count: number; pct: number }>;
  return { total, byStage };
}

/**
 * TN-10 — gộp kết quả `groupBy([<khoá địa chỉ>, 'status'])` thành 2 chỉ số
 * (đã cấp số / chưa-chờ cấp số) cho từng mục danh mục, GIỮ ĐỦ mọi mục kể cả
 * 0 nhà (khác `countByKey`/`topWards` chỉ liệt kê mục có mặt trong dữ liệu).
 * Hồ sơ không gán khoá địa chỉ này (`null`) gom vào 1 dòng "Chưa xác định"
 * ở cuối danh sách — chỉ xuất hiện khi có ít nhất 1 hồ sơ thuộc nhóm đó.
 */
function buildAddressBreakdown<G extends { status: HouseStatus; _count: { _all: number } }>(
  catalog: { id: string; name: string }[],
  grouped: G[],
  getKey: (g: G) => string | null,
): AddressBreakdownItem[] {
  const byId = new Map<string, { approved: number; withoutNumber: number }>();
  const unassigned = { approved: 0, withoutNumber: 0 };

  for (const g of grouped) {
    const id = getKey(g);
    const bucket = id ? (byId.get(id) ?? { approved: 0, withoutNumber: 0 }) : unassigned;
    if (g.status === HouseStatus.APPROVED) bucket.approved += g._count._all;
    else bucket.withoutNumber += g._count._all;
    if (id) byId.set(id, bucket);
  }

  const items: AddressBreakdownItem[] = catalog.map((c) => {
    const b = byId.get(c.id) ?? { approved: 0, withoutNumber: 0 };
    return { id: c.id, name: c.name, approved: b.approved, withoutNumber: b.withoutNumber };
  });

  if (unassigned.approved > 0 || unassigned.withoutNumber > 0) {
    items.push({ id: null, name: UNASSIGNED_LABEL, ...unassigned });
  }

  return items;
}
