import { Module } from '@nestjs/common';
import { NumberingSchemesController } from './numbering-schemes.controller';
import { NumberingSchemesService } from './numbering-schemes.service';

@Module({
  controllers: [NumberingSchemesController],
  providers: [NumberingSchemesService],
})
export class NumberingSchemesModule {}
