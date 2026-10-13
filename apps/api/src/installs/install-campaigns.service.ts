import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallCampaignDto } from './dto/create-campaign.dto';
import { UpdateInstallCampaignDto } from './dto/update-campaign.dto';
import { ListInstallCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { ASSIGNMENT_BASE_INCLUDE } from './install-assignments.service';
import { plateStatsFor, statsOrEmpty } from './install-stats';
import { isInstallRestricted } from './install-scope';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

const USER_SELECT = { select: { id: true, fullName: true, username: true } };

/** Đợt thi công gắn biển (tương tự đợt khảo sát). */
@Injectable()
export class InstallCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListInstallCampaignsQueryDto, user?: AuthenticatedUser) {
    return this.prisma.installCampaign.findMany({
      where: {
        status: query.status,
        // Cán bộ thi công chỉ thấy đợt có nhiệm vụ giao cho mình.
        ...(isInstallRestricted(user) && {
          zones: { some: { assignments: { some: { assigneeId: user!.id } } } },
        }),
      },
      include: { createdBy: USER_SELECT, _count: { select: { zones: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Chi tiết đợt: phân vùng → nhiệm vụ (kèm thống kê biển). */
  async findOne(id: string, user?: AuthenticatedUser) {
    const restricted = isInstallRestricted(user);
    const campaign = await this.prisma.installCampaign.findUnique({
      where: { id },
      include: {
        createdBy: USER_SELECT,
        zones: {
          include: {
            ward: { select: { id: true, name: true } },
            assignments: {
              where: restricted ? { assigneeId: user!.id } : undefined,
              include: ASSIGNMENT_BASE_INCLUDE,
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt thi công');
    // Không có nhiệm vụ nào của mình trong đợt → coi như không tồn tại (không lộ đợt của người khác).
    if (restricted && !campaign.zones.some((z) => z.assignments.length > 0)) {
      throw new NotFoundException('Không tìm thấy đợt thi công');
    }
    if (restricted) campaign.zones = campaign.zones.filter((z) => z.assignments.length > 0);

    const ids = campaign.zones.flatMap((z) => z.assignments.map((a) => a.id));
    const stats = await plateStatsFor(this.prisma, ids);
    return {
      ...campaign,
      zones: campaign.zones.map((z) => ({
        ...z,
        assignments: z.assignments.map((a) => ({ ...a, stats: statsOrEmpty(stats, a.id) })),
      })),
    };
  }

  private async findOneOrThrow(id: string) {
    const campaign = await this.prisma.installCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Không tìm thấy đợt thi công');
    return campaign;
  }

  create(dto: CreateInstallCampaignDto, userId: string) {
    return this.prisma.installCampaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        // Prisma đòi ISO-8601 đầy đủ cho cột DateTime — DTO chỉ validate chuỗi ngày.
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: UpdateInstallCampaignDto) {
    await this.findOneOrThrow(id);
    return this.prisma.installCampaign.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    const zoneCount = await this.prisma.installZone.count({ where: { campaignId: id } });
    if (zoneCount > 0) throw new ConflictException('Chỉ xóa được đợt thi công chưa có phân vùng nào');
    await this.prisma.installCampaign.delete({ where: { id } });
  }
}
