import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { BrandingController } from './branding.controller';

@Module({
  controllers: [AppConfigController, BrandingController],
  providers: [AppConfigService],
})
export class AppConfigModule {}
