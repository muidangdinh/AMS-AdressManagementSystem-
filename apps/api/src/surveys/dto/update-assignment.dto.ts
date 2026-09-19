import { IsDateString, IsOptional, IsString } from 'class-validator';

/** Chỉ sửa được lúc còn ASSIGNED — đổi hạn/ghi chú giao việc. */
export class UpdateAssignmentDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
