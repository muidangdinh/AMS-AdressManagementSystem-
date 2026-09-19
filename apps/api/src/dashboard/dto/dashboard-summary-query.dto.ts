import { IsOptional, IsString } from 'class-validator';

/**
 * TN-10 — lọc báo cáo tổng quan theo xã đang làm việc (góp ý khách hàng
 * 11/09/2026). Có `wardId` → trả `byHamlet`/`byStreet` (đủ danh mục của xã
 * đó); không có → trả `byWard` (gộp theo xã toàn tỉnh), `topStreets` giữ
 * nguyên hành vi cũ.
 */
export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsString()
  wardId?: string;
}
