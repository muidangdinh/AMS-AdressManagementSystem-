import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, CampaignStatus, NotificationEntity, NotificationType, PlateStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../auth/permissions';
import { usersWithPermission } from '../auth/user-access';
import { CreateInstallAssignmentDto } from './dto/create-assignment.dto';
import { UpdateInstallAssignmentDto } from './dto/update-assignment.dto';
import { ListInstallAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { RequestInstallRevisitDto } from './dto/request-revisit.dto';
import { distanceToPathM } from './geo.util';
import { plateStatsFor, statsOrEmpty } from './install-stats';

const ACTOR_SELECT = { select: { id: true, fullName: true, username: true } };

/** Biển có nhà cách tuyến ≤ ngưỡng này (mét) thì được gom vào nhiệm vụ gắn với tuyến đó. */
const ROUTE_RADIUS_M = 150;

export const ASSIGNMENT_BASE_INCLUDE = {
  zone: {
    include: {
      ward: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, status: true } },
    },
  },
  route: {
    select: {
      id: true,
      name: true,
      path: true,
      startLat: true,
      startLng: true,
      endLat: true,
      endLng: true,
      lengthM: true,
      snapped: true,
    },
  },
  assignee: ACTOR_SELECT,
  createdBy: ACTOR_SELECT,
  reviewedBy: ACTOR_SELECT,
} satisfies Prisma.InstallAssignmentInclude;

const ASSIGNMENT_DETAIL_INCLUDE = {
  ...ASSIGNMENT_BASE_INCLUDE,
  events: { include: { actor: ACTOR_SELECT }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InstallAssignmentInclude;

/** Thông tin biển hiển thị trong danh sách biển của nhiệm vụ. */
const PLATE_LIST_INCLUDE = {
  house: {
    select: {
      id: true,
      houseNumber: true,
      street: true,
      ward: true,
      ownerName: true,
      ownerPhone: true,
      latitude: true,
      longitude: true,
    },
  },
} satisfies Prisma.HousePlateInclude;

export const INSTALL_EVENT = {
  CREATED: 'CREATED',
  STARTED: 'STARTED',
  SUBMITTED: 'SUBMITTED',
  COMPLETED: 'COMPLETED',
  REVISIT_REQUESTED: 'REVISIT_REQUESTED',
  REASSIGNED: 'REASSIGNED',
  PLATES_REFRESHED: 'PLATES_REFRESHED',
} as const;

interface EventInput {
  action: string;
  actorId: string;
  fromStatus?: AssignmentStatus;
  toStatus?: AssignmentStatus;
  note?: string;
}

/**
 * Nhiệm vụ thi công gắn biển (tương tự `AssignmentsService` của khảo sát). Vòng đời:
 * ASSIGNED → IN_PROGRESS (cán bộ bấm bắt đầu, hoặc tự chuyển khi gắn biển đầu tiên) → SUBMITTED
 * (gửi duyệt khi mọi biển đã xử lý) → COMPLETED / NEEDS_REVISIT (nghiệm thu). Danh sách biển của
 * nhiệm vụ là `HousePlate.installAssignmentId`; mỗi chuyển trạng thái ghi 1 dòng thời gian +
 * thông báo trong cùng luồng xử lý.
 */
@Injectable()
export class InstallAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private link(a: { zone: { campaignId: string } }) {
    return `/houses/installs/${a.zone.campaignId}`;
  }

  private label(a: { zone: { name: string }; route?: { name: string } | null }) {
    return a.route ? `Thi công tuyến ${a.route.name} (${a.zone.name})` : `Thi công ${a.zone.name}`;
  }

  /** Thông báo cho người được giao — lỗi gửi không làm hỏng thao tác nghiệp vụ đã thành công. */
  private async notifyAssignee(
    a: { id: string; assigneeId: string; zone: { campaignId: string } },
    title: string,
    actorId: string,
    body?: string,
    type: NotificationType = NotificationType.STATUS_CHANGED,
  ) {
    await this.notifications
      .notify({
        userIds: [a.assigneeId],
        type,
        entityType: NotificationEntity.INSTALL_ASSIGNMENT,
        entityId: a.id,
        title,
        body,
        actorId,
        link: this.link(a),
      })
      .catch(() => undefined);
  }

  /** Thông báo cho người giao việc (người tạo; mất liên kết thì báo cho cán bộ có quyền nghiệm thu). */
  private async notifyCreator(
    a: { id: string; createdById: string | null; zone: { campaignId: string } },
    title: string,
    actorId: string,
    body?: string,
  ) {
    const recipients = a.createdById
      ? [a.createdById]
      : (
          await this.prisma.user.findMany({
            where: usersWithPermission(PERMISSIONS.INSTALL_REVIEW),
            select: { id: true },
          })
        ).map((u) => u.id);
    await this.notifications
      .notify({
        userIds: recipients,
        type: NotificationType.STATUS_CHANGED,
        entityType: NotificationEntity.INSTALL_ASSIGNMENT,
        entityId: a.id,
        title,
        body,
        actorId,
        link: this.link(a),
      })
      .catch(() => undefined);
  }

  /** Cập nhật nhiệm vụ + ghi 1 dòng thời gian trong cùng transaction. */
  private transition(id: string, data: Prisma.InstallAssignmentUpdateInput, event: EventInput) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.installAssignment.update({
        where: { id },
        data,
        include: ASSIGNMENT_BASE_INCLUDE,
      });
      await tx.installAssignmentEvent.create({
        data: {
          assignmentId: id,
          action: event.action,
          actorId: event.actorId,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          note: event.note,
        },
      });
      return updated;
    });
  }

  private async findOneOrThrow(id: string) {
    const a = await this.prisma.installAssignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Không tìm thấy nhiệm vụ thi công');
    return a;
  }

  /** Cán bộ có quyền thực hiện thi công (đang hoạt động) — dùng cho danh sách chọn người giao việc. */
  listInstallers() {
    return this.prisma.user.findMany({
      where: usersWithPermission(PERMISSIONS.INSTALL_EXECUTE),
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }

  private async assertAssignable(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roleLinks: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy cán bộ được giao');
    const canExecute = user.roleLinks
      .filter((l) => l.role.isActive)
      .some((l) => l.role.permissions.some((rp) => rp.permission.code === PERMISSIONS.INSTALL_EXECUTE));
    if (!canExecute) {
      throw new BadRequestException('Chỉ giao nhiệm vụ thi công cho tài khoản có quyền thực hiện thi công');
    }
    if (!user.isActive) throw new BadRequestException('Tài khoản cán bộ này đã bị vô hiệu hóa');
    return user;
  }

  async findAll(query: ListInstallAssignmentsQueryDto, currentUserId: string) {
    const rows = await this.prisma.installAssignment.findMany({
      where: {
        zoneId: query.zoneId,
        status: query.status,
        assigneeId: query.mine === 'true' ? currentUserId : query.assigneeId,
        ...(query.campaignId && { zone: { campaignId: query.campaignId } }),
      },
      include: ASSIGNMENT_BASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const stats = await plateStatsFor(this.prisma, rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, stats: statsOrEmpty(stats, r.id) }));
  }

  /** Chi tiết kèm dòng thời gian và thống kê biển. */
  async findOne(id: string) {
    const a = await this.prisma.installAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_DETAIL_INCLUDE,
    });
    if (!a) throw new NotFoundException('Không tìm thấy nhiệm vụ thi công');
    const stats = await plateStatsFor(this.prisma, [id]);
    return { ...a, stats: statsOrEmpty(stats, id) };
  }

  /** Danh sách biển của nhiệm vụ (kèm thông tin nhà) — mobile/web vẽ lên bản đồ và danh sách. */
  async listPlates(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.housePlate.findMany({
      where: { installAssignmentId: id, status: { not: PlateStatus.REVOKED } },
      include: PLATE_LIST_INCLUDE,
      orderBy: [{ house: { street: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  /**
   * Gom biển chờ gắn vào nhiệm vụ: biển ISSUED chưa thuộc nhiệm vụ nào, nhà thuộc xã của phân vùng và
   * (nếu có tuyến) cách tuyến ≤ ROUTE_RADIUS_M. Phân vùng không gắn xã mà cũng không có tuyến thì không
   * có tiêu chí để gom — trả 0 (quản lý thêm biển bằng cách khác ở bước sau). Trả về số biển vừa thêm.
   */
  private async collectPlates(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    wardId: string | null,
    route: { path: Prisma.JsonValue } | null,
  ): Promise<number> {
    if (!wardId && !route) return 0;
    const candidates = await tx.housePlate.findMany({
      where: {
        status: PlateStatus.ISSUED,
        installAssignmentId: null,
        house: wardId ? { wardId } : undefined,
      },
      select: { id: true, house: { select: { latitude: true, longitude: true } } },
    });
    const path = route && Array.isArray(route.path) ? (route.path as [number, number][]) : null;
    const ids = candidates
      .filter((c) => !path || distanceToPathM(c.house.latitude, c.house.longitude, path) <= ROUTE_RADIUS_M)
      .map((c) => c.id);
    if (ids.length === 0) return 0;
    await tx.housePlate.updateMany({ where: { id: { in: ids } }, data: { installAssignmentId: assignmentId } });
    return ids.length;
  }

  async create(dto: CreateInstallAssignmentDto, creatorId: string) {
    const zone = await this.prisma.installZone.findUnique({ where: { id: dto.zoneId } });
    if (!zone) throw new NotFoundException('Không tìm thấy phân vùng thi công');

    let route: { id: string; path: Prisma.JsonValue } | null = null;
    if (dto.routeId) {
      route = await this.prisma.surveyRoute.findUnique({
        where: { id: dto.routeId },
        select: { id: true, path: true },
      });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến đường');
      const taken = await this.prisma.installAssignment.count({ where: { routeId: dto.routeId } });
      if (taken > 0) throw new ConflictException('Tuyến này đã được giao thi công — dùng chức năng giao lại để đổi người');
    }
    await this.assertAssignable(dto.assigneeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.installAssignment.create({
        data: {
          zoneId: dto.zoneId,
          routeId: dto.routeId || undefined,
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          note: dto.note,
          targetCount: dto.targetCount,
          createdById: creatorId,
        },
        include: ASSIGNMENT_BASE_INCLUDE,
      });
      const added = await this.collectPlates(tx, row.id, zone.wardId, route);
      await tx.installAssignmentEvent.create({
        data: {
          assignmentId: row.id,
          action: INSTALL_EVENT.CREATED,
          actorId: creatorId,
          toStatus: AssignmentStatus.ASSIGNED,
          note: `${added} biển được đưa vào nhiệm vụ${row.note ? ` — ${row.note}` : ''}`,
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
    return this.findOne(created.id);
  }

  /**
   * Biển vừa được cấp: tự đưa vào nhiệm vụ thi công đang mở có phạm vi chứa nhà (cùng xã của phân vùng,
   * và nếu có tuyến thì nhà cách tuyến ≤ ROUTE_RADIUS_M). Nhiều nhiệm vụ khớp → chọn nhiệm vụ có tuyến gần
   * nhất (nhiệm vụ chỉ theo xã xếp sau nhiệm vụ có tuyến). Nhiệm vụ đã gửi duyệt/hoàn tất không bị đụng tới.
   * Lỗi ở đây không được làm hỏng việc cấp biển nên nơi gọi tự bắt.
   */
  async attachNewPlate(plateId: string, actorId: string): Promise<void> {
    const plate = await this.prisma.housePlate.findUnique({
      where: { id: plateId },
      include: { house: { select: { wardId: true, latitude: true, longitude: true } } },
    });
    if (!plate || plate.status !== PlateStatus.ISSUED || plate.installAssignmentId) return;

    const open = await this.prisma.installAssignment.findMany({
      where: {
        status: { in: [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS, AssignmentStatus.NEEDS_REVISIT] },
        zone: { campaign: { status: { not: CampaignStatus.COMPLETED } } },
      },
      include: ASSIGNMENT_BASE_INCLUDE,
    });

    let best: (typeof open)[number] | null = null;
    let bestScore = Infinity;
    for (const a of open) {
      if (!a.zone.wardId && !a.route) continue; // không có tiêu chí phạm vi
      if (a.zone.wardId && a.zone.wardId !== plate.house.wardId) continue;
      let score = 1e9; // chỉ theo xã
      if (a.route && Array.isArray(a.route.path)) {
        const d = distanceToPathM(plate.house.latitude, plate.house.longitude, a.route.path as [number, number][]);
        if (d > ROUTE_RADIUS_M) continue;
        score = d;
      }
      if (score < bestScore) {
        best = a;
        bestScore = score;
      }
    }
    if (!best) return;

    await this.prisma.$transaction(async (tx) => {
      // updateMany có điều kiện để 2 lần cấp song song không gán chồng.
      const res = await tx.housePlate.updateMany({
        where: { id: plateId, installAssignmentId: null },
        data: { installAssignmentId: best!.id },
      });
      if (res.count === 0) return;
      await tx.installAssignmentEvent.create({
        data: {
          assignmentId: best!.id,
          action: INSTALL_EVENT.PLATES_REFRESHED,
          actorId,
          note: 'Tự động bổ sung 1 biển mới cấp',
        },
      });
    });
    await this.notifyAssignee(
      best,
      `Có biển mới trong nhiệm vụ: ${this.label(best)}`,
      actorId,
      'Một biển mới cấp nằm trong phạm vi nhiệm vụ đã được thêm vào danh sách của bạn.',
    );
  }

  /** Bổ sung biển mới cấp trong phạm vi vào nhiệm vụ đang mở. */
  async refreshPlates(id: string, actorId: string) {
    const a = await this.prisma.installAssignment.findUnique({
      where: { id },
      include: { zone: true, route: { select: { path: true } } },
    });
    if (!a) throw new NotFoundException('Không tìm thấy nhiệm vụ thi công');
    if (a.status === AssignmentStatus.COMPLETED || a.status === AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Nhiệm vụ đã gửi duyệt/hoàn tất — không bổ sung biển được');
    }
    const added = await this.prisma.$transaction(async (tx) => {
      const n = await this.collectPlates(tx, id, a.zone.wardId, a.route);
      if (n > 0) {
        await tx.installAssignmentEvent.create({
          data: { assignmentId: id, action: INSTALL_EVENT.PLATES_REFRESHED, actorId, note: `Bổ sung ${n} biển` },
        });
      }
      return n;
    });
    return { added };
  }

  /** Đổi người thực hiện — chỉ khi nhiệm vụ chưa bắt đầu (ASSIGNED). Báo cho cả người mới lẫn người cũ. */
  async reassign(id: string, assigneeId: string, actorId: string) {
    const a = await this.prisma.installAssignment.findUnique({
      where: { id },
      include: { assignee: ACTOR_SELECT },
    });
    if (!a) throw new NotFoundException('Không tìm thấy nhiệm vụ thi công');
    if (a.status !== AssignmentStatus.ASSIGNED) {
      throw new ConflictException('Chỉ đổi người được khi nhiệm vụ chưa bắt đầu');
    }
    if (a.assigneeId === assigneeId) throw new BadRequestException('Nhiệm vụ đang giao cho chính cán bộ này');
    const next = await this.assertAssignable(assigneeId);

    const updated = await this.transition(
      id,
      { assignee: { connect: { id: assigneeId } } },
      { action: INSTALL_EVENT.REASSIGNED, actorId, note: `Từ ${a.assignee.fullName} sang ${next.fullName}` },
    );
    await this.notifyAssignee(
      updated,
      `Bạn được giao nhiệm vụ: ${this.label(updated)}`,
      actorId,
      updated.note ?? undefined,
      NotificationType.ASSIGNED,
    );
    await this.notifyAssignee(
      { ...updated, assigneeId: a.assigneeId },
      `Nhiệm vụ đã chuyển cho người khác: ${this.label(updated)}`,
      actorId,
    );
    return updated;
  }

  async update(id: string, dto: UpdateInstallAssignmentDto) {
    const a = await this.findOneOrThrow(id);
    if (a.status !== AssignmentStatus.ASSIGNED) {
      throw new ConflictException('Chỉ sửa được nhiệm vụ khi chưa bắt đầu (ASSIGNED)');
    }
    return this.prisma.installAssignment.update({
      where: { id },
      data: {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        note: dto.note,
        targetCount: dto.targetCount,
      },
      include: ASSIGNMENT_BASE_INCLUDE,
    });
  }

  async remove(id: string) {
    const a = await this.findOneOrThrow(id);
    if (a.status !== AssignmentStatus.ASSIGNED) {
      throw new ConflictException('Chỉ xóa được nhiệm vụ khi chưa bắt đầu (ASSIGNED)');
    }
    // Biển trong nhiệm vụ tự được trả về trạng thái "ngoài nhiệm vụ" (FK SetNull).
    await this.prisma.installAssignment.delete({ where: { id } });
  }

  /** Cán bộ thi công bấm "Bắt đầu" — cũng dùng để mở lại NEEDS_REVISIT. */
  async start(id: string, userId: string) {
    const a = await this.findOneOrThrow(id);
    if (a.assigneeId !== userId) throw new ForbiddenException('Chỉ cán bộ được giao mới bắt đầu được nhiệm vụ này');
    if (a.status !== AssignmentStatus.ASSIGNED && a.status !== AssignmentStatus.NEEDS_REVISIT) {
      throw new ConflictException('Nhiệm vụ này không ở trạng thái có thể bắt đầu');
    }
    const updated = await this.transition(
      id,
      { status: AssignmentStatus.IN_PROGRESS },
      { action: INSTALL_EVENT.STARTED, actorId: userId, fromStatus: a.status, toStatus: AssignmentStatus.IN_PROGRESS },
    );
    await this.notifyCreator(updated, `Đã bắt đầu: ${this.label(updated)}`, userId, `${updated.assignee.fullName} bắt đầu thi công.`);
    return updated;
  }

  /** Gửi duyệt: chỉ khi mọi biển đã được xử lý (gắn hoặc ghi lý do chưa gắn được) và không còn cờ thi công lại. */
  async submit(id: string, userId: string) {
    const a = await this.findOneOrThrow(id);
    if (a.assigneeId !== userId) throw new ForbiddenException('Chỉ cán bộ được giao mới gửi duyệt được nhiệm vụ này');
    if (a.status !== AssignmentStatus.IN_PROGRESS) {
      throw new ConflictException('Chỉ gửi duyệt được nhiệm vụ đang thực hiện (IN_PROGRESS)');
    }
    const st = statsOrEmpty(await plateStatsFor(this.prisma, [id]), id);
    if (st.revisit > 0) {
      throw new ConflictException(`Còn ${st.revisit} biển chưa thi công lại — hãy xử lý xong các biển được yêu cầu`);
    }
    if (st.pending > 0) {
      throw new ConflictException(`Còn ${st.pending} biển chưa xử lý — hãy gắn biển hoặc ghi nhận lý do chưa gắn được`);
    }
    const target = a.targetCount ? ` / chỉ tiêu ${a.targetCount}` : '';
    const updated = await this.transition(
      id,
      { status: AssignmentStatus.SUBMITTED, submittedAt: new Date() },
      {
        action: INSTALL_EVENT.SUBMITTED,
        actorId: userId,
        fromStatus: AssignmentStatus.IN_PROGRESS,
        toStatus: AssignmentStatus.SUBMITTED,
        note: `${st.installed} biển đã gắn, ${st.notInstalled} chưa gắn được${target}`,
      },
    );
    await this.notifyCreator(updated, `Chờ nghiệm thu: ${this.label(updated)}`, userId, `${updated.assignee.fullName} đã gửi duyệt.`);
    return updated;
  }

  /** Nghiệm thu hoàn tất. */
  async complete(id: string, reviewerId: string) {
    const a = await this.findOneOrThrow(id);
    if (a.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ nghiệm thu được nhiệm vụ đã gửi duyệt (SUBMITTED)');
    }
    const updated = await this.transition(
      id,
      { status: AssignmentStatus.COMPLETED, reviewedBy: { connect: { id: reviewerId } }, reviewedAt: new Date(), reviewNote: null },
      { action: INSTALL_EVENT.COMPLETED, actorId: reviewerId, fromStatus: a.status, toStatus: AssignmentStatus.COMPLETED },
    );
    await this.notifyAssignee(updated, `Đã nghiệm thu: ${this.label(updated)}`, reviewerId);
    return updated;
  }

  /**
   * Yêu cầu thi công lại một số biển: các biển được chọn quay về "chờ gắn" (bỏ kết quả gắn cũ) kèm cờ
   * `revisitReason`; nhiệm vụ chuyển NEEDS_REVISIT. Cán bộ gắn lại bằng luồng gắn biển bình thường —
   * mỗi lần gắn/ghi nhận xong thì cờ của biển đó được xóa.
   */
  async requestRevisit(id: string, dto: RequestInstallRevisitDto, reviewerId: string) {
    const a = await this.findOneOrThrow(id);
    if (a.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ yêu cầu thi công lại được nhiệm vụ đã gửi duyệt (SUBMITTED)');
    }
    const ids = [...new Set(dto.plates.map((p) => p.plateId))];
    const plates = await this.prisma.housePlate.findMany({
      where: { id: { in: ids }, installAssignmentId: id, status: { not: PlateStatus.REVOKED } },
      select: { id: true },
    });
    if (plates.length !== ids.length) {
      throw new BadRequestException('Có biển không thuộc nhiệm vụ này (hoặc đã bị thu hồi)');
    }
    const reasons = new Map(dto.plates.map((p) => [p.plateId, p.reason?.trim() || dto.reviewNote]));

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      for (const plateId of ids) {
        await tx.housePlate.update({
          where: { id: plateId },
          data: {
            status: PlateStatus.ISSUED,
            installedAt: null,
            installedById: null,
            installPhotoUrl: null,
            notInstalledAt: null,
            notInstalledReason: null,
            revisitReason: reasons.get(plateId),
            revisitRequestedAt: now,
          },
        });
      }
      const row = await tx.installAssignment.update({
        where: { id },
        data: {
          status: AssignmentStatus.NEEDS_REVISIT,
          reviewedBy: { connect: { id: reviewerId } },
          reviewedAt: now,
          reviewNote: dto.reviewNote,
        },
        include: ASSIGNMENT_BASE_INCLUDE,
      });
      await tx.installAssignmentEvent.create({
        data: {
          assignmentId: id,
          action: INSTALL_EVENT.REVISIT_REQUESTED,
          actorId: reviewerId,
          fromStatus: a.status,
          toStatus: AssignmentStatus.NEEDS_REVISIT,
          note: `${ids.length} biển cần thi công lại — ${dto.reviewNote}`,
        },
      });
      return row;
    });
    await this.notifyAssignee(
      updated,
      `Yêu cầu thi công lại: ${this.label(updated)}`,
      reviewerId,
      `${ids.length} biển cần làm lại — ${dto.reviewNote}`,
      NotificationType.ISSUE_REPORTED,
    );
    return updated;
  }
}
