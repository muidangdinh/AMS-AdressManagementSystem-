import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { CasesModule } from './cases/cases.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AuditInterceptor } from './audit/audit.interceptor';

/**
 * AppModule — module gốc.
 * Cấu trúc theo phân hệ: mỗi phân hệ (house, survey, auth...) sẽ là 1 module
 * được import vào đây ở các phase sau.
 *
 * JwtAuthGuard + RolesGuard áp dụng toàn cục theo thứ tự: xác thực trước,
 * phân quyền sau. Route đánh dấu @Public() bỏ qua cả hai bước.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    CasesModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
