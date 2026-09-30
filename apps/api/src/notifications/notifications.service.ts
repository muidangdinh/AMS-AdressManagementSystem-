import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationEntity, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RemindDto } from './dto/remind.dto';

export interface NotifyInput {
  userIds: (string | null | undefined)[];
  type: NotificationType;
  entityType: NotificationEntity;
  entityId: string;
  title: string;
  body?: string;
  link?: string;
  actorId?: string;
  /** Khoá chống trùng — mỗi khoá chỉ sinh 1 thông báo cho mỗi người nhận. */
  dedupeKey?: string;
}

/** BR-76 — cùng 1 nhiệm vụ chỉ nhắc thủ công tối đa 1 lần trong khoảng này. */
const MANUAL_REMIND_COOLDOWN_MS = 15 * 60 * 1000;

export const ENTITY_LINKS: Record<NotificationEntity, (id: string) => string> = {
  [NotificationEntity.TASK]: (id) => `/houses/tasks/${id}`,
  [NotificationEntity.SURVEY_ASSIGNMENT]: (id) => `/houses/surveys?assignment=${id}`,
  [NotificationEntity.HOUSE_CASE]: (id) => `/houses/cases/${id}`,
};

/** Thông báo trong app (Phase 11) — dùng chung cho Task, nhiệm vụ khảo sát và hồ sơ hành chính. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo thông báo cho nhiều người nhận. BR-77: không báo cho chính người vừa thao tác.
   * Nhận `tx` để gọi trong `$transaction` của service nghiệp vụ (cùng thành công/thất bại).
   * `skipDuplicates` + `dedupeKey` unique: gọi lặp cùng khoá không sinh thêm.
   */
  async notify(input: NotifyInput, tx?: Prisma.TransactionClient): Promise<number> {
    const recipients = [...new Set(input.userIds.filter((id): id is string => !!id))].filter(
      (id) => id !== input.actorId,
    );
    if (recipients.length === 0) return 0;

    const client = tx ?? this.prisma;
    const result = await client.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        body: input.body,
        link: input.link ?? ENTITY_LINKS[input.entityType](input.entityId),
        actorId: input.actorId,
        // Khoá unique toàn bảng nên phải gắn kèm người nhận.
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : undefined,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  list(userId: string, query: ListNotificationsQueryDto) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly === 'true' && { readAt: null }),
        ...(query.before && { createdAt: { lt: new Date(query.before) } }),
      },
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    // Điều kiện userId: người khác không đánh dấu được thông báo của mình.
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Không tìm thấy thông báo');
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Nhắc thủ công (ADMIN/CADASTRAL) — tự tìm người nhận theo loại đối tượng. */
  async remind(dto: RemindDto, actorId: string) {
    const target = await this.resolveRemindTarget(dto.entityType, dto.entityId);

    const since = new Date(Date.now() - MANUAL_REMIND_COOLDOWN_MS);
    const recent = await this.prisma.notification.findFirst({
      where: {
        type: NotificationType.REMINDER,
        entityType: dto.entityType,
        entityId: dto.entityId,
        createdAt: { gte: since },
      },
    });
    if (recent) {
      throw new ConflictException('Vừa nhắc việc này gần đây, vui lòng thử lại sau 15 phút');
    }

    await this.notify({
      userIds: [target.assigneeId],
      type: NotificationType.REMINDER,
      entityType: dto.entityType,
      entityId: dto.entityId,
      title: `Nhắc việc: ${target.label}`,
      body: dto.message,
      link: target.link,
      actorId,
    });
    return { ok: true };
  }

  private async resolveRemindTarget(
    entityType: NotificationEntity,
    entityId: string,
  ): Promise<{ assigneeId: string; label: string; link?: string }> {
    if (entityType === NotificationEntity.SURVEY_ASSIGNMENT) {
      const a = await this.prisma.surveyAssignment.findUnique({
        where: { id: entityId },
        include: { zone: { select: { name: true, campaignId: true } } },
      });
      if (!a) throw new NotFoundException('Không tìm thấy nhiệm vụ khảo sát');
      return { link: `/houses/surveys/${a.zone.campaignId}`, assigneeId: a.assigneeId, label: `Khảo sát ${a.zone.name}` };
    }
    if (entityType === NotificationEntity.HOUSE_CASE) {
      const c = await this.prisma.houseCase.findUnique({ where: { id: entityId } });
      if (!c) throw new NotFoundException('Không tìm thấy hồ sơ');
      if (!c.assignedToId) throw new BadRequestException('Hồ sơ chưa được phân công cho ai');
      return { assigneeId: c.assignedToId, label: `Hồ sơ ${c.caseNumber}` };
    }
    throw new BadRequestException('Loại đối tượng chưa hỗ trợ nhắc thủ công');
  }
}
