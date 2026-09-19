import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { ListWardsQueryDto } from './dto/list-wards-query.dto';

@Injectable()
export class WardsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListWardsQueryDto) {
    const where: Prisma.WardWhereInput = {};
    if (query.districtId) where.districtId = query.districtId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.prisma.ward.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const ward = await this.prisma.ward.findUnique({ where: { id } });
    if (!ward) throw new NotFoundException('Không tìm thấy xã/phường');
    return ward;
  }

  /**
   * `@@unique([name, districtId])` ở schema KHÔNG chặn được trùng tên khi
   * districtId NULL (Postgres coi mỗi NULL là khác nhau trong unique index
   * kết hợp) — mà districtId sẽ NULL ở hầu hết ward vì Tây Ninh không dùng
   * cấp huyện. Nên phải tự kiểm tra trùng ở tầng ứng dụng trước khi ghi.
   */
  private async assertNoDuplicate(name: string, districtId: string | null, excludeId?: string) {
    const existed = await this.prisma.ward.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        districtId,
        name: { equals: name, mode: 'insensitive' },
      },
    });
    if (existed) throw new ConflictException('Xã/phường này đã tồn tại');
  }

  async create(dto: CreateWardDto) {
    await this.assertNoDuplicate(dto.name, dto.districtId ?? null);
    try {
      return await this.prisma.ward.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Xã/phường này đã tồn tại');
    }
  }

  async update(id: string, dto: UpdateWardDto) {
    const current = await this.findOne(id);
    const nextName = dto.name ?? current.name;
    const nextDistrictId = dto.districtId !== undefined ? dto.districtId : current.districtId;
    await this.assertNoDuplicate(nextName, nextDistrictId ?? null, id);
    try {
      return await this.prisma.ward.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Xã/phường này đã tồn tại');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.ward.delete({ where: { id } });
  }
}
