import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InstallAssignmentsService } from './install-assignments.service';
import { CreateInstallAssignmentDto } from './dto/create-assignment.dto';
import { UpdateInstallAssignmentDto } from './dto/update-assignment.dto';
import { ListInstallAssignmentsQueryDto } from './dto/list-assignments-query.dto';
import { ReassignInstallAssignmentDto } from './dto/reassign-assignment.dto';
import { RequestInstallRevisitDto } from './dto/request-revisit.dto';

/**
 * Nhiệm vụ thi công. Đọc mở cho mọi vai trò (mobile cần `?mine=true`); giao/sửa/xóa cần
 * `install:manage`; bắt đầu/gửi duyệt cần `install:execute` (service kiểm tra đúng người được giao);
 * nghiệm thu/yêu cầu thi công lại cần `install:review`.
 */
@Controller('install-assignments')
export class InstallAssignmentsController {
  constructor(private readonly service: InstallAssignmentsService) {}

  @Get()
  findAll(@Query() query: ListInstallAssignmentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(query, user.id);
  }

  /** Danh sách cán bộ thi công để chọn khi giao việc (đặt trước `:id` để không bị bắt nhầm). */
  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Get('installers')
  listInstallers() {
    return this.service.listInstallers();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/plates')
  listPlates(@Param('id') id: string) {
    return this.service.listPlates(id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Post()
  create(@Body() dto: CreateInstallAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstallAssignmentDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Post(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignInstallAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reassign(id, dto.assigneeId, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Post(':id/refresh-plates')
  refreshPlates(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.refreshPlates(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_EXECUTE)
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.start(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_EXECUTE)
  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submit(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_REVIEW)
  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.complete(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_REVIEW)
  @Post(':id/request-revisit')
  requestRevisit(
    @Param('id') id: string,
    @Body() dto: RequestInstallRevisitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.requestRevisit(id, dto, user.id);
  }
}
