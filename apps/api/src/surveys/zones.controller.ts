import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ZonesService } from './zones.service';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { LinkRoutesDto } from './dto/link-routes.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { ListZonesQueryDto } from './dto/list-zones-query.dto';

/** Phân vùng khảo sát (Phase 9 — VII). Đọc mở cho mọi vai trò, ghi ADMIN & CADASTRAL. */
@Controller('survey-zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly routesService: RoutesService,
  ) {}

  @Get()
  findAll(@Query() query: ListZonesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.zonesService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.zonesService.findOne(id, user);
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

  /** Tạo tuyến mới khi lập đợt: tuyến vào kho chung và gắn luôn vào phân vùng này. */
  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Post(':id/routes')
  createRoute(
    @Param('id') id: string,
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.routesService.createInZone(id, dto, user.id);
  }

  /** Chọn tuyến có sẵn trong kho vào phân vùng. */
  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @Post(':id/routes/link')
  linkRoutes(@Param('id') id: string, @Body() dto: LinkRoutesDto) {
    return this.routesService.linkToZone(id, dto.routeIds);
  }

  /** Gỡ tuyến khỏi phân vùng; tuyến vẫn còn trong kho. */
  @RequirePermissions(PERMISSIONS.SURVEY_MANAGE)
  @HttpCode(204)
  @Delete(':id/routes/:routeId')
  unlinkRoute(@Param('id') id: string, @Param('routeId') routeId: string) {
    return this.routesService.unlinkFromZone(id, routeId);
  }
}
