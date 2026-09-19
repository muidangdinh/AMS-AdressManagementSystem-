import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.findOne(id);
    try {
      return await this.prisma.hamlet.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Thôn/ấp/tổ dân phố này đã tồn tại trong xã/phường đã chọn');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.hamlet.delete({ where: { id } });
  }
}
