import { IsString } from 'class-validator';

/** Body PATCH /api/auth/me/unit — người dùng tự cập nhật đơn vị của mình. */
export class UpdateUnitDto {
  @IsString()
  unit: string;
}
