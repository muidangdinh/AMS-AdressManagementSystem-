import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';

/** Đợt khảo sát (Phase 9 — VII). Đọc mở cho mọi vai trò, ghi ADMIN & CADASTRAL. */
@Controller('survey-campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query() query: ListCampaignsQueryDto) {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
}
