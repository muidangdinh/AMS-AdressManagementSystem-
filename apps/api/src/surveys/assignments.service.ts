import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { RequestRevisitDto } from './dto/request-revisit.dto';

const ASSIGNMENT_INCLUDE = {
  zone: {
    include: {
      ward: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true, status: true } },
    },
  },
  assignee: { select: { id: true, fullName: true, username: true } },
  createdBy: { select: { id: true, fullName: true, username: true } },
  reviewedBy: { select: { id: true, fullName: true, username: true } },
  _count: { select: { houses: true } },
} satisfies Prisma.SurveyAssignmentInclude;

/**
 * Giao nhiệm vụ khảo sát (Phase 9 — VII). Vòng đời: ASSIGNED → IN_PROGRESS
 * (SURVEYOR tự bấm bắt đầu) → SUBMITTED (tự gửi duyệt) → COMPLETED /
 * NEEDS_REVISIT (ADMIN/CADASTRAL duyệt cả đợt — tách khỏi duyệt từng House).
 * NEEDS_REVISIT có thể mở lại (start lại) để SURVEYOR khảo sát bổ sung.
 */
@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  findAll(query: ListAssignmentsQueryDto, currentUserId: string) {
    const where: Prisma.SurveyAssignmentWhereInput = {
      zoneId: query.zoneId,
      status: query.status,
      assigneeId: query.mine === 'true' ? currentUserId : query.assigneeId,
      ...(query.campaignId && { zone: { campaignId: query.campaignId } }),
    };
    return this.prisma.surveyAssignment.findMany({
      where,
      include: ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const assignment = await this.prisma.surveyAssignment.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy nhiệm vụ khảo sát');
    return assignment;
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

    return this.prisma.surveyAssignment.create({
      data: {
        zoneId: dto.zoneId,
        assigneeId: dto.assigneeId,
        // Prisma đòi ISO-8601 DateTime đầy đủ (hoặc Date thật) cho cột DateTime — DTO
        // chỉ validate chuỗi ngày ("2026-08-28") hợp lệ, phải tự convert ở đây trước khi
        // truyền vào Prisma, không thì lỗi "premature end of input".
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        note: dto.note,
        createdById: creatorId,
      },
      include: ASSIGNMENT_INCLUDE,
    });
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

    return this.prisma.surveyAssignment.update({
      where: { id },
      data: { status: AssignmentStatus.IN_PROGRESS },
      include: ASSIGNMENT_INCLUDE,
    });
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

    return this.prisma.surveyAssignment.update({
      where: { id },
      data: { status: AssignmentStatus.SUBMITTED, submittedAt: new Date() },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  /** ADMIN/CADASTRAL duyệt cả đợt khảo sát của nhiệm vụ này. */
  async complete(id: string, reviewerId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ duyệt được nhiệm vụ đang chờ duyệt (SUBMITTED)');
    }

    return this.prisma.surveyAssignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.COMPLETED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: null,
      },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  /** ADMIN/CADASTRAL yêu cầu khảo sát lại — SURVEYOR bấm "start" lại để mở IN_PROGRESS. */
  async requestRevisit(id: string, dto: RequestRevisitDto, reviewerId: string) {
    const assignment = await this.findOneOrThrow(id);
    if (assignment.status !== AssignmentStatus.SUBMITTED) {
      throw new ConflictException('Chỉ yêu cầu khảo sát lại với nhiệm vụ đang chờ duyệt (SUBMITTED)');
    }

    return this.prisma.surveyAssignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.NEEDS_REVISIT,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote,
      },
      include: ASSIGNMENT_INCLUDE,
    });
  }
}
