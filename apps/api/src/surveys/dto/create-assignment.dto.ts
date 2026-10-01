import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  zoneId: string;

  @IsString()
  @MinLength(1)
  assigneeId: string;

  /** Giao theo tuyến đường (thuộc đúng phân vùng `zoneId`). Trống = giao cả phân vùng. */
  @IsOptional()
  @IsString()
  routeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Chỉ tiêu: số nhà dự kiến cần khảo sát (Phase 11 Đợt 2). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  targetCount?: number;
}
