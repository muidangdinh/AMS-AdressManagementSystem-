import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { HousesService } from './houses.service';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { ListHousesQueryDto } from './dto/list-houses-query.dto';
import { GeoJsonQueryDto } from './dto/geojson-query.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { housePhotoMulterOptions } from './multer.config';

/**
 * Quản lý CSDL số nhà (II). Đọc (GET) mở cho mọi vai trò đã đăng nhập;
 * ghi (POST/PATCH/upload ảnh) giới hạn ADMIN & CADASTRAL (cán bộ địa chính).
 */
@Controller('houses')
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  @Get()
  findAll(@Query() query: ListHousesQueryDto) {
    return this.housesService.findAll(query);
  }

  /**
   * Lớp dữ liệu cho bản đồ (Phase 3 — I). Đặt TRƯỚC ':id' vì Nest khớp
   * route theo thứ tự khai báo — nếu để sau, ':id' sẽ nuốt mất "geojson".
   */
  @Get('geojson')
  findAllGeoJson(@Query() query: GeoJsonQueryDto) {
    return this.housesService.findAllGeoJson(query);
  }

  /** Tra cứu theo tọa độ/bán kính (PostGIS ST_DWithin) — cũng phải đặt trước ':id'. */
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto) {
    return this.housesService.findNearby(query);
  }

  /** Thống kê dashboard (Phase 5 — IX) — cũng phải đặt trước ':id'. */
  @Get('stats')
  getStats() {
    return this.housesService.getStats();
  }

  /** Xuất Excel theo bộ lọc hiện tại (Phase 5 — IX) — cũng phải đặt trước ':id'. */
  @Get('export.xlsx')
  async exportExcel(@Query() query: GeoJsonQueryDto, @Res() res: Response) {
    const buffer = await this.housesService.exportToExcel(query);
    const filename = `danh-sach-so-nha-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.housesService.findOne(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.housesService.getHistory(id);
  }

  /**
   * Ảnh QR chỉ mã hóa 1 chuỗi định danh không nhạy cảm, phục vụ mục đích
   * in lên biển số nhà để BẤT KỲ AI cũng quét được (không cần đăng nhập) —
   * vì vậy route này công khai, khác với các route khác trong controller.
   */
  @Public()
  @Get(':id/qrcode.png')
  async qrcode(@Param('id') id: string, @Res() res: Response) {
    const house = await this.housesService.findOneOrThrow(id);
    const buffer = await this.housesService.getQrPngBuffer(house);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  /**
   * Trang tra cứu công khai quét mã QR trên biển số (Phase 10 — XI.11.6).
   * Công khai như qrcode.png ở trên — chỉ trả field không nhạy cảm, xem
   * housesService.findPublicSummary().
   */
  @Public()
  @Get(':id/public')
  findPublic(@Param('id') id: string) {
    return this.housesService.findPublicSummary(id);
  }

  // SURVEYOR được tạo hồ sơ (không được sửa/xoá ảnh — xem update/removePhoto bên dưới) vì đây
  // chính là endpoint mobile SurveyScreen/surveyStore.syncDraft() gọi để đồng bộ hồ sơ khảo sát.
  // Thiếu SURVEYOR ở đây là lỗi có sẵn từ trước Phase 9 — khiến cán bộ khảo sát chưa bao giờ
  // đồng bộ hồ sơ lên server thành công được (chỉ lưu offline mãi mãi).
  @Roles(Role.ADMIN, Role.CADASTRAL, Role.SURVEYOR)
  @Post()
  create(@Body() dto: CreateHouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.create(dto, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.update(id, dto, user.id);
  }

  // Cùng lý do với create() ở trên — surveyStore.syncDraft() upload ảnh ngay sau khi tạo House.
  @Roles(Role.ADMIN, Role.CADASTRAL, Role.SURVEYOR)
  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file', housePhotoMulterOptions))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.addPhoto(id, file, type, user.id);
  }

  @Roles(Role.ADMIN, Role.CADASTRAL)
  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.removePhoto(id, photoId, user.id);
  }
}
