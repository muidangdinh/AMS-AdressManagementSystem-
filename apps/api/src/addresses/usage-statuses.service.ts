import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateUsageStatusDto } from './dto/create-usage-status.dto';
import { UpdateUsageStatusDto } from './dto/update-usage-status.dto';

const DUPLICATE_MSG = 'Hiện trạng nhà này đã tồn tại';

@Injectable()
export class UsageStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mặc định chỉ trả mục đang bật (cho dropdown); `all` = cả mục ẩn (cho trang quản lý web). */
  findAll(all: boolean) {
    return this.prisma.houseUsageStatus.findMany({
      where: all ? undefined : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.houseUsageStatus.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy hiện trạng nhà');
    return item;
  }

  async create(dto: CreateUsageStatusDto) {
    try {
      return await this.prisma.houseUsageStatus.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, DUPLICATE_MSG);
    }
  }

  async update(id: string, dto: UpdateUsageStatusDto) {
    await this.findOne(id);
    try {
      return await this.prisma.houseUsageStatus.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, DUPLICATE_MSG);
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const used = await this.prisma.house.count({ where: { usageStatusId: id } });
    if (used > 0) {
      throw new ConflictException(
        `Hiện trạng này đang được ${used} nhà sử dụng — không thể xoá (có thể tắt hiển thị thay vì xoá).`,
      );
    }
    await this.prisma.houseUsageStatus.delete({ where: { id } });
  }
}
