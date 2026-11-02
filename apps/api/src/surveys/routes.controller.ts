import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';

/**
 * Kho tuyến đường. Đọc mở cho mọi vai trò, ghi cần ROUTE_MANAGE vì thay đổi ảnh hưởng mọi đợt đang dùng
 * tuyến. Gắn/gỡ tuyến với phân vùng nằm ở ZonesController (quyền SURVEY_MANAGE).
 */
@Controller('survey-routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  findAll(@Query() query: ListRoutesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routesService.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.ROUTE_MANAGE)
  @Post()
  create(@Body() dto: CreateRouteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.routesService.create(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.ROUTE_MANAGE)
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.routesService.duplicate(id, user.id);
  }

  @RequirePermissions(PERMISSIONS.ROUTE_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROUTE_MANAGE)
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routesService.remove(id);
  }
}
