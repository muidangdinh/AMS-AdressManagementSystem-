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

export class CreateRouteDto {
  @IsString()
  @MinLength(1)
  zoneId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  streetId?: string;

  @Type(() => Number)
  @IsLatitude()
  startLat: number;

  @Type(() => Number)
  @IsLongitude()
  startLng: number;

  @Type(() => Number)
  @IsLatitude()
  endLat: number;

  @Type(() => Number)
  @IsLongitude()
  endLng: number;

  /** Polyline [[lat,lng],...] — kiểm tra chi tiết từng điểm ở service (class-validator không duyệt mảng lồng). */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20000)
  path: [number, number][];

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthM?: number;

  @IsOptional()
  @IsBoolean()
  snapped?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
