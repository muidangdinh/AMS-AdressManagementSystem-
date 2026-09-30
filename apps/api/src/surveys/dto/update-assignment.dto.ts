import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Chỉ sửa được lúc còn ASSIGNED — đổi hạn/ghi chú giao việc. */
export class UpdateAssignmentDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Chỉ tiêu: số nhà dự kiến cần khảo sát (Phase 11 Đợt 2). Gửi null để bỏ chỉ tiêu. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  targetCount?: number | null;
}
