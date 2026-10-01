import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

/**
 * Khảo sát có tổ chức (Phase 9 — VII): SurveyCampaign (đợt) → SurveyZone
 * (phân vùng theo Xã/Phường) → SurveyAssignment (giao SURVEYOR). Gộp 3
 * entity liên quan chặt vào 1 module, giống `addresses`/`houses`.
 */
@Module({
  controllers: [CampaignsController, ZonesController, AssignmentsController, RoutesController],
  providers: [CampaignsService, ZonesService, AssignmentsService, RoutesService],
})
export class SurveysModule {}
