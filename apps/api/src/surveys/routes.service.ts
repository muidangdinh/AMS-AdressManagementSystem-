import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { isSurveyRestricted } from './survey-scope';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

export const ROUTE_INCLUDE = {
  street: { select: { id: true, name: true } },
  ward: { select: { id: true, name: true } },
  _count: { select: { zoneLinks: true, assignments: true, installAssignments: true } },
} satisfies Prisma.SurveyRouteInclude;

function isValidPath(path: unknown): path is [number, number][] {
  return (
    Array.isArray(path) &&
    path.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number' &&
        Math.abs(p[0]) <= 90 &&
        Math.abs(p[1]) <= 180,
    )
  );
}

/**
 * Kho tuyến đường dùng chung, quản lý ở phân hệ "Quản lý tuyến đường". Đợt khảo sát tham chiếu tuyến
 * qua `SurveyZoneRoute` thay vì sao chép, nên 2 phân hệ luôn cùng 1 dữ liệu.
 */
@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListRoutesQueryDto, user?: AuthenticatedUser) {
    const search = query.search?.trim();
    return this.prisma.surveyRoute.findMany({
      where: {
        ...(query.zoneId && { zoneLinks: { some: { zoneId: query.zoneId } } }),
        ...(query.campaignId && { zoneLinks: { some: { zone: { campaignId: query.campaignId } } } }),
        ...(query.wardId &&
          (query.includeNoWard === 'true'
            ? { OR: [{ wardId: query.wardId }, { wardId: null }] }
            : { wardId: query.wardId })),
        ...(query.activeOnly === 'true' && { isActive: true }),
        ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
        // Cán bộ khảo sát chỉ thấy tuyến được giao cho mình.
        ...(isSurveyRestricted(user) && { assignments: { some: { assigneeId: user!.id } } }),
      },
      include: ROUTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async findOneOrThrow(id: string) {
    const route = await this.prisma.surveyRoute.findUnique({ where: { id } });
    if (!route) throw new NotFoundException('Không tìm thấy tuyến đường');
    return route;
  }

  private async findZoneOrThrow(zoneId: string) {
    const zone = await this.prisma.surveyZone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng khảo sát');
    return zone;
  }

  private async assertStreet(streetId: string | undefined) {
    if (!streetId) return;
    const street = await this.prisma.street.findUnique({ where: { id: streetId } });
    if (!street) throw new NotFoundException('Không tìm thấy đường trong danh mục');
  }

  private async assertWard(wardId: string | undefined) {
    if (!wardId) return;
    const ward = await this.prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) throw new NotFoundException('Không tìm thấy xã/phường');
  }

  private routeData(dto: CreateRouteDto, userId: string | undefined, wardId: string | null | undefined) {
    if (!isValidPath(dto.path)) {
      throw new BadRequestException('Dữ liệu tuyến (path) không hợp lệ — cần mảng [vĩ độ, kinh độ]');
    }
    return {
      name: dto.name.trim(),
      wardId: wardId || null,
      streetId: dto.streetId || null,
      startLat: dto.startLat,
      startLng: dto.startLng,
      endLat: dto.endLat,
      endLng: dto.endLng,
      path: dto.path,
      lengthM: dto.lengthM,
      snapped: dto.snapped ?? true,
      note: dto.note,
      createdById: userId,
    };
  }

  /** Thêm tuyến vào kho, chưa gắn phân vùng nào. */
  async create(dto: CreateRouteDto, userId?: string) {
    await Promise.all([this.assertStreet(dto.streetId), this.assertWard(dto.wardId)]);
    return this.prisma.surveyRoute.create({
      data: this.routeData(dto, userId, dto.wardId),
      include: ROUTE_INCLUDE,
    });
  }

  /** Tạo tuyến mới ngay khi lập đợt: lưu vào kho rồi gắn luôn vào phân vùng. Xã lấy theo phân vùng nếu có. */
  async createInZone(zoneId: string, dto: CreateRouteDto, userId?: string) {
    const zone = await this.findZoneOrThrow(zoneId);
    await Promise.all([this.assertStreet(dto.streetId), this.assertWard(dto.wardId)]);
    const route = await this.prisma.surveyRoute.create({
      data: {
        ...this.routeData(dto, userId, zone.wardId ?? dto.wardId),
        zoneLinks: { create: { zoneId } },
      },
      include: ROUTE_INCLUDE,
    });
    return { ...route, zoneId };
  }

  /** Gắn tuyến có sẵn trong kho vào phân vùng. Tuyến đã có trong đúng phân vùng này thì bỏ qua. */
  async linkToZone(zoneId: string, routeIds: string[]) {
    const zone = await this.findZoneOrThrow(zoneId);
    const ids = [...new Set(routeIds)];
    const routes = await this.prisma.surveyRoute.findMany({
      where: { id: { in: ids } },
      include: {
        ...ROUTE_INCLUDE,
        zoneLinks: {
          where: { zone: { campaignId: zone.campaignId } },
          select: { zoneId: true, zone: { select: { name: true } } },
        },
      },
    });
    if (routes.length !== ids.length) throw new NotFoundException('Không tìm thấy tuyến đường');

    const toLink: string[] = [];
    for (const route of routes) {
      const inThisCampaign = route.zoneLinks[0];
      if (inThisCampaign?.zoneId === zoneId) continue;
      if (inThisCampaign) {
        throw new ConflictException(
          `Tuyến "${route.name}" đã nằm trong phân vùng "${inThisCampaign.zone.name}" của đợt này`,
        );
      }
      if (!route.isActive) throw new ConflictException(`Tuyến "${route.name}" đã ngừng sử dụng`);
      if (zone.wardId && route.wardId && route.wardId !== zone.wardId) {
        throw new BadRequestException(`Tuyến "${route.name}" không thuộc xã/phường của phân vùng này`);
      }
      toLink.push(route.id);
    }
    await this.prisma.surveyZoneRoute.createMany({
      data: toLink.map((routeId) => ({ zoneId, routeId })),
      skipDuplicates: true,
    });

    const links = await this.prisma.surveyZoneRoute.findMany({
      where: { zoneId, routeId: { in: ids } },
      include: { route: { include: ROUTE_INCLUDE } },
    });
    return links.map((link) => ({ ...link.route, zoneId }));
  }

  /** Gỡ tuyến khỏi phân vùng — tuyến vẫn còn trong kho. */
  async unlinkFromZone(zoneId: string, routeId: string) {
    const link = await this.prisma.surveyZoneRoute.findUnique({
      where: { zoneId_routeId: { zoneId, routeId } },
    });
    if (!link) throw new NotFoundException('Tuyến này không nằm trong phân vùng');

    const [surveyCount, installCount] = await Promise.all([
      this.prisma.surveyAssignment.count({ where: { zoneId, routeId } }),
      // Trang thi công lấy tuyến qua đợt khảo sát, gỡ đi thì nhiệm vụ thi công mất tuyến trên bản đồ.
      this.prisma.installAssignment.count({ where: { routeId } }),
    ]);
    if (surveyCount > 0) {
      throw new ConflictException('Tuyến đã được giao trong phân vùng này — xóa nhiệm vụ của tuyến trước');
    }
    if (installCount > 0) {
      throw new ConflictException('Tuyến đang được dùng cho thi công — không gỡ khỏi phân vùng được');
    }
    await this.prisma.surveyZoneRoute.delete({ where: { zoneId_routeId: { zoneId, routeId } } });
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findOneOrThrow(id);
    await Promise.all([this.assertStreet(dto.streetId), this.assertWard(dto.wardId)]);

    if (dto.wardId) {
      const mismatched = await this.prisma.surveyZoneRoute.count({
        where: { routeId: id, zone: { AND: [{ wardId: { not: null } }, { wardId: { not: dto.wardId } }] } },
      });
      if (mismatched > 0) {
        throw new ConflictException('Tuyến đang nằm trong phân vùng thuộc xã/phường khác — gỡ khỏi phân vùng trước');
      }
    }

    const geometryFields = [
      dto.startLat,
      dto.startLng,
      dto.endLat,
      dto.endLng,
      dto.path,
      dto.lengthM,
      dto.snapped,
    ];
    const hasGeometry = geometryFields.some((value) => value !== undefined);
    if (hasGeometry) {
      if (geometryFields.some((value) => value === undefined) || !isValidPath(dto.path)) {
        throw new BadRequestException('Cần gửi đầy đủ tọa độ, đường đi, độ dài và trạng thái bám đường');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (hasGeometry) {
        const [surveyCount, installCount] = await Promise.all([
          tx.surveyAssignment.count({ where: { routeId: id } }),
          tx.installAssignment.count({ where: { routeId: id } }),
        ]);
        if (surveyCount + installCount > 0) {
          throw new ConflictException('Tuyến đã được giao nhiệm vụ nên không sửa được đường đi — hãy nhân bản tuyến để sửa');
        }
      }

      return tx.surveyRoute.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          wardId: dto.wardId === undefined ? undefined : dto.wardId || null,
          streetId: dto.streetId === undefined ? undefined : dto.streetId || null,
          note: dto.note === undefined ? undefined : dto.note || null,
          isActive: dto.isActive,
          startLat: dto.startLat,
          startLng: dto.startLng,
          endLat: dto.endLat,
          endLng: dto.endLng,
          path: dto.path,
          lengthM: dto.lengthM,
          snapped: dto.snapped,
        },
        include: ROUTE_INCLUDE,
      });
    });
  }

  /** Tạo bản sao chưa gắn phân vùng nào, chưa bị khóa đường đi — cách sửa tuyến đã được giao. */
  async duplicate(id: string, userId?: string) {
    const route = await this.findOneOrThrow(id);
    return this.prisma.surveyRoute.create({
      data: {
        name: `${route.name} (bản sao)`,
        wardId: route.wardId,
        streetId: route.streetId,
        startLat: route.startLat,
        startLng: route.startLng,
        endLat: route.endLat,
        endLng: route.endLng,
        path: route.path as Prisma.InputJsonValue,
        lengthM: route.lengthM,
        snapped: route.snapped,
        note: route.note,
        createdById: userId,
      },
      include: ROUTE_INCLUDE,
    });
  }

  /** Xóa khỏi kho. Tuyến đã dùng thì phải chuyển sang "ngừng sử dụng" để giữ dữ liệu các đợt. */
  async remove(id: string) {
    await this.findOneOrThrow(id);
    const [zoneCount, surveyCount, installCount] = await Promise.all([
      this.prisma.surveyZoneRoute.count({ where: { routeId: id } }),
      this.prisma.surveyAssignment.count({ where: { routeId: id } }),
      this.prisma.installAssignment.count({ where: { routeId: id } }),
    ]);
    if (zoneCount + surveyCount + installCount > 0) {
      throw new ConflictException('Tuyến đang được sử dụng — hãy chuyển sang "Ngừng sử dụng" thay vì xóa');
    }
    await this.prisma.surveyRoute.delete({ where: { id } });
  }
}
