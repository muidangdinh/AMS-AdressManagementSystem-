import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/** Thông tin tuyến sửa được bất cứ lúc nào; đường đi chỉ sửa được khi tuyến chưa từng được giao. */
export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Chuỗi rỗng = bỏ gán xã/phường. */
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Chuỗi rỗng = bỏ liên kết đường. */
  @IsOptional()
  @IsString()
  streetId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  startLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  startLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  endLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  endLng?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20000)
  path?: [number, number][];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lengthM?: number;

  @IsOptional()
  @IsBoolean()
  snapped?: boolean;
}
