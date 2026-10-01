import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InstallCampaignsService } from './install-campaigns.service';
import { CreateInstallCampaignDto } from './dto/create-campaign.dto';
import { UpdateInstallCampaignDto } from './dto/update-campaign.dto';
import { ListInstallCampaignsQueryDto } from './dto/list-campaigns-query.dto';

/** Đợt thi công. Đọc mở cho mọi vai trò đăng nhập, ghi cần `install:manage`. */
@Controller('install-campaigns')
export class InstallCampaignsController {
  constructor(private readonly service: InstallCampaignsService) {}

  @Get()
  findAll(@Query() query: ListInstallCampaignsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Post()
  create(@Body() dto: CreateInstallCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstallCampaignDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.INSTALL_MANAGE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
