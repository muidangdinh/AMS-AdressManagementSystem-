import { IsEnum, IsOptional, IsString } from 'class-validator';
import { HouseStatus } from '@prisma/client';

/** Cùng bộ lọc với ListHousesQueryDto nhưng không phân trang — dùng cho bản đồ. */
export class GeoJsonQueryDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  streetId?: string;

  @IsOptional()
  @IsString()
  hamletId?: string;

  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
