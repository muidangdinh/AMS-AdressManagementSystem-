import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './app-config/app-config.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { HousesModule } from './houses/houses.module';
import { AddressesModule } from './addresses/addresses.module';
import { NumberingSchemesModule } from './numbering-schemes/numbering-schemes.module';
import { HousePlatesModule } from './house-plates/house-plates.module';
import { SurveysModule } from './surveys/surveys.module';
import { InstallsModule } from './installs/installs.module';
import { CasesModule } from './cases/cases.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RolesModule } from './roles/roles.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { AuditInterceptor } from './audit/audit.interceptor';

/**
 * AppModule — module gốc.
 * Cấu trúc theo phân hệ: mỗi phân hệ (house, survey, auth...) sẽ là 1 module
 * được import vào đây ở các phase sau.
 *
 * JwtAuthGuard + PermissionsGuard áp dụng toàn cục theo thứ tự: xác thực trước,
 * phân quyền (theo permission — Phase 17) sau. Route @Public() bỏ qua cả hai bước.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    HealthModule,
    AppConfigModule,
    AuthModule,
    UsersModule,
    HousesModule,
    AddressesModule,
    NumberingSchemesModule,
    HousePlatesModule,
    SurveysModule,
    InstallsModule,
    CasesModule,
    DashboardModule,
    NotificationsModule,
    RolesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
