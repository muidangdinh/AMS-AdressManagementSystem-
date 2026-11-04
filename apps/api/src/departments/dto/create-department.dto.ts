import { DepartmentLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  /** WARD = phòng ban của UBND xã; HAMLET = phòng ban của ấp/thôn. */
  @IsEnum(DepartmentLevel)
  level: DepartmentLevel;

  /** Bắt buộc khi level = WARD. Với HAMLET tự lấy theo xã của ấp. */
  @IsOptional()
  @IsString()
  wardId?: string | null;

  /** Bắt buộc khi level = HAMLET. */
  @IsOptional()
  @IsString()
  hamletId?: string | null;
}
