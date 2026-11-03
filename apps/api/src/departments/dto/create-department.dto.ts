import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  /** Bỏ trống = phòng ban cấp tỉnh/hệ thống; có giá trị = phòng ban thuộc UBND xã đó. */
  @IsOptional()
  @IsString()
  wardId?: string | null;
}
