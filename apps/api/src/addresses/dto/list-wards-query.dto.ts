import { IsOptional, IsString } from 'class-validator';

export class ListWardsQueryDto {
  @IsOptional()
  @IsString()
  districtId?: string;

  /** Tìm theo tên. */
  @IsOptional()
  @IsString()
  search?: string;
}
