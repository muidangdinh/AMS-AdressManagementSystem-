import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, NotificationEntity, NotificationType, Prisma, Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { RequestRevisitDto } from './dto/request-revisit.dto';
import { ReportIssueDto } from './dto/report-issue.dto';

const ACTOR_SELECT = { select: { id: true, fullName: true, username: true } };

const ASSIGNMENT_INCLUDE = {
  zone: {
    include: {
      ward: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, status: true } },
    },
  },
  assignee: ACTOR_SELECT,
  createdBy: ACTOR_SELECT,
  reviewedBy: ACTOR_SELECT,
  _count: { select: { houses: true } },
} satisfies Prisma.SurveyAssignmentInclude;

/** Chi tiết 1 nhiệm vụ kèm dòng thời gian (theo thứ tự thời gian tăng dần). */
const ASSIGNMENT_DETAIL_INCLUDE = {
  ...ASSIGNMENT_INCLUDE,
  events: { include: { actor: ACTOR_SELECT }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SurveyAssignmentInclude;

/** `action` của SurveyAssignmentEvent — khớp AssignmentEventAction ở packages/shared. */
const EVENT = {
  CREATED: 'CREATED',
  STARTED: 'STARTED',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  REVISIT_REQUESTED: 'REVISIT_REQUESTED',
  ISSUE_REPORTED: 'ISSUE_REPORTED',
  HELP_REQUESTED: 'HELP_REQUESTED',
} as const;

interface EventInput {
  action: string;
  actorId: string;
  fromStatus?: AssignmentStatus;
  toStatus?: AssignmentStatus;
  note?: string;
}

/**
 * Giao nhiệm vụ khảo sát (Phase 9 — VII). Vòng đời: ASSIGNED → IN_PROGRESS
 * (SURVEYOR tự bấm bắt đầu) → SUBMITTED (tự gửi duyệt) → COMPLETED /
 * NEEDS_REVISIT (ADMIN/CADASTRAL duyệt cả đợt — tách khỏi duyệt từng House).
 * NEEDS_REVISIT có thể mở lại (start lại) để SURVEYOR khảo sát bổ sung.
 *
 * Phase 11: mỗi chuyển trạng thái ghi 1 dòng SurveyAssignmentEvent (dòng thời gian) trong cùng
 * transaction, đồng thời gửi thông báo trong app. Cán bộ báo vấn đề/xin hỗ trợ qua `reportIssue`.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Trang web quản lý đợt khảo sát chứa nhiệm vụ này. */
  private link(a: { zone: { campaign: { id: string } } }) {
    return `/houses/surveys/${a.zone.campaign.id}`;
  }

  private label(a: { zone: { name: string } }) {
    return `Khảo sát ${a.zone.name}`;
  }

  /** Gửi thông báo cho người được giao — lỗi gửi không được làm hỏng thao tác nghiệp vụ đã thành công. */
  private async notifyAssignee(
    a: { id: string; assigneeId: string; zone: { campaign: { id: string } } },
    title: string,
    actorId: string,
    body?: string,
    type: NotificationType = NotificationType.STATUS_CHANGED,
  ) {
    await this.notifications
      .notify({
        userIds: [a.assigneeId],
        type,
        entityType: NotificationEntity.SURVEY_ASSIGNMENT,
        entityId: a.id,
        title,
        body,
        actorId,
        link: this.link(a),
      })
      .catch(() => undefined);
  }

  /** Gửi thông báo cho người đã giao nhiệm vụ. */
  private async notifyCreator(
    a: { id: string; createdById: string | null; zone: { campaign: { id: string } } },
    title: string,
    actorId: string,
    body?: string,
    type: NotificationType = NotificationType.STATUS_CHANGED,
  ) {
    // Người giao đã bị xoá liên kết (createdById = null) → báo cho toàn bộ cán bộ quản lý thay vì mất tin.
    const recipients = a.createdById ? [a.createdById] : await this.listStaffIds();
    await this.notifications
      .notify({
        userIds: recipients,
        type,
        entityType: NotificationEntity.SURVEY_ASSIGNMENT,
        entityId: a.id,
        title,
        body,
        actorId,
        link: this.link(a),
      })
      .catch(() => undefined);
  }

  private async listStaffIds(): Promise<string[]> {
    const staff = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.CADASTRAL] }, isActive: true },
      select: { id: true },
    });
    return staff.map((s) => s.id);
  }

  /** Cập nhật nhiệm vụ + ghi 1 dòng thời gian trong cùng transaction. */
  private transition(
    id: string,
    data: Prisma.SurveyAssignmentUpdateInput,
    event: EventInput,
    inTx?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.surveyAssignment.update({
        where: { id },
        data,
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.surveyAssignmentEvent.create({
        data: {
          assignmentId: id,
          action: event.action,
          actorId: event.actorId,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          note: event.note,
        },
      });
      if (inTx) await inTx(tx);
      return updated;
    });
  }

  /** Gắn thêm `revisitPending` (số nhà còn cờ khảo sát lại) cho danh sách nhiệm vụ bằng ĐÚNG 1 truy vấn nhóm. */
  private async withRevisitPending<T extends { id: string }>(rows: T[]): Promise<(T & { revisitPending: number })[]> {
    if (rows.length === 0) return [];
    const groups = await this.prisma.house.groupBy({
      by: ['surveyAssignmentId'],
      where: { surveyAssignmentId: { in: rows.map((r) => r.id) }, revisitReason: { not: null } },
      _count: { _all: true },
    });
    const pending = new Map(groups.map((g) => [g.surveyAssignmentId, g._count._all]));
    return rows.map((r) => ({ ...r, revisitPending: pending.get(r.id) ?? 0 }));
  }

  /**
   * Danh sách SURVEYOR đang hoạt động, cho dropdown "giao nhiệm vụ". `/api/users` yêu cầu ADMIN
   * (quản lý tài khoản đầy đủ), nhưng CADASTRAL cũng cần giao được việc — endpoint riêng, hẹp,
   * chỉ trả id/tên hiển thị, không có dữ liệu tài khoản nhạy cảm.
   */
  listSurveyors() {
    return this.prisma.user.findMany({
      where: { role: Role.SURVEYOR, isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async findAll(query: ListAssignmentsQueryDto, currentUserId: string) {
    const where: Prisma.SurveyAssignmentWhereInput = {
      zoneId: query.zoneId,
      status: query.status,
      assigneeId: query.mine === 'true' ? currentUserId : query.assigneeId,
      ...(query.campaignId && { zone: { campaignId: query.campaignId } }),
    };
    const rows = await this.prisma.surveyAssignment.findMany({
      where,
      include: ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return this.withRevisitPending(rows);
  }

  async findOne(id: string) {
    const assignment = await this.prisma.surveyAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_DETAIL_INCLUDE,
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy nhiệm vụ khảo sát');
    const [withPending] = await this.withRevisitPending([assignment]);
    return withPending;
  }

  /**
   * Danh sách nhà của nhiệm vụ (modal chọn nhà cần khảo sát lại trên web; danh sách nhà cần sửa trên mobile).
   * SURVEYOR chỉ xem được nhiệm vụ của chính mình. `revisitOnly` = chỉ các nhà còn cờ khảo sát lại.
   */
  async listHouses(id: string, user: { id: string; role: Role }, revisitOnly: boolean) {
    const assignment = await this.findOneOrThrow(id);
    if (user.role === Role.SURVEYOR && assignment.assigneeId !== user.id) {
      throw new ForbiddenException('Chỉ xem được nhà của nhiệm vụ được giao cho mình');
    }
    return this.prisma.house.findMany({
      where: { surveyAssignmentId: id, ...(revisitOnly && { revisitReason: { not: null } }) },
      select: {
        id: true,
        houseNumber: true,
        street: true,
        ward: true,
        ownerName: true,
        revisitReason: true,
        revisitRequestedAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async findOneOrThrow(id: string) {
    const assignment = await this.prisma.surveyAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy nhiệm vụ khảo sát');
    return assignment;
  }

  async create(dto: CreateAssignmentDto, creatorId: string) {
    const zone = await this.prisma.surveyZone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng khảo sát');

    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
    if (!assignee) throw new NotFoundException('Không tìm thấy cán bộ được giao');
    if (assignee.role !== Role.SURVEYOR) {
      throw new BadRequestException('Chỉ giao nhiệm vụ khảo sát cho tài khoản vai trò SURVEYOR');
    }
    if (!assignee.isActive) {
      throw new BadRequestException('Tài khoản cán bộ này đã bị vô hiệu hóa');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.surveyAssignment.create({
        data: {
          zoneId: dto.zoneId,
          assigneeId: dto.assigneeId,
          // Prisma đòi ISO-8601 DateTime đầy đủ (hoặc Date thật) cho cột DateTime — DTO
          // chỉ validate chuỗi ngày ("2026-08-28") hợp lệ, phải tự convert ở đây trước khi
          // truyền vào Prisma, không thì lỗi "premature end of input".
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          note: dto.note,
          targetCount: dto.targetCount,
          createdById: creatorId,
        },
        include: ASSIGNMENT_INCLUDE,
      });
      await tx.surveyAssignmentEvent.create({
        data: {
          assignmentId: row.id,
          action: EVENT.CREATED,
          actorId: creatorId,
          toStatus: AssignmentStatus.ASSIGNED,
          note: row.note ?? undefined,
        },
      });
      return row;
    });
    await this.notifyAssignee(
      created,
      `Bạn được giao nhiệm vụ: ${this.label(created)}`,
      creatorId,
      created.note ?? undefined,
      NotificationType.ASSIGNED,
    );
    return created;
  }

  async update(id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.ASSIGNED) {
      throw new ConflictException('Chỉ sửa được nhiệm vụ khi chưa bắt đầu (ASSIGNED)');
    }
    return this.prisma.surveyAssignment.update({
      where: { id },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        note: dto.note,
        // null = bỏ chỉ tiêu; undefined = giữ nguyên.
        targetCount: dto.targetCount,
      },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  async remove(id: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.ASSIGNED) {
      throw new ConflictException('Chỉ xóa được nhiệm vụ khi chưa bắt đầu (ASSIGNED)');
    }
    await this.prisma.surveyAssignment.delete({ where: { id } });
  }

  /** SURVEYOR tự bấm "Bắt đầu khảo sát" — cũng dùng để mở lại NEEDS_REVISIT. */
  async start(id: string, userId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ cán bộ được giao mới bắt đầu được nhiệm vụ này');
    }
    if (
      assignment.status !== AssignmentStatus.ASSIGNED &&
      assignment.status !== AssignmentStatus.NEEDS_REVISIT
    ) {
      throw new ConflictException('Nhiệm vụ này không ở trạng thái có thể bắt đầu');
    }

    const updated = await this.transition(
      id,
      { status: AssignmentStatus.IN_PROGRESS },
      {
        action: EVENT.STARTED,
        actorId: userId,
        fromStatus: assignment.status,
        toStatus: AssignmentStatus.IN_PROGRESS,
      },
    );
    await this.notifyCreator(
      updated,
      `Đã bắt đầu: ${this.label(updated)}`,
      userId,
      `${updated.assignee.fullName} bắt đầu khảo sát.`,
    );
    return updated;
  }

  /** SURVEYOR tự bấm "Gửi duyệt" khi đã khảo sát xong khu vực được giao. */
  async submit(id: string, userId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ cán bộ được giao mới gửi duyệt được nhiệm vụ này');
    }
    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      throw new ConflictException('Chỉ gửi duyệt được nhiệm vụ đang thực hiện (IN_PROGRESS)');
    }

    // BR-84 — còn nhà bị yêu cầu khảo sát lại mà chưa sửa thì chưa được gửi duyệt.
    const pendingRevisit = await this.prisma.house.count({
      where: { surveyAssignmentId: id, revisitReason: { not: null } },
    });
    if (pendingRevisit > 0) {
      throw new ConflictException(
        `Còn ${pendingRevisit} nhà chưa khảo sát lại — hãy sửa xong các nhà được yêu cầu rồi mới gửi duyệt`,
      );
    }

    const houseCount = await this.prisma.house.count({ where: { surveyAssignmentId: id } });
    const target = assignment.targetCount ? ` / chỉ tiêu ${assignment.targetCount}` : '';
    const updated = await this.transition(
      id,
      { status: AssignmentStatus.SUBMITTED, submittedAt: new Date() },
      {
        action: EVENT.SUBMITTED,
        actorId: userId,
        fromStatus: AssignmentStatus.IN_PROGRESS,
        toStatus: AssignmentStatus.SUBMITTED,
        note: `${houseCount} nhà đã khảo sát${target}`,
      },
    );
    await this.notifyCreator(
      updated,
      `Chờ duyệt: ${this.label(updated)}`,
      userId,
      `${updated.assignee.fullName} đã gửi duyệt (${houseCount} nhà${target}).`,
    );
    return updated;
  }

  /** ADMIN/CADASTRAL duyệt cả đợt khảo sát của nhiệm vụ này. */
  async complete(id: string, reviewerId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ duyệt được nhiệm vụ đang chờ duyệt (SUBMITTED)');
    }

    const updated = await this.transition(
      id,
      {
        status: AssignmentStatus.COMPLETED,
        reviewedBy: { connect: { id: reviewerId } },
        reviewedAt: new Date(),
        reviewNote: null,
      },
      {
        action: EVENT.COMPLETED,
        actorId: reviewerId,
        fromStatus: AssignmentStatus.SUBMITTED,
        toStatus: AssignmentStatus.COMPLETED,
      },
    );
    await this.notifyAssignee(updated, `Đã nghiệm thu: ${this.label(updated)}`, reviewerId);
    return updated;
  }

  /** ADMIN/CADASTRAL yêu cầu khảo sát lại — SURVEYOR bấm "start" lại để mở IN_PROGRESS. */
  async requestRevisit(id: string, dto: RequestRevisitDto, reviewerId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ yêu cầu khảo sát lại với nhiệm vụ đang chờ duyệt (SUBMITTED)');
    }

    // Nhà cụ thể cần sửa (nếu có): loại trùng, và mọi nhà phải thuộc nhiệm vụ này (BR-86).
    const picks = [...new Map((dto.houses ?? []).map((h) => [h.houseId, h])).values()];
    if (picks.length > 0) {
      const found = await this.prisma.house.count({
        where: { id: { in: picks.map((p) => p.houseId) }, surveyAssignmentId: id },
      });
      if (found !== picks.length) {
        throw new BadRequestException('Có nhà không thuộc nhiệm vụ khảo sát này');
      }
    }
    const houseNote = picks.length > 0 ? ` (${picks.length} nhà cần sửa)` : '';

    const updated = await this.transition(
      id,
      {
        status: AssignmentStatus.NEEDS_REVISIT,
        reviewedBy: { connect: { id: reviewerId } },
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote,
      },
      {
        action: EVENT.REVISIT_REQUESTED,
        actorId: reviewerId,
        fromStatus: AssignmentStatus.SUBMITTED,
        toStatus: AssignmentStatus.NEEDS_REVISIT,
        note: `${dto.reviewNote}${houseNote}`,
      },
      async (tx) => {
        const now = new Date();
        for (const pick of picks) {
          const reason = pick.reason?.trim() || dto.reviewNote;
          await tx.house.update({
            where: { id: pick.houseId },
            data: { revisitReason: reason, revisitRequestedAt: now },
          });
          await tx.houseHistory.create({
            data: {
              houseId: pick.houseId,
              action: 'REVISIT_REQUESTED',
              changes: [{ field: 'revisitReason', old: null, new: reason }] as unknown as Prisma.InputJsonValue,
              changedById: reviewerId,
            },
          });
        }
      },
    );
    await this.notifyAssignee(
      updated,
      `Cần khảo sát lại: ${this.label(updated)}`,
      reviewerId,
      `${dto.reviewNote}${houseNote}`,
    );
    return updated;
  }

  /**
   * BR-78 — SURVEYOR báo vấn đề hiện trường / xin hỗ trợ. Chỉ ghi dòng thời gian + báo người giao,
   * KHÔNG đổi trạng thái nhiệm vụ. Không báo được khi nhiệm vụ đã hoàn tất.
   */
  async reportIssue(id: string, dto: ReportIssueDto, userId: string) {
    const assignment = await this.prisma.surveyAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy nhiệm vụ khảo sát');
    if (assignment.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ cán bộ được giao mới báo vấn đề cho nhiệm vụ này');
    }
    if (assignment.status === AssignmentStatus.COMPLETED) {
      throw new ConflictException('Nhiệm vụ đã hoàn tất, không báo thêm vấn đề được');
    }

    const isHelp = dto.kind === 'HELP';
    await this.prisma.surveyAssignmentEvent.create({
      data: {
        assignmentId: id,
        action: isHelp ? EVENT.HELP_REQUESTED : EVENT.ISSUE_REPORTED,
        actorId: userId,
        note: dto.note,
      },
    });
    await this.notifyCreator(
      assignment,
      `${isHelp ? 'Cần hỗ trợ' : 'Báo vấn đề'}: ${this.label(assignment)}`,
      userId,
      `${assignment.assignee.fullName}: ${dto.note}`,
      NotificationType.ISSUE_REPORTED,
    );
    return this.findOne(id);
  }
}
