import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from './address-conflict.util';
import { CreateAlleyDto } from './dto/create-alley.dto';
import { UpdateAlleyDto } from './dto/update-alley.dto';
import { ListAlleysQueryDto } from './dto/list-alleys-query.dto';

@Injectable()
export class AlleysService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListAlleysQueryDto) {
    const where: Prisma.AlleyWhereInput = {};
    if (query.streetId) where.streetId = query.streetId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    return this.prisma.alley.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const alley = await this.prisma.alley.findUnique({ where: { id } });
    if (!alley) throw new NotFoundException('Không tìm thấy hẻm/ngõ');
    return alley;
  }

  async create(dto: CreateAlleyDto) {
    try {
      return await this.prisma.alley.create({ data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Hẻm/ngõ này đã tồn tại trong đường/phố đã chọn');
    }
  }

  async update(id: string, dto: UpdateAlleyDto) {
    await this.findOne(id);
    try {
      return await this.prisma.alley.update({ where: { id }, data: dto });
    } catch (err) {
      throwIfUniqueConflict(err, 'Hẻm/ngõ này đã tồn tại trong đường/phố đã chọn');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.alley.delete({ where: { id } });
  }
}
