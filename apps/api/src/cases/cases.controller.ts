import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { LinkHouseDto } from './dto/link-house.dto';
import { RejectCaseDto } from './dto/reject-case.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { ListCasesQueryDto } from './dto/list-cases-query.dto';

/**
 * Hồ sơ – quy trình (Phase 10 — IX). Đọc mở cho mọi vai trò đã đăng nhập;
 * mọi thao tác ghi (tạo/gán/liên kết/tiến bước/từ chối/ghi chú) giới hạn
 * ADMIN & CADASTRAL — đây là công việc tiếp nhận/xử lý hồ sơ ở bộ phận một
 * cửa, không phải việc của SURVEYOR (khảo sát hiện trường qua mobile).
 */
@Controller('house-cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(@Query() query: ListCasesQueryDto) {
    return this.casesService.findAll(query);
  }

  /** Đặt trước ':id' — không thì Nest khớp "staff" vào tham số :id. */
  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Get('staff')
  listStaff() {
    return this.casesService.listStaff();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post()
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.assign(id, dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/link-house')
  linkHouse(
    @Param('id') id: string,
    @Body() dto: LinkHouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.casesService.linkHouse(id, dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/advance')
  advance(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.advance(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.reject(id, dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/reopen')
  reopen(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.reopen(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.CASE_MANAGE)
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.casesService.addNote(id, dto, user.id);
  }
}
