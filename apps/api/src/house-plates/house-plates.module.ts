import { Module } from '@nestjs/common';
import { HousePlatesController } from './house-plates.controller';
import { HousePlatesService } from './house-plates.service';

@Module({
  controllers: [HousePlatesController],
  providers: [HousePlatesService],
})
export class HousePlatesModule {}
