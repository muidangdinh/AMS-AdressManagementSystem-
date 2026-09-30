import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderScheduler } from './reminder.scheduler';

/** @Global để các module nghiệp vụ (surveys, cases, tasks) gọi `notify` mà không cần import lại. */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ReminderScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
