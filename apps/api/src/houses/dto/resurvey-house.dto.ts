import { OmitType } from '@nestjs/mapped-types';
import { UpdateHouseDto } from './update-house.dto';

/**
 * Phase 11 Đợt 2b — cán bộ khảo sát sửa lại đúng nhà bị yêu cầu khảo sát lại (POST /houses/:id/resurvey).
 * Cùng bộ trường với UpdateHouseDto nhưng KHÔNG cho đổi trạng thái duyệt / giai đoạn phân loại / nhiệm vụ
 * gắn kèm — đó vẫn là quyền của ADMIN/CADASTRAL (BR-14).
 */
export class ResurveyHouseDto extends OmitType(UpdateHouseDto, [
  'status',
  'reviewStage',
  'surveyAssignmentId',
] as const) {}
