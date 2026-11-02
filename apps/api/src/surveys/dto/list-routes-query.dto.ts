import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListRoutesQueryDto {
  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  /** 'true' = lọc theo `wardId` nhưng vẫn kèm tuyến chưa gán xã (danh sách chọn tuyến của phân vùng). */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeNoWard?: string;

  /** 'true' = bỏ tuyến đã ngừng sử dụng. */
  @IsOptional()
  @IsIn(['true', 'false'])
  activeOnly?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
