import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssignmentStatus, CaseStatus, NotificationEntity, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { dueDateKey, effectiveDeadline, todayVn } from './deadline.util';

/** Một việc còn mở có hạn — dạng chung để quét gộp cho mọi loại đối tượng. */
interface DueItem {
  entityType: NotificationEntity;
  entityId: string;
  label: string;
  dueDate: Date;
  assigneeId: string | null;
  ownerId: string | null;
  /** Ghi đè đường dẫn mặc định của loại đối tượng (nhiệm vụ khảo sát mở trang đợt). */
  link?: string;
}

const RETENTION_DAYS = 90;

/**
 * Nhắc hạn định kỳ (BR-75). Mỗi mốc nhắc sinh đúng 1 lần nhờ `dedupeKey`:
 *  - DUE_SOON: 1 lần cho mỗi (đối tượng, ngày hạn) khi còn ≤ REMINDER_DUE_SOON_HOURS.
 *  - OVERDUE: người nhận 1 lần/ngày; người giao 1 lần duy nhất cho mỗi (đối tượng, ngày hạn).
 * Đổi hạn ⇒ khoá mới ⇒ chu kỳ nhắc tính lại.
 */
@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private get dueSoonMs() {
    const hours = Number(process.env.REMINDER_DUE_SOON_HOURS ?? 24);
    return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3600 * 1000;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledScan() {
    try {
      await this.scanDeadlines();
    } catch (err) {
      // Job nền lỗi không được làm sập API.
      this.logger.error('Quét nhắc hạn thất bại', err as Error);
    }
  }

  async scanDeadlines() {
    const items = await this.loadOpenItems();
    const now = new Date();
    const today = todayVn(now);
    let dueSoon = 0;
    let overdue = 0;

    for (const item of items) {
      const remaining = effectiveDeadline(item.dueDate).getTime() - now.getTime();
      const dueKey = dueDateKey(item.dueDate);
      const base = `${item.entityType}:${item.entityId}:${dueKey}`;

      if (remaining < 0) {
        overdue += await this.notifications.notify({
          userIds: [item.assigneeId],
          type: NotificationType.OVERDUE,
          entityType: item.entityType,
          entityId: item.entityId,
          link: item.link,
          title: `Quá hạn: ${item.label}`,
          body: `Hạn xử lý là ${dueKey}.`,
          dedupeKey: `OVERDUE:${base}:${today}`,
        });
        overdue += await this.notifications.notify({
          userIds: [item.ownerId],
          type: NotificationType.OVERDUE,
          entityType: item.entityType,
          entityId: item.entityId,
          link: item.link,
          title: `Việc giao đã quá hạn: ${item.label}`,
          body: `Hạn xử lý là ${dueKey}.`,
          dedupeKey: `OVERDUE_OWNER:${base}`,
        });
      } else if (remaining <= this.dueSoonMs) {
        dueSoon += await this.notifications.notify({
          userIds: [item.assigneeId],
          type: NotificationType.DUE_SOON,
          entityType: item.entityType,
          entityId: item.entityId,
          link: item.link,
          title: `Sắp đến hạn: ${item.label}`,
          body: `Hạn xử lý là ${dueKey}.`,
          dedupeKey: `DUE_SOON:${base}`,
        });
      }
    }

    if (dueSoon || overdue) this.logger.log(`Nhắc hạn: ${dueSoon} sắp đến hạn, ${overdue} quá hạn`);
    return { scanned: items.length, dueSoon, overdue };
  }

  private async loadOpenItems(): Promise<DueItem[]> {
    const [assignments, cases] = await Promise.all([
      this.prisma.surveyAssignment.findMany({
        where: {
          dueDate: { not: null },
          status: {
            in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS, AssignmentStatus.NEEDS_REVISIT],
          },
        },
        include: { zone: { select: { name: true, campaignId: true } } },
      }),
      this.prisma.houseCase.findMany({
        where: {
          dueDate: { not: null },
          assignedToId: { not: null },
          status: { notIn: [CaseStatus.COMPLETED, CaseStatus.REJECTED] },
        },
      }),
    ]);

    return [
      ...assignments.map((a) => ({
        entityType: NotificationEntity.SURVEY_ASSIGNMENT,
        entityId: a.id,
        label: `Khảo sát ${a.zone.name}`,
        dueDate: a.dueDate as Date,
        assigneeId: a.assigneeId,
        ownerId: a.createdById,
        link: `/houses/surveys/${a.zone.campaignId}`,
      })),
      ...cases.map((c) => ({
        entityType: NotificationEntity.HOUSE_CASE,
        entityId: c.id,
        label: `Hồ sơ ${c.caseNumber}`,
        dueDate: c.dueDate as Date,
        assigneeId: c.assignedToId,
        ownerId: c.createdById,
      })),
    ];
  }

  /** BR-79 — xoá thông báo đã đọc quá 90 ngày. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeOld() {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
      const { count } = await this.prisma.notification.deleteMany({
        where: { readAt: { not: null, lt: cutoff } },
      });
      if (count) this.logger.log(`Đã xoá ${count} thông báo đã đọc quá ${RETENTION_DAYS} ngày`);
    } catch (err) {
      this.logger.error('Dọn thông báo cũ thất bại', err as Error);
    }
  }
}
