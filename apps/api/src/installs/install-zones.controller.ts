import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { InstallZonesService } from './install-zones.service';
import { CreateInstallZoneDto } from './dto/create-zone.dto';
import { UpdateInstallZoneDto } from './dto/update-zone.dto';

@Controller('install-zones')
export class InstallZonesController {
  constructor(private readonly service: InstallZonesService) {}

  @Get()
  findAll(@Query('campaignId') campaignId?: string) {
    return this.service.findAll(campaignId);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Post()
  create(@Body() dto: CreateInstallZoneDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstallZoneDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
