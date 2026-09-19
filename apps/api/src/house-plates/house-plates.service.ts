import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { HouseStatus, HousePlate, PlateIssueReason, PlateStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
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

      return created;
    });
  }

  /** Xác nhận đã gắn tại hiện trường (mobile 7.6) — cũng đồng bộ House.status = APPROVED. */
  async install(id: string, userId: string, photoUrl?: string) {
    const plate = await this.findOneOrThrow(id);
    if (plate.status !== PlateStatus.ISSUED) {
      throw new ConflictException('Chỉ xác nhận gắn được biển đang ở trạng thái "Đã cấp"');
    }

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

      const house = await tx.house.findUniqueOrThrow({ where: { id: plate.houseId } });
      if (house.status !== HouseStatus.APPROVED) {
        await tx.house.update({
          where: { id: plate.houseId },
          data: { status: HouseStatus.APPROVED },
        });
        await tx.houseHistory.create({
          data: {
            houseId: plate.houseId,
            action: 'UPDATE',
            changes: [
              { field: 'status', old: house.status, new: HouseStatus.APPROVED },
            ] as unknown as Prisma.InputJsonValue,
            changedById: userId,
          },
        });
      }

      return updated;
    });
  }

  /** Ghi nhận chưa gắn được + lý do (mobile 7.7-7.8) — không đổi status, chỉ ghi chú. */
  async markNotInstalled(id: string, dto: NotInstalledPlateDto) {
    const plate = await this.findOneOrThrow(id);
    if (plate.status !== PlateStatus.ISSUED) {
      throw new ConflictException('Chỉ ghi nhận "chưa gắn" cho biển đang ở trạng thái "Đã cấp"');
    }

    return this.prisma.housePlate.update({
      where: { id },
      data: { notInstalledAt: new Date(), notInstalledReason: dto.reason },
      include: PLATE_INCLUDE,
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
