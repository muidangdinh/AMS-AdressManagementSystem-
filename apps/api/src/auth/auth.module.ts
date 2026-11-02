import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RbacSyncService } from './rbac-sync.service';
import { LoginThrottleService } from './login-throttle.service';
import { getAccessTokenTtl, getJwtSecret } from './auth.config';

@Module({
  imports: [
    PassportModule,
    // registerAsync: đọc env lúc khởi tạo DI. `register()` chạy ngay khi import file này, trước khi
    // ConfigModule.forRoot nạp `.env`, nên có thể ký token bằng secret khác với secret JwtStrategy dùng.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getAccessTokenTtl() },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RbacSyncService, LoginThrottleService],
  exports: [JwtModule],
})
export class AuthModule {}
