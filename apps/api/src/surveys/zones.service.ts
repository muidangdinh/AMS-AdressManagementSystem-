import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ListZonesQueryDto } from './dto/list-zones-query.dto';

const ZONE_INCLUDE = {
  ward: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, status: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.SurveyZoneInclude;

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListZonesQueryDto) {
    return this.prisma.surveyZone.findMany({
      where: { campaignId: query.campaignId, wardId: query.wardId },
      include: ZONE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const zone = await this.prisma.surveyZone.findUnique({
      where: { id },
      include: ZONE_INCLUDE,
    });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng khảo sát');
    return zone;
  }

  private async findOneOrThrow(id: string) {
    const zone = await this.prisma.surveyZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng khảo sát');
    return zone;
  }

  async create(dto: CreateZoneDto) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id: dto.campaignId },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt khảo sát');

    return this.prisma.surveyZone.create({
      data: {
        campaignId: dto.campaignId,
        name: dto.name,
        wardId: dto.wardId,
        description: dto.description,
      },
      include: ZONE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateZoneDto) {
    await this.findOneOrThrow(id);
    return this.prisma.surveyZone.update({
      where: { id },
      data: dto,
      include: ZONE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    const assignmentCount = await this.prisma.surveyAssignment.count({ where: { zoneId: id } });
    if (assignmentCount > 0) {
      throw new ConflictException('Chỉ xóa được phân vùng chưa giao nhiệm vụ nào');
    }
    await this.prisma.surveyZone.delete({ where: { id } });
  }
}
