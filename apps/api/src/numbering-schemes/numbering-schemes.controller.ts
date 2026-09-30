import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NumberingSchemesService } from './numbering-schemes.service';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { UpdateSchemeDto } from './dto/update-scheme.dto';
import { ListSchemesQueryDto } from './dto/list-schemes-query.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { RejectSchemeDto } from './dto/reject-scheme.dto';

/**
 * Lập phương án đánh số (Phase 7 — V). Đọc mở cho mọi vai trò đã đăng nhập;
 * soạn thảo (tạo/sửa/thêm-sửa-xóa nhà/sinh số/trình duyệt) dành cho ADMIN &
 * CADASTRAL — giống quyền ghi House. Phê duyệt/từ chối chỉ ADMIN, vì đây là
 * bước xác nhận cuối cùng ghi đè hàng loạt số nhà chính thức.
 */
@Controller('numbering-schemes')
export class NumberingSchemesController {
  constructor(private readonly schemesService: NumberingSchemesService) {}

  @Get()
  findAll(@Query() query: ListSchemesQueryDto) {
    return this.schemesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schemesService.findOne(id);
  }

  @Get(':id/validate')
  validate(@Param('id') id: string) {
    return this.schemesService.validate(id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Post()
  create(@Body() dto: CreateSchemeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schemesService.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchemeDto) {
    return this.schemesService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schemesService.remove(id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateItemDto) {
    return this.schemesService.addItem(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.schemesService.updateItem(id, itemId, dto);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.schemesService.removeItem(id, itemId);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.schemesService.generate(id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_MANAGE)
  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.schemesService.submit(id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_APPROVE)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schemesService.approve(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.SCHEME_APPROVE)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectSchemeDto) {
    return this.schemesService.reject(id, dto);
  }
}
