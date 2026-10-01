import { IsOptional, IsString, MinLength } from 'class-validator';

/** Chỉ sửa thông tin mô tả — muốn đổi hình tuyến thì xóa rồi chấm lại. */
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
}
