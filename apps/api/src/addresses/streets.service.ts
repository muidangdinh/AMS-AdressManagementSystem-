import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateStreetDto } from './dto/create-street.dto';
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
