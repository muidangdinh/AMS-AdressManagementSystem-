import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

/** Chỉ chỉnh tọa độ GPS — không mở rộng sang các trường hồ sơ khác (ngoại lệ có kiểm soát của BR-14). */
export class UpdateHouseLocationDto {
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;
}
