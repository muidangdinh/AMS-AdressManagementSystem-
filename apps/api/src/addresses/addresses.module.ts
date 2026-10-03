import { Module } from '@nestjs/common';
import { DistrictsController } from './districts.controller';
import { DistrictsService } from './districts.service';
import { WardsController } from './wards.controller';
import { WardsService } from './wards.service';
import { HamletsController } from './hamlets.controller';
import { HamletsService } from './hamlets.service';
import { StreetsController } from './streets.controller';
import { StreetsService } from './streets.service';
import { AlleysController } from './alleys.controller';
import { AlleysService } from './alleys.service';
import { UsageStatusesController } from './usage-statuses.controller';
import { UsageStatusesService } from './usage-statuses.service';

/**
 * Danh mục địa chỉ chuẩn hoá (Phase 6 — IV. Quản lý dữ liệu địa chỉ):
 * District (quận/huyện, hiện không dùng ở Tây Ninh nhưng giữ để tương thích
 * lịch sử) → Ward (xã/phường) → Hamlet (thôn/ấp/tổ dân phố) và
 * Street (đường/phố) → Alley (hẻm/ngõ). Gộp 5 entity liên quan chặt vào 1
 * module, giống cách `houses` module gộp House + HousePhoto + HouseHistory.
 */
@Module({
  controllers: [
    DistrictsController,
    WardsController,
    HamletsController,
    StreetsController,
    AlleysController,
    UsageStatusesController,
  ],
  providers: [DistrictsService, WardsService, HamletsService, StreetsService, AlleysService, UsageStatusesService],
})
export class AddressesModule {}
