import {
  Controller,
  Delete,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AppConfigService } from './app-config.service';
import { brandingLogoMulterOptions } from './branding.multer.config';

/**
 * Quản lý logo header web/app. Tách khỏi AppConfigController vì controller
 * đó có @Public() ở cấp class; các route ghi/xoá dưới đây vẫn phải qua JWT
 * và quyền setting:manage.
 */
@Controller('app-config/branding')
export class BrandingController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Put(':kind')
  @RequirePermissions(PERMISSIONS.SETTING_MANAGE)
  @UseInterceptors(FileInterceptor('file', brandingLogoMulterOptions))
  upload(@Param('kind') kind: string, @UploadedFile() file?: Express.Multer.File) {
    return this.appConfigService.setLogo(kind, file);
  }

  @Delete(':kind')
  @RequirePermissions(PERMISSIONS.SETTING_MANAGE)
  reset(@Param('kind') kind: string) {
    return this.appConfigService.clearLogo(kind);
  }
}
