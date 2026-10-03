import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { UsageStatusesService } from './usage-statuses.service';
import { CreateUsageStatusDto } from './dto/create-usage-status.dto';
import { UpdateUsageStatusDto } from './dto/update-usage-status.dto';

/** Danh mục "Hiện trạng nhà". Đọc mở cho mọi vai trò đã đăng nhập, ghi cần `address:write`. */
@Controller('usage-statuses')
export class UsageStatusesController {
  constructor(private readonly service: UsageStatusesService) {}

  @Get()
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all === '1' || all === 'true');
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Post()
  create(@Body() dto: CreateUsageStatusDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUsageStatusDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
