import { DepartmentLevel } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  /** Đổi cấp — cũng là cách "phân cấp" cho phòng ban cấp tỉnh cũ (level null). */
  @IsOptional()
  @IsEnum(DepartmentLevel)
  level?: DepartmentLevel;

  @IsOptional()
  @IsString()
  wardId?: string | null;

  @IsOptional()
  @IsString()
  hamletId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
