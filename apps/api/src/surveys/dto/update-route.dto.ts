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

/** Cập nhật thông tin hoặc hình tuyến khi tuyến chưa được giao nhiệm vụ. */
export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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
