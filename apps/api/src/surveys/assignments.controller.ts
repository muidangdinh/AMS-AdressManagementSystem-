import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { RequestRevisitDto } from './dto/request-revisit.dto';
import { ReportIssueDto } from './dto/report-issue.dto';

/**
 * Giao nhiệm vụ khảo sát (Phase 9 — VII). Đọc mở cho mọi vai trò (mobile cần
 * xem "nhiệm vụ của tôi" — `?mine=true`); giao/sửa/xóa nhiệm vụ ADMIN &
 * CADASTRAL; bắt đầu/gửi duyệt chỉ SURVEYOR (chính chủ nhiệm vụ, service tự
 * kiểm tra); duyệt/yêu cầu khảo sát lại chỉ ADMIN & CADASTRAL.
 */
@Controller('survey-assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  findAll(@Query() query: ListAssignmentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.findAll(query, user.id);
  }

  /** Đặt trước ':id' — không thì Nest khớp "surveyors" vào tham số :id. */
  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Get('surveyors')
  listSurveyors() {
    return this.assignmentsService.listSurveyors();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(id);
  }

  /** Phase 11 Đợt 2b — nhà của nhiệm vụ; `?revisit=true` = chỉ nhà còn cờ khảo sát lại. SURVEYOR chỉ xem nhiệm vụ của mình. */
  @Get(':id/houses')
  listHouses(
    @Param('id') id: string,
    @Query('revisit') revisit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.listHouses(id, user, revisit === 'true');
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post()
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.create(dto, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assignmentsService.remove(id);
  }

  @Roles(Role.SURVEYOR)
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.start(id, user.id);
  }

  @Roles(Role.SURVEYOR)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.submit(id, user.id);
  }

  /** BR-78 — cán bộ được giao báo vấn đề / xin hỗ trợ (không đổi trạng thái nhiệm vụ). */
  @Roles(Role.SURVEYOR)
  @Post(':id/issues')
  reportIssue(@Param('id') id: string, @Body() dto: ReportIssueDto, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.reportIssue(id, dto, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.complete(id, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post(':id/request-revisit')
  requestRevisit(
    @Param('id') id: string,
    @Body() dto: RequestRevisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.requestRevisit(id, dto, user.id);
  }
}
