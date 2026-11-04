import { IsOptional, IsString } from 'class-validator';

/**
 * TN-10 — lọc báo cáo tổng quan theo xã đang làm việc (góp ý khách hàng
 * 11/09/2026). Có `wardId` → trả `byHamlet`/`byStreet` (đủ danh mục của xã
 * đó); có `hamletId` → giới hạn số liệu theo ấp/thôn đã chọn; không có bộ lọc
 * địa bàn → trả `byWard` (gộp theo xã toàn tỉnh).
 */
export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  hamletId?: string;
}
