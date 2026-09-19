import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.district.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const district = await this.prisma.district.findUnique({ where: { id } });
    if (!district) throw new NotFoundException('Không tìm thấy quận/huyện');
    return district;
  }

  async create(dto: CreateDistrictDto) {
    try {
      return await this.prisma.district.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Tên hoặc mã quận/huyện đã tồn tại');
    }
  }

  async update(id: string, dto: UpdateDistrictDto) {
    await this.findOne(id);
    try {
      return await this.prisma.district.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Tên hoặc mã quận/huyện đã tồn tại');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.district.delete({ where: { id } });
  }
}
