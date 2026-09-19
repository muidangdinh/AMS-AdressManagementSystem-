import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
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

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post()
  create(@Body() dto: CreateSchemeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schemesService.create(dto, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchemeDto) {
    return this.schemesService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schemesService.remove(id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateItemDto) {
    return this.schemesService.addItem(id, dto);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.schemesService.updateItem(id, itemId, dto);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.schemesService.removeItem(id, itemId);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.schemesService.generate(id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.schemesService.submit(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schemesService.approve(id, user.id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectSchemeDto) {
    return this.schemesService.reject(id, dto);
  }
}
