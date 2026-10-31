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

/** Tuyến đường khảo sát — thuộc 1 phân vùng (xóa phân vùng thì xóa luôn tuyến). */
@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListRoutesQueryDto, user?: AuthenticatedUser) {
    return this.prisma.surveyRoute.findMany({
      where: {
        zoneId: query.zoneId,
        zone: query.campaignId ? { campaignId: query.campaignId } : undefined,
        // Cán bộ khảo sát chỉ thấy tuyến được giao cho mình.
        ...(isSurveyRestricted(user) && { assignments: { some: { assigneeId: user!.id } } }),
      },
      include: ROUTE_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  private async findOneOrThrow(id: string) {
    const route = await this.prisma.surveyRoute.findUnique({ where: { id } });
    if (!route) throw new NotFoundException('Không tìm thấy tuyến đường khảo sát');
    return route;
  }

  private async assertStreet(streetId: string | undefined) {
    if (!streetId) return;
    const street = await this.prisma.street.findUnique({ where: { id: streetId } });
    if (!street) throw new NotFoundException('Không tìm thấy đường trong danh mục');
  }

  async create(dto: CreateRouteDto, userId?: string) {
    if (!isValidPath(dto.path)) {
      throw new BadRequestException('Dữ liệu tuyến (path) không hợp lệ — cần mảng [vĩ độ, kinh độ]');
    }
    const zone = await this.prisma.surveyZone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng khảo sát');
    await this.assertStreet(dto.streetId);

    return this.prisma.surveyRoute.create({
      data: {
        zoneId: dto.zoneId,
        name: dto.name.trim(),
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
      },
      include: ROUTE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findOneOrThrow(id);
    await this.assertStreet(dto.streetId);

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
          throw new ConflictException('Không thể sửa tuyến đã được giao nhiệm vụ');
        }
      }

      return tx.surveyRoute.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          streetId: dto.streetId === undefined ? undefined : dto.streetId || null,
          note: dto.note === undefined ? undefined : dto.note || null,
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

  async remove(id: string) {
    await this.findOneOrThrow(id);
    const [surveyCount, installCount] = await Promise.all([
      this.prisma.surveyAssignment.count({ where: { routeId: id } }),
      this.prisma.installAssignment.count({ where: { routeId: id } }),
    ]);
    const assignmentCount = surveyCount + installCount;
    if (assignmentCount > 0) {
      throw new ConflictException('Tuyến đã được giao nhiệm vụ — xóa nhiệm vụ của tuyến trước');
    }
    await this.prisma.surveyRoute.delete({ where: { id } });
  }
}
