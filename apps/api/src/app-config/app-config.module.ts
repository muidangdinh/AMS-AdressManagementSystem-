import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { BrandingController } from './branding.controller';
import { MapSettingsController } from './map-settings.controller';

@Module({
  controllers: [AppConfigController, BrandingController, MapSettingsController],
  providers: [AppConfigService],
})
export class AppConfigModule {}
