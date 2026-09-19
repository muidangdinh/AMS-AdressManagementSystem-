import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwIfUniqueConflict } from '../addresses/address-conflict.util';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListCampaignsQueryDto) {
    return this.prisma.surveyCampaign.findMany({
      where: { status: query.status },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        _count: { select: { zones: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
        zones: {
          include: {
            ward: { select: { id: true, name: true } },
            assignments: {
              include: {
                assignee: { select: { id: true, fullName: true, username: true } },
                _count: { select: { houses: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt khảo sát');
    return campaign;
  }

  private async findOneOrThrow(id: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt khảo sát');
    return campaign;
  }

  async create(dto: CreateCampaignDto, userId: string) {
    return this.prisma.surveyCampaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        // Prisma đòi ISO-8601 DateTime đầy đủ (hoặc Date thật) cho cột DateTime — DTO
        // chỉ validate chuỗi ngày ("2026-08-28") hợp lệ, phải tự convert ở đây trước khi
        // truyền vào Prisma, không thì lỗi "premature end of input".
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    await this.findOneOrThrow(id);
    try {
      return await this.prisma.surveyCampaign.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          status: dto.status,
        },
      });
    } catch (err) {
      throwIfUniqueConflict(err, 'Không cập nhật được đợt khảo sát');
    }
  }

  async remove(id: string) {
    const campaign = await this.findOneOrThrow(id);
    const zoneCount = await this.prisma.surveyZone.count({ where: { campaignId: id } });
    if (zoneCount > 0) {
      throw new ConflictException('Chỉ xóa được đợt khảo sát chưa có phân vùng nào');
    }
    await this.prisma.surveyCampaign.delete({ where: { id } });
    return campaign;
  }
}
