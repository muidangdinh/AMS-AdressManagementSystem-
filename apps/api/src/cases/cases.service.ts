import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, NotificationEntity, NotificationType, Prisma } from '@prisma/client';
import { PERMISSIONS } from '../auth/permissions';
import { usersWithPermission } from '../auth/user-access';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { LinkHouseDto } from './dto/link-house.dto';
import { RejectCaseDto } from './dto/reject-case.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { ListCasesQueryDto } from './dto/list-cases-query.dto';

const CASE_INCLUDE = {
  house: {
    select: {
      id: true,
      houseNumber: true,
      street: true,
      ward: true,
      status: true,
      qrCode: true,
    },
  },
  assignedTo: { select: { id: true, fullName: true, username: true } },
  createdBy: { select: { id: true, fullName: true, username: true } },
} satisfies Prisma.HouseCaseInclude;

/**
 * Các bước theo đúng thứ tự tuyến tính của nhóm 9 (Hồ sơ – quy trình). "Tiến"
 * chỉ đi tới bước kế — không có gate nghiệp vụ phức tạp (validate trùng/số
 * đã có ở module NumberingScheme/HousePlate riêng của nó rồi).
 */
const ORDERED_STATUSES: CaseStatus[] = [
  CaseStatus.RECEIVED,
  CaseStatus.ASSIGNED,
  CaseStatus.REVIEWING,
  CaseStatus.SURVEYING,
  CaseStatus.NUMBERING,
  CaseStatus.APPROVED,
  CaseStatus.PLATE_ISSUED,
  CaseStatus.COMPLETED,
];

/**
 * Hồ sơ – quy trình (Phase 10 — IX). Lớp theo dõi hành chính mỏng bọc ngoài
 * House/NumberingScheme/SurveyAssignment/HousePlate đã có — chỉ liên kết
 * (houseId) + nhãn trạng thái + dòng thời gian (CaseEvent), không viết lại
 * các quy trình đó.
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Danh sách cán bộ xử lý được (có quyền case:manage, đang hoạt động) cho dropdown "phân công".
   * Endpoint riêng, hẹp, chỉ trả id/tên hiển thị — giống listSurveyors() ở surveys module.
   */
  listStaff() {
    return this.prisma.user.findMany({
      where: usersWithPermission(PERMISSIONS.CASE_MANAGE),
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }

  findAll(query: ListCasesQueryDto) {
    const where: Prisma.HouseCaseWhereInput = {
      status: query.status,
      assignedToId: query.assignedToId,
      ...(query.search && {
        OR: [
          { caseNumber: { contains: query.search, mode: 'insensitive' } },
          { applicantName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.houseCase.findMany({
      where,
      include: CASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.houseCase.findUnique({
      where: { id },
      include: {
        ...CASE_INCLUDE,
        events: {
          include: { actor: { select: { id: true, fullName: true, username: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Không tìm thấy hồ sơ');
    return c;
  }

  private async findOneOrThrow(id: string) {
    const c = await this.prisma.houseCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy hồ sơ');
    return c;
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HS-${year}-`;
    const count = await this.prisma.houseCase.count({
      where: { caseNumber: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private async logEvent(
    tx: Prisma.TransactionClient,
    caseId: string,
    action: string,
    actorId: string | undefined,
    extra?: { note?: string; fromStatus?: CaseStatus; toStatus?: CaseStatus },
  ) {
    await tx.caseEvent.create({
      data: {
        caseId,
        action,
        actorId,
        note: extra?.note,
        fromStatus: extra?.fromStatus,
        toStatus: extra?.toStatus,
      },
    });
  }

  async create(dto: CreateCaseDto, userId: string) {
    const caseNumber = await this.generateCaseNumber();
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.houseCase.create({
        data: {
          caseNumber,
          applicantName: dto.applicantName,
          applicantPhone: dto.applicantPhone,
          requestType: dto.requestType,
          description: dto.description,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          createdById: userId,
        },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, created.id, 'RECEIVED', userId, { toStatus: CaseStatus.RECEIVED });
      return created;
    });
  }

  async update(id: string, dto: UpdateCaseDto) {
    await this.findOneOrThrow(id);
    const { dueDate, ...rest } = dto;
    return this.prisma.houseCase.update({
      where: { id },
      data: {
        ...rest,
        // null = xoá hạn; undefined = giữ nguyên.
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
      include: CASE_INCLUDE,
    });
  }

  async assign(id: string, dto: AssignCaseDto, actorId: string) {
    const c = await this.findOneOrThrow(id);
    const assignee = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
    if (!assignee) throw new NotFoundException('Không tìm thấy cán bộ được giao');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseCase.update({
        where: { id },
        data: {
          assignedToId: dto.assignedToId,
          status: c.status === CaseStatus.RECEIVED ? CaseStatus.ASSIGNED : c.status,
        },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, id, 'ASSIGNED', actorId, {
        note: `Giao cho ${assignee.fullName}`,
        fromStatus: c.status,
        toStatus: updated.status,
      });
      await this.notifications.notify(
        {
          userIds: [dto.assignedToId],
          type: NotificationType.ASSIGNED,
          entityType: NotificationEntity.HOUSE_CASE,
          entityId: id,
          title: `Bạn được phân công hồ sơ ${updated.caseNumber}`,
          body: updated.applicantName,
          actorId,
        },
        tx,
      );
      return updated;
    });
  }

  async linkHouse(id: string, dto: LinkHouseDto, actorId: string) {
    await this.findOneOrThrow(id);
    const house = await this.prisma.house.findUnique({ where: { id: dto.houseId } });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseCase.update({
        where: { id },
        data: { houseId: dto.houseId },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, id, 'LINKED_HOUSE', actorId, {
        note: `Liên kết hồ sơ số nhà ${house.houseNumber} ${house.street}`,
      });
      return updated;
    });
  }

  /** Tiến 1 bước theo ORDERED_STATUSES — không tiến được từ COMPLETED/REJECTED. */
  async advance(id: string, actorId: string) {
    const c = await this.findOneOrThrow(id);
    const currentIndex = ORDERED_STATUSES.indexOf(c.status);
    if (currentIndex === -1 || currentIndex === ORDERED_STATUSES.length - 1) {
      throw new ConflictException('Hồ sơ đã ở bước cuối hoặc không ở trạng thái tiến được');
    }

    const nextStatus = ORDERED_STATUSES[currentIndex + 1];
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseCase.update({
        where: { id },
        data: { status: nextStatus },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, id, 'STATUS_CHANGED', actorId, {
        fromStatus: c.status,
        toStatus: nextStatus,
      });
      return updated;
    });
  }

  async reject(id: string, dto: RejectCaseDto, actorId: string) {
    const c = await this.findOneOrThrow(id);
    if (c.status === CaseStatus.COMPLETED || c.status === CaseStatus.REJECTED) {
      throw new ConflictException('Không từ chối được hồ sơ đã hoàn tất hoặc đã bị từ chối');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseCase.update({
        where: { id },
        data: { status: CaseStatus.REJECTED, rejectedReason: dto.reason },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, id, 'REJECTED', actorId, {
        note: dto.reason,
        fromStatus: c.status,
        toStatus: CaseStatus.REJECTED,
      });
      return updated;
    });
  }

  async reopen(id: string, actorId: string) {
    const c = await this.findOneOrThrow(id);
    if (c.status !== CaseStatus.REJECTED) {
      throw new BadRequestException('Chỉ mở lại được hồ sơ đã bị từ chối');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.houseCase.update({
        where: { id },
        data: { status: CaseStatus.RECEIVED, rejectedReason: null },
        include: CASE_INCLUDE,
      });
      await this.logEvent(tx, id, 'REOPENED', actorId, {
        fromStatus: CaseStatus.REJECTED,
        toStatus: CaseStatus.RECEIVED,
      });
      return updated;
    });
  }

  async addNote(id: string, dto: AddNoteDto, actorId: string) {
    await this.findOneOrThrow(id);
    await this.prisma.caseEvent.create({
      data: { caseId: id, action: 'NOTE', note: dto.note, actorId },
    });
    return this.findOne(id);
  }
}
