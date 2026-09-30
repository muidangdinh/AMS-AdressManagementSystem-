import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { WardsService } from './wards.service';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';
import { ListWardsQueryDto } from './dto/list-wards-query.dto';

/** Danh mục xã/phường (Phase 6 — IV). Đọc mở cho mọi vai trò, ghi chỉ ADMIN. */
@Controller('wards')
export class WardsController {
  constructor(private readonly wardsService: WardsService) {}

  @Get()
  findAll(@Query() query: ListWardsQueryDto) {
    return this.wardsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wardsService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Post()
  create(@Body() dto: CreateWardDto) {
    return this.wardsService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.wardsService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.wardsService.remove(id);
  }
}
