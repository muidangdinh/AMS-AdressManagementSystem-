import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateHamletDto } from './dto/create-hamlet.dto';
import { UpdateHamletDto } from './dto/update-hamlet.dto';
import { ListHamletsQueryDto } from './dto/list-hamlets-query.dto';

@Injectable()
export class HamletsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListHamletsQueryDto) {
    const where: Prisma.HamletWhereInput = {};
    if (query.wardId) where.wardId = query.wardId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.prisma.hamlet.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const hamlet = await this.prisma.hamlet.findUnique({ where: { id } });
    if (!hamlet) throw new NotFoundException('Không tìm thấy thôn/ấp/tổ dân phố');
    return hamlet;
  }

  async create(dto: CreateHamletDto) {
    try {
      return await this.prisma.hamlet.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Thôn/ấp/tổ dân phố này đã tồn tại trong xã/phường đã chọn');
    }
  }

  async update(id: string, dto: UpdateHamletDto) {
    const current = await this.findOne(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.hamlet.update({ where: { id }, data: dto });
        // Chuyển ấp sang xã khác: nhân sự và phòng ban của ấp đi theo (cột wardId lưu kèm để lọc theo xã).
        if (dto.wardId && dto.wardId !== current.wardId) {
          await tx.user.updateMany({ where: { hamletId: id }, data: { wardId: dto.wardId } });
          await tx.department.updateMany({ where: { hamletId: id }, data: { wardId: dto.wardId } });
        }
        return updated;
      });
    } catch (err) {
      throwIfUniqueConflict(err, 'Thôn/ấp/tổ dân phố này đã tồn tại trong xã/phường đã chọn');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    // Phòng ban của ấp chặn xóa ở DB (onDelete: Restrict) — báo rõ thay vì lỗi 500.
    const departments = await this.prisma.department.count({ where: { hamletId: id } });
    if (departments > 0) {
      throw new ConflictException(
        `Ấp/thôn còn ${departments} phòng ban trong danh mục Phòng ban — xóa hoặc chuyển các phòng ban đó trước`,
      );
    }
    await this.prisma.hamlet.delete({ where: { id } });
  }
}
