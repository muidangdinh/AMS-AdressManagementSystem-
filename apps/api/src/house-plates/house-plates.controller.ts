import {
  Body,
  Controller,
  Get,
  Param,
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
import { HousePlatesService } from './house-plates.service';
import { IssuePlateDto } from './dto/issue-plate.dto';
import { RevokePlateDto } from './dto/revoke-plate.dto';
import { NotInstalledPlateDto } from './dto/not-installed-plate.dto';
import { ListPlatesQueryDto } from './dto/list-plates-query.dto';
import { platePhotoMulterOptions } from './multer.config';

/**
 * Quản lý biển số nhà (Phase 8 — VI). Đọc mở cho mọi vai trò đã đăng nhập
 * (mobile cần xem "danh sách biển cần gắn"); cấp/thu hồi (thao tác quản trị)
 * giới hạn ADMIN & CADASTRAL; xác nhận gắn/chưa gắn (thao tác hiện trường)
 * mở thêm cho SURVEYOR vì đây là công việc chính của cán bộ khảo sát mobile.
 */
@Controller('house-plates')
export class HousePlatesController {
  constructor(private readonly platesService: HousePlatesService) {}

  @Get()
  findAll(@Query() query: ListPlatesQueryDto) {
    return this.platesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.platesService.findOne(id);
  }

  /** Ảnh QR chỉ mã hóa plateCode (không nhạy cảm) — công khai, giống /houses/:id/qrcode.png. */
  @Public()
  @Get(':id/qrcode.png')
  async qrcode(@Param('id') id: string, @Res() res: Response) {
    const plate = await this.platesService.findOneOrThrow(id);
    const buffer = await this.platesService.getQrPngBuffer(plate);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  }

  @RequirePermissions(PERMISSIONS.PLATE_ISSUE)
  @Post()
  issue(@Body() dto: IssuePlateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platesService.issue(dto, user.id);
  }

  @RequirePermissions(PERMISSIONS.PLATE_INSTALL)
  @Post(':id/install')
  @UseInterceptors(FileInterceptor('file', platePhotoMulterOptions))
  install(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const photoUrl = file ? `/uploads/plates/${file.filename}` : undefined;
    return this.platesService.install(id, user.id, photoUrl);
  }

  @RequirePermissions(PERMISSIONS.PLATE_INSTALL)
  @Post(':id/not-installed')
  markNotInstalled(@Param('id') id: string, @Body() dto: NotInstalledPlateDto) {
    return this.platesService.markNotInstalled(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PLATE_REVOKE)
  @Post(':id/revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokePlateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.platesService.revoke(id, dto, user.id);
  }
}
