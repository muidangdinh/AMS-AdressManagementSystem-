import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  /** null = chuyển thành phòng ban cấp tỉnh. */
  @IsOptional()
  @IsString()
  wardId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
