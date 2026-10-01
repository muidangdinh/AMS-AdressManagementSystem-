import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Chỉ sửa được lúc còn ASSIGNED — đổi hạn/ghi chú/chỉ tiêu. */
export class UpdateInstallAssignmentDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  targetCount?: number | null;
}
