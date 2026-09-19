import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AppConfigService } from './app-config.service';

/**
 * Hằng số toàn hệ thống hiển thị công khai (tên tỉnh, tên viết tắt ứng
 * dụng) — công khai (`@Public()`) vì màn đăng nhập cần hiển thị trước khi
 * có token (góp ý khách hàng 11/09/2026, mục Đăng nhập).
 */
@Public()
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  get() {
    return this.appConfigService.getPublicConfig();
  }
}
