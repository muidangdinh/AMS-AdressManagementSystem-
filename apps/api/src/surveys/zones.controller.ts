import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ListZonesQueryDto } from './dto/list-zones-query.dto';

/** Phân vùng khảo sát (Phase 9 — VII). Đọc mở cho mọi vai trò, ghi ADMIN & CADASTRAL. */
@Controller('survey-zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  findAll(@Query() query: ListZonesQueryDto) {
    return this.zonesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonesService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Post()
  create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zonesService.remove(id);
  }
}
