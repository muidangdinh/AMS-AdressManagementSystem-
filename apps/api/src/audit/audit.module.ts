import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** @Global để AuditInterceptor (đăng ký ở AppModule) dùng chung 1 service. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
