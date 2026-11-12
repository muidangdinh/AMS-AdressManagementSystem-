import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateStreetDto } from './dto/create-street.dto';
import { ResolveUnmatchedStreetDto } from './dto/resolve-unmatched-street.dto';
import { UpdateStreetDto } from './dto/update-street.dto';
import { ListStreetsQueryDto } from './dto/list-streets-query.dto';

@Injectable()
export class StreetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListStreetsQueryDto) {
    const where: Prisma.StreetWhereInput = {};
    if (query.wardId) where.wardId = query.wardId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.prisma.street.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const street = await this.prisma.street.findUnique({ where: { id } });
    if (!street) throw new NotFoundException('Không tìm thấy đường/phố');
    return street;
  }

  private normalizeStreetName(name: string) {
    return name.trim().toLowerCase();
  }

  /** Gộp các biến thể chỉ khác hoa/thường/khoảng trắng thành 1 dòng. */
  async findUnmatchedStreets() {
    const [groups, streets, wards] = await Promise.all([
      this.prisma.house.groupBy({
        by: ['street', 'wardId'],
        where: { street: { not: '' } },
        _count: { _all: true },
      }),
      this.prisma.street.findMany({ select: { name: true, wardId: true } }),
      this.prisma.ward.findMany({ select: { id: true, name: true } }),
    ]);

    const wardKeys = new Set<string>();
    const globalKeys = new Set<string>();
    for (const street of streets) {
      const key = this.normalizeStreetName(street.name);
      if (!key) continue;
      if (street.wardId) wardKeys.add(`${street.wardId}|${key}`);
      else globalKeys.add(key);
    }

    const buckets = new Map<string, { name: string; wardId: string | null; houseCount: number }>();
    for (const group of groups) {
      const name = group.street.trim();
      const key = this.normalizeStreetName(group.street);
      if (!name || !key) continue;
      const bucketKey = `${group.wardId ?? ''}|${key}`;
      const current = buckets.get(bucketKey);
      if (current) current.houseCount += group._count._all;
      else buckets.set(bucketKey, { name, wardId: group.wardId, houseCount: group._count._all });
    }

    const wardNames = new Map(wards.map((ward) => [ward.id, ward.name]));
    return [...buckets.values()]
      .filter((item) => {
        const key = this.normalizeStreetName(item.name);
        if (globalKeys.has(key)) return false;
        return item.wardId ? !wardKeys.has(`${item.wardId}|${key}`) : true;
      })
      .map((item) => ({
        ...item,
        wardName: item.wardId ? wardNames.get(item.wardId) ?? null : null,
      }))
      .sort(
        (a, b) =>
          (a.wardName ?? '').localeCompare(b.wardName ?? '', 'vi') ||
          a.name.localeCompare(b.name, 'vi'),
      );
  }

  private linkHousesToStreet(
    tx: Prisma.TransactionClient,
    sourceName: string,
    wardId: string | null,
    streetId: string,
    targetName: string,
  ) {
    const wardSql = wardId
      ? Prisma.sql`AND "wardId" = ${wardId}`
      : Prisma.sql`AND "wardId" IS NULL`;
    return tx.$executeRaw`
      UPDATE "house"
      SET "streetId" = ${streetId}, street = ${targetName}
      WHERE lower(btrim(street)) = lower(btrim(${sourceName}))
      ${wardSql}
    `;
  }

  async resolveUnmatchedStreet(dto: ResolveUnmatchedStreetDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Tên đường không hợp lệ');
    const wardId = dto.wardId ?? null;

    return this.prisma.$transaction(async (tx) => {
      if (dto.action === 'merge') {
        if (!dto.targetStreetId) {
          throw new BadRequestException('Chọn đường/phố cần gộp');
        }
        const target = await tx.street.findUnique({ where: { id: dto.targetStreetId } });
        if (!target) throw new NotFoundException('Không tìm thấy đường/phố cần gộp');
        if (wardId && target.wardId && target.wardId !== wardId) {
          throw new BadRequestException('Đường/phố cần gộp thuộc xã/phường khác');
        }
        const updatedHouses = await this.linkHousesToStreet(
          tx,
          name,
          wardId,
          target.id,
          target.name,
        );
        return { street: target, updatedHouses };
      }

      const existed = await tx.street.findFirst({
        where: { wardId, name: { equals: name, mode: 'insensitive' } },
      });
      if (existed) {
        throw new ConflictException('Đường/phố này đã tồn tại — chọn "Gộp" thay vì tạo mới');
      }

      const street = await tx.street.create({ data: { name, wardId } });
      const updatedHouses = await this.linkHousesToStreet(tx, name, wardId, street.id, street.name);
      return { street, updatedHouses };
    });
  }

  /** Cùng lý do như WardsService.assertNoDuplicate — wardId có thể NULL. */
  private async assertNoDuplicate(name: string, wardId: string | null, excludeId?: string) {
    const existed = await this.prisma.street.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        wardId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existed) throw new ConflictException('Đường/phố này đã tồn tại trong xã/phường đã chọn');
  }

  async create(dto: CreateStreetDto) {
    await this.assertNoDuplicate(dto.name, dto.wardId ?? null);
    try {
      return await this.prisma.street.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Đường/phố này đã tồn tại trong xã/phường đã chọn');
    }
  }

  async update(id: string, dto: UpdateStreetDto) {
    const current = await this.findOne(id);
    const nextName = dto.name ?? current.name;
    const nextWardId = dto.wardId !== undefined ? dto.wardId : current.wardId;
    await this.assertNoDuplicate(nextName, nextWardId ?? null, id);
    try {
      return await this.prisma.street.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Đường/phố này đã tồn tại trong xã/phường đã chọn');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.street.delete({ where: { id } });
  }
}
