import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMapSettingsDto {
  /** Ẩn lớp icon địa điểm (nhà hàng, cửa hàng…) của nền bản đồ — chỉ còn marker của hệ thống. */
  @IsOptional()
  @IsBoolean()
  hidePoi?: boolean;
}
