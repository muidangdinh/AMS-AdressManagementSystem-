import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AlleysService } from './alleys.service';
import { CreateAlleyDto } from './dto/create-alley.dto';
import { UpdateAlleyDto } from './dto/update-alley.dto';
import { ListAlleysQueryDto } from './dto/list-alleys-query.dto';

/** Danh mục hẻm/ngõ (Phase 6 — IV). Đọc mở cho mọi vai trò, ghi chỉ ADMIN. */
@Controller('alleys')
export class AlleysController {
  constructor(private readonly alleysService: AlleysService) {}

  @Get()
  findAll(@Query() query: ListAlleysQueryDto) {
    return this.alleysService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alleysService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Post()
  create(@Body() dto: CreateAlleyDto) {
    return this.alleysService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAlleyDto) {
    return this.alleysService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.alleysService.remove(id);
  }
}
