import { Body, Controller, Patch } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AppConfigService } from './app-config.service';
import { UpdateMapSettingsDto } from './dto/update-map-settings.dto';

/**
 * Cấu hình bản đồ toàn hệ thống (trang web Hệ thống → Cấu hình bản đồ). Tách khỏi
 * AppConfigController vì controller đó có @Public() ở cấp class; route ghi dưới đây vẫn phải
 * qua JWT và quyền setting:manage. Giá trị đọc ra qua GET /app-config (công khai).
 */
@Controller('app-config/map')
export class MapSettingsController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Patch()
  @RequirePermissions(PERMISSIONS.SETTING_MANAGE)
  update(@Body() dto: UpdateMapSettingsDto) {
    return this.appConfigService.setMapSettings(dto);
  }
}
