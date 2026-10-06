import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { AssignmentStatus, HouseStatus, HousePlate, PlateIssueReason, PlateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InstallAssignmentsService } from '../installs/install-assignments.service';
import { IssuePlateDto } from './dto/issue-plate.dto';
import { RevokePlateDto } from './dto/revoke-plate.dto';
import { NotInstalledPlateDto } from './dto/not-installed-plate.dto';
import { ListPlatesQueryDto } from './dto/list-plates-query.dto';

const PLATE_INCLUDE = {
  house: {
    select: {
      id: true,
      houseNumber: true,
      street: true,
      ward: true,
      ownerName: true,
      latitude: true,
      longitude: true,
      status: true,
    },
  },
} satisfies Prisma.HousePlateInclude;

/** Biển đang "hiệu lực" = đã cấp nhưng chưa bị thu hồi (chờ gắn hoặc đã gắn). */
const ACTIVE_STATUSES: PlateStatus[] = [PlateStatus.ISSUED, PlateStatus.INSTALLED];

/**
 * Quản lý biển số nhà như tài sản riêng (Phase 8 — VI). Mỗi House có 0..n
 * HousePlate theo thời gian; tại 1 thời điểm chỉ 1 biển ACTIVE_STATUSES.
 * Cấp đổi/cấp lại tự thu hồi biển cũ trong cùng transaction với cấp biển mới.
 */
@Injectable()
export class HousePlatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly installAssignments: InstallAssignmentsService,
  ) {}

  findAll(query: ListPlatesQueryDto) {
    const where: Prisma.HousePlateWhereInput = {
      status: query.status,
      houseId: query.houseId,
      ...(query.search && {
        OR: [
          { plateCode: { contains: query.search, mode: 'insensitive' } },
          { house: { houseNumber: { contains: query.search, mode: 'insensitive' } } },
          { house: { ownerName: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    return this.prisma.housePlate.findMany({
      where,
      include: PLATE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  findAllForHouse(houseId: string) {
    return this.prisma.housePlate.findMany({
      where: { houseId },
      include: PLATE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const plate = await this.prisma.housePlate.findUnique({
      where: { id },
      include: PLATE_INCLUDE,
    });
    if (!plate) throw new NotFoundException('Không tìm thấy biển số');
    return plate;
  }

  async findOneOrThrow(id: string): Promise<HousePlate> {
    const plate = await this.prisma.housePlate.findUnique({ where: { id } });
    if (!plate) throw new NotFoundException('Không tìm thấy biển số');
    return plate;
  }

  private getActivePlate(houseId: string) {
    return this.prisma.housePlate.findFirst({
      where: { houseId, status: { in: ACTIVE_STATUSES } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Tự duyệt nhà (House.status → APPROVED) nếu chưa duyệt, kèm ghi `approvedAt` (Ngày cấp) và
   * lịch sử — dùng chung cho lúc CẤP biển (`issue`, điểm tự duyệt chính) và lúc xác nhận GẮN biển
   * (`install`, giữ làm lưới an toàn cho trường hợp hiếm nhà bị đổi khỏi APPROVED giữa chừng).
   * Không đụng gì nếu nhà đã APPROVED từ trước (giữ nguyên `approvedAt` gốc).
   */
  private async approveHouseIfNeeded(
    tx: Prisma.TransactionClient,
    houseId: string,
    userId: string,
  ) {
    const house = await tx.house.findUniqueOrThrow({ where: { id: houseId } });
    if (house.status === HouseStatus.APPROVED) return;

    await tx.house.update({
      where: { id: houseId },
      data: { status: HouseStatus.APPROVED, approvedAt: new Date() },
    });
    await tx.houseHistory.create({
      data: {
        houseId,
        action: 'UPDATE',
        changes: [
          { field: 'status', old: house.status, new: HouseStatus.APPROVED },
        ] as unknown as Prisma.InputJsonValue,
        changedById: userId,
      },
    });
  }

  /** Cấp biển mới / cấp đổi / cấp lại (6.2-6.4) — 1 endpoint, phân biệt bằng `reason`. */
  async issue(dto: IssuePlateDto, userId: string) {
    const houseId = dto.houseId;
    const house = await this.prisma.house.findUnique({ where: { id: houseId } });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');

    const reason = dto.reason ?? PlateIssueReason.NEW;
    const activePlate = await this.getActivePlate(houseId);

    if (activePlate && reason === PlateIssueReason.NEW) {
      throw new ConflictException(
        'Nhà này đã có biển đang hiệu lực — dùng "Cấp đổi" hoặc "Cấp lại" thay vì cấp mới',
      );
    }

    const plateCode = `TN-P-${randomUUID().split('-')[0].toUpperCase()}`;

    const created = await this.prisma.$transaction(async (tx) => {
      if (activePlate && reason !== PlateIssueReason.NEW) {
        await tx.housePlate.update({
          where: { id: activePlate.id },
          data: {
            status: PlateStatus.REVOKED,
            revokedAt: new Date(),
            revokedById: userId,
            revokedReason: dto.note ?? `Thu hồi tự động do ${reason === PlateIssueReason.REPLACEMENT ? 'cấp đổi' : 'cấp lại'} biển mới`,
          },
        });
      }

      const created = await tx.housePlate.create({
        data: {
          plateCode,
          houseId,
          issueReason: reason,
          issuedById: userId,
        },
        include: PLATE_INCLUDE,
      });

      // Cấp biển xong coi như số nhà đã hoàn tất — tự duyệt luôn, không cần đợi tới lúc gắn biển.
      await this.approveHouseIfNeeded(tx, houseId, userId);

      return created;
    });

    // Biển mới cấp tự vào nhiệm vụ thi công đang mở có phạm vi chứa nhà (lỗi không ảnh hưởng việc cấp biển).
    await this.installAssignments.attachNewPlate(created.id, userId).catch(() => undefined);
    return created;
  }

  /**
   * Biển thuộc nhiệm vụ thi công thì chỉ cán bộ được giao (hoặc người quản lý thi công) mới thao tác
   * được; biển ngoài nhiệm vụ giữ luồng tự do như trước.
   */
  private async assertInstallOwner(plate: HousePlate, userId: string, isManager: boolean) {
    if (!plate.installAssignmentId || isManager) return;
    const a = await this.prisma.installAssignment.findUnique({
      where: { id: plate.installAssignmentId },
      select: { assigneeId: true },
    });
    if (a && a.assigneeId !== userId) {
      throw new ForbiddenException('Biển này thuộc nhiệm vụ thi công của cán bộ khác');
    }
  }

  /**
   * Sau khi cán bộ xử lý 1 biển của nhiệm vụ (gắn / ghi nhận chưa gắn được): xóa cờ "thi công lại" của
   * biển và tự chuyển nhiệm vụ sang IN_PROGRESS nếu chưa bắt đầu (hoặc đang ở NEEDS_REVISIT = mở lại).
   */
  private async touchInstallAssignment(tx: Prisma.TransactionClient, plate: HousePlate, userId: string) {
    if (!plate.installAssignmentId) return;
    await tx.housePlate.update({
      where: { id: plate.id },
      data: { revisitReason: null, revisitRequestedAt: null },
    });
    const a = await tx.installAssignment.findUnique({ where: { id: plate.installAssignmentId } });
    if (a && (a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.NEEDS_REVISIT)) {
      await tx.installAssignment.update({ where: { id: a.id }, data: { status: AssignmentStatus.IN_PROGRESS } });
      await tx.installAssignmentEvent.create({
        data: {
          assignmentId: a.id,
          action: 'STARTED',
          actorId: userId,
          fromStatus: a.status,
          toStatus: AssignmentStatus.IN_PROGRESS,
          note: 'Tự động bắt đầu khi xử lý biển đầu tiên',
        },
      });
    }
  }

  /** Xác nhận đã gắn tại hiện trường (mobile 7.6) — cũng đồng bộ House.status = APPROVED. */
  async install(id: string, userId: string, photoUrl?: string, isInstallManager = false) {
    const plate = await this.findOneOrThrow(id);
    if (plate.status !== PlateStatus.ISSUED) {
      throw new ConflictException('Chỉ xác nhận gắn được biển đang ở trạng thái "Đã cấp"');
    }
    await this.assertInstallOwner(plate, userId, isInstallManager);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.housePlate.update({
        where: { id },
        data: {
          status: PlateStatus.INSTALLED,
          installedAt: new Date(),
          installedById: userId,
          installPhotoUrl: photoUrl,
        },
        include: PLATE_INCLUDE,
      });

      // Lưới an toàn — bình thường nhà đã được duyệt từ lúc cấp biển (`issue`) rồi.
      await this.approveHouseIfNeeded(tx, plate.houseId, userId);
      await this.touchInstallAssignment(tx, plate, userId);

      return updated;
    });
  }

  /** Ghi nhận chưa gắn được + lý do (mobile 7.7-7.8) — không đổi status, chỉ ghi chú. */
  async markNotInstalled(id: string, dto: NotInstalledPlateDto, userId: string, isInstallManager = false) {
    const plate = await this.findOneOrThrow(id);
    if (plate.status !== PlateStatus.ISSUED) {
      throw new ConflictException('Chỉ ghi nhận "chưa gắn" cho biển đang ở trạng thái "Đã cấp"');
    }
    await this.assertInstallOwner(plate, userId, isInstallManager);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.housePlate.update({
        where: { id },
        data: { notInstalledAt: new Date(), notInstalledReason: dto.reason },
        include: PLATE_INCLUDE,
      });
      await this.touchInstallAssignment(tx, plate, userId);
      return updated;
    });
  }

  async revoke(id: string, dto: RevokePlateDto, userId: string) {
    const plate = await this.findOneOrThrow(id);
    if (plate.status === PlateStatus.REVOKED) {
      throw new ConflictException('Biển này đã bị thu hồi trước đó');
    }

    return this.prisma.housePlate.update({
      where: { id },
      data: {
        status: PlateStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: userId,
        revokedReason: dto.reason,
      },
      include: PLATE_INCLUDE,
    });
  }

  async getQrPngBuffer(plate: Pick<HousePlate, 'plateCode'>): Promise<Buffer> {
    return QRCode.toBuffer(plate.plateCode, { type: 'png', width: 300, margin: 1 });
  }
}
