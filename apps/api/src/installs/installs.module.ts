import { Module } from '@nestjs/common';
import { InstallCampaignsController } from './install-campaigns.controller';
import { InstallCampaignsService } from './install-campaigns.service';
import { InstallZonesController } from './install-zones.controller';
import { InstallZonesService } from './install-zones.service';
import { InstallAssignmentsController } from './install-assignments.controller';
import { InstallAssignmentsService } from './install-assignments.service';

/**
 * Thi công gắn biển số nhà (tương tự module khảo sát): InstallCampaign (đợt) → InstallZone (phân
 * vùng theo xã/phường) → InstallAssignment (giao cán bộ thi công, tùy chọn kèm tuyến SurveyRoute).
 * Đối tượng làm việc là biển (`HousePlate`), thao tác gắn/chưa gắn vẫn đi qua module `house-plates`.
 */
@Module({
  controllers: [InstallCampaignsController, InstallZonesController, InstallAssignmentsController],
  providers: [InstallCampaignsService, InstallZonesService, InstallAssignmentsService],
})
export class InstallsModule {}
