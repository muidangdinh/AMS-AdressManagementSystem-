import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;
}
