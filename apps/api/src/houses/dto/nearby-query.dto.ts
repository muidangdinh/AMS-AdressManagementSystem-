import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsInt, Max, Min } from 'class-validator';

export class NearbyQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  /** Bán kính tìm kiếm, đơn vị mét. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(20_000)
  radius: number = 500;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
