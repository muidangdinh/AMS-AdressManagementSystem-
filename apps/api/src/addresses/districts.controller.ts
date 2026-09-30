import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { DistrictsService } from './districts.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

/**
 * Danh mục quận/huyện (Phase 6 — IV. Quản lý dữ liệu địa chỉ).
 * Đọc (GET) mở cho mọi vai trò đã đăng nhập (cần cho dropdown địa chỉ khi
 * tạo/sửa House); ghi (POST/PATCH/DELETE) giới hạn ADMIN (quản trị danh mục).
 */
@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  findAll() {
    return this.districtsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.districtsService.findOne(id);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Post()
  create(@Body() dto: CreateDistrictDto) {
    return this.districtsService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDistrictDto) {
    return this.districtsService.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ADDRESS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.districtsService.remove(id);
  }
}
