import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListDepartmentsQueryDto {
  /** WARD / HAMLET, hoặc UNSET = phòng ban cấp tỉnh cũ chưa phân cấp. */
  @IsOptional()
  @IsIn(['WARD', 'HAMLET', 'UNSET'])
  level?: 'WARD' | 'HAMLET' | 'UNSET';

  /** Lọc theo xã — gồm cả phòng ban của các ấp thuộc xã đó. */
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  hamletId?: string;

  /** 'true' = bỏ phòng ban đã ngừng sử dụng. */
  @IsOptional()
  @IsIn(['true', 'false'])
  activeOnly?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
