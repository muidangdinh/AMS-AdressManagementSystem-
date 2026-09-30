import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { HamletsService } from './hamlets.service';
import { CreateHamletDto } from './dto/create-hamlet.dto';
import { UpdateHamletDto } from './dto/update-hamlet.dto';
import { ListHamletsQueryDto } from './dto/list-hamlets-query.dto';

/** Danh mục thôn/ấp/tổ dân phố (Phase 6 — IV). Đọc mở cho mọi vai trò, ghi chỉ ADMIN. */
@Controller('hamlets')
export class HamletsController {
  constructor(private readonly hamletsService: HamletsService) {}

  @Get()
  findAll(@Query() query: ListHamletsQueryDto) {
    return this.hamletsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hamletsService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Post()
  create(@Body() dto: CreateHamletDto) {
    return this.hamletsService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHamletDto) {
    return this.hamletsService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.hamletsService.remove(id);
  }
}
