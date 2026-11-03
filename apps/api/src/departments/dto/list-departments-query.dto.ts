import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListDepartmentsQueryDto {
  /** Lọc theo xã; dùng 'province' để chỉ lấy phòng ban cấp tỉnh. */
  @IsOptional()
  @IsString()
  wardId?: string;

  /** 'true' = lọc theo `wardId` nhưng kèm cả phòng ban cấp tỉnh (ô chọn phòng ban trong form người dùng). */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeProvince?: string;

  /** 'true' = bỏ phòng ban đã ngừng sử dụng. */
  @IsOptional()
  @IsIn(['true', 'false'])
  activeOnly?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
