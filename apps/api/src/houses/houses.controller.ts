import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { HousesService } from './houses.service';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { UpdateHouseLocationDto } from './dto/update-house-location.dto';
import { UpdateHouseNumberDto } from './dto/update-house-number.dto';
import { ResurveyHouseDto } from './dto/resurvey-house.dto';
import { ListHousesQueryDto } from './dto/list-houses-query.dto';
import { GeoJsonQueryDto } from './dto/geojson-query.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { DeleteHouseDto } from './dto/delete-house.dto';
import { DeleteHousesDto } from './dto/delete-houses.dto';
import { housePhotoMulterOptions } from './multer.config';

/**
 * Quản lý CSDL số nhà (II). Đọc (GET) mở cho mọi vai trò đã đăng nhập;
 * ghi (POST/PATCH/upload ảnh) giới hạn ADMIN & CADASTRAL (cán bộ địa chính).
 */
@Controller('houses')
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  @Get()
  findAll(@Query() query: ListHousesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.findAll(query, user);
  }

  /**
   * Lớp dữ liệu cho bản đồ (Phase 3 — I). Đặt TRƯỚC ':id' vì Nest khớp
   * route theo thứ tự khai báo — nếu để sau, ':id' sẽ nuốt mất "geojson".
   */
  @Get('geojson')
  findAllGeoJson(@Query() query: GeoJsonQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.findAllGeoJson(query, user);
  }

  /** Tra cứu theo tọa độ/bán kính (PostGIS ST_DWithin) — cũng phải đặt trước ':id'. */
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.findNearby(query, user);
  }

  /** Gợi ý chủ hộ theo tên/SĐT (form khảo sát mobile) — cũng phải đặt trước ':id'. */
  @Get('owners')
  searchOwners(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
    return this.housesService.searchOwners(q, user);
  }

  /** Thống kê dashboard (Phase 5 — IX) — cũng phải đặt trước ':id'. */
  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.housesService.getStats(user);
  }

  /** Xuất Excel theo bộ lọc hiện tại (Phase 5 — IX) — cũng phải đặt trước ':id'. */
  @Get('export.xlsx')
  async exportExcel(
    @Query() query: GeoJsonQueryDto,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const buffer = await this.housesService.exportToExcel(query, user);
    const filename = `danh-sach-so-nha-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.findOne(id, user);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.getHistory(id, user);
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
  @RequirePermissions(PERMISSIONS.HOUSE_CREATE)
  @Post()
  create(@Body() dto: CreateHouseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.HOUSE_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.update(id, dto, user);
  }

  /** Sửa riêng số nhà — non-admin chỉ được trong 48 giờ kể từ lúc tạo hồ sơ. */
  @RequirePermissions(PERMISSIONS.HOUSE_NUMBER_UPDATE)
  @Patch(':id/number')
  updateNumber(
    @Param('id') id: string,
    @Body() dto: UpdateHouseNumberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.update(id, { houseNumber: dto.houseNumber }, user);
  }

  /** Chỉnh riêng tọa độ GPS sau khi đối chiếu thực địa (mobile kéo chấm nhà). */
  @RequirePermissions(PERMISSIONS.HOUSE_LOCATION_UPDATE)
  @Patch(':id/location')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateHouseLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.updateLocation(id, dto, user);
  }

  /**
   * Phase 11 Đợt 2b — cán bộ khảo sát sửa lại đúng nhà bị yêu cầu khảo sát lại (BR-85). PATCH ở trên vẫn
   * chỉ ADMIN/CADASTRAL; service tự kiểm tra nhà có cờ, đúng người được giao, nhiệm vụ đang thực hiện.
   */
  @RequirePermissions(PERMISSIONS.HOUSE_RESURVEY)
  @Post(':id/resurvey')
  resurvey(
    @Param('id') id: string,
    @Body() dto: ResurveyHouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.resurvey(id, dto, user.id);
  }

  // Cùng lý do với create() ở trên — surveyStore.syncDraft() upload ảnh ngay sau khi tạo House.
  @RequirePermissions(PERMISSIONS.HOUSE_PHOTO_ADD)
  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('file', housePhotoMulterOptions))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.addPhoto(id, file, type, user);
  }

  @RequirePermissions(PERMISSIONS.HOUSE_DELETE)
  @Delete()
  @HttpCode(204)
  removeMany(@Body() dto: DeleteHousesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.housesService.removeMany(dto.ids, dto.confirmation, user);
  }

  @RequirePermissions(PERMISSIONS.HOUSE_DELETE)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id') id: string,
    @Body() dto: DeleteHouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.remove(id, dto.confirmation, user);
  }

  @RequirePermissions(PERMISSIONS.HOUSE_PHOTO_DELETE)
  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.housesService.removePhoto(id, photoId, user);
  }
}
