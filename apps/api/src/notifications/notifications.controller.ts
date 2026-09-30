import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { NotificationsService } from './notifications.service';
import { ReminderScheduler } from './reminder.scheduler';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RemindDto } from './dto/remind.dto';

/**
 * Thông báo trong app (Phase 11). Mọi vai trò đã đăng nhập đọc/đánh dấu thông báo CỦA MÌNH
 * (luôn lọc theo user.id, không nhận userId từ client). Nhắc thủ công: ADMIN & CADASTRAL.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly reminderScheduler: ReminderScheduler,
  ) {}

  @Get()
  list(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.list(user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @RequirePermissions(PERMISSIONS.NOTIFICATION_REMIND)
  @Post('remind')
  remind(@Body() dto: RemindDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.remind(dto, user.id);
  }

  /** Chạy quét nhắc hạn ngay (kiểm thử/vận hành) — job định kỳ vẫn chạy bình thường. */
  @RequirePermissions(PERMISSIONS.NOTIFICATION_RUN_REMINDERS)
  @Post('run-reminders')
  runReminders() {
    return this.reminderScheduler.scanDeadlines();
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(user.id, id);
  }
}
