import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateInstallAssignmentDto {
  @IsString()
  @MinLength(1)
  zoneId: string;

  @IsString()
  @MinLength(1)
  assigneeId: string;

  /** Tuyến (SurveyRoute, dùng chung với khảo sát). Trống = giao cả phân vùng. */
  @IsOptional()
  @IsString()
  routeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Chỉ tiêu số biển. Trống = tính theo số biển trong nhiệm vụ. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  targetCount?: number;
}
