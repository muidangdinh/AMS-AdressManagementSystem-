import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallZoneDto } from './dto/create-zone.dto';
import { UpdateInstallZoneDto } from './dto/update-zone.dto';

const ZONE_INCLUDE = {
  ward: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true, status: true } },
  _count: { select: { assignments: true } },
};

@Injectable()
export class InstallZonesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(campaignId?: string) {
    return this.prisma.installZone.findMany({
      where: { campaignId },
      include: ZONE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOneOrThrow(id: string) {
    const zone = await this.prisma.installZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng thi công');
    return zone;
  }

  async create(dto: CreateInstallZoneDto) {
    const campaign = await this.prisma.installCampaign.findUnique({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt thi công');
    return this.prisma.installZone.create({
      data: { campaignId: dto.campaignId, name: dto.name, wardId: dto.wardId, description: dto.description },
      include: ZONE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateInstallZoneDto) {
    await this.findOneOrThrow(id);
    return this.prisma.installZone.update({ where: { id }, data: dto, include: ZONE_INCLUDE });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    const count = await this.prisma.installAssignment.count({ where: { zoneId: id } });
    if (count > 0) throw new ConflictException('Chỉ xóa được phân vùng chưa giao nhiệm vụ nào');
    await this.prisma.installZone.delete({ where: { id } });
  }
}
