import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

/**
 * Dashboard tổng quan (nhóm 1). Đọc mở cho mọi vai trò đã đăng nhập — không
 * hạn chế @Roles() vì ADMIN/CADASTRAL/SURVEYOR đều cần xem tiến độ chung.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Tổng quan toàn hệ thống — dùng cho trang `/houses/dashboard` (web) và
   * dashboard mobile. TN-10: truyền `?wardId=` để lấy báo cáo theo ấp/đường
   * của riêng xã đó (thay cho gộp toàn tỉnh).
   */
  @Get('summary')
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query);
  }

  /** Báo cáo nhanh cá nhân (mobile nhóm 10) — số liệu gắn với người đang đăng nhập. */
  @Get('mine')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getMine(user.id);
  }
}
