import { Module } from '@nestjs/common';
import { HousePlatesController } from './house-plates.controller';
import { HousePlatesService } from './house-plates.service';
import { InstallsModule } from '../installs/installs.module';

@Module({
  imports: [InstallsModule],
  controllers: [HousePlatesController],
  providers: [HousePlatesService],
})
export class HousePlatesModule {}
