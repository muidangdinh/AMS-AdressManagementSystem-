import { IsString, MinLength } from 'class-validator';

/** Chỉ sửa số nhà — backend tự giới hạn 48 giờ cho non-admin, xem HousesService.update(). */
export class UpdateHouseNumberDto {
  @IsString()
  @MinLength(1)
  houseNumber: string;
}
