import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { getRefreshTokenTtlMs } from './auth.config';
import { AUTH_USER_INCLUDE, toAuthenticatedUser } from './auth-user';
import { LoginThrottleService } from './login-throttle.service';

const SALT_ROUNDS = 10;
/**
 * Khoảng thời gian token vừa xoay vẫn được chấp nhận: 2 tab cùng làm mới, hoặc mobile mất phản hồi do
 * sóng yếu rồi gửi lại. Quá khoảng này mà token cũ còn được dùng thì coi như bị lộ.
 */
const ROTATION_GRACE_MS = 60 * 1000;
/** Giữ thêm sau khi hết hạn để còn đối chiếu khi điều tra, rồi xóa hẳn. */
const EXPIRED_RETENTION_MS = 7 * 24 * 3600 * 1000;
const INVALID_SESSION = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly loginThrottle: LoginThrottleService,
  ) {}

  /** Ghi nhật ký sự kiện bảo mật — lỗi ghi log không được làm hỏng luồng xác thực. */
  private recordEvent(action: string, path: string, ip: string | undefined, userId: string | null, metadata: Record<string, unknown>) {
    this.audit
      .record({ userId, method: 'POST', path, action, ip, metadata })
      .catch((err) => this.logger.error(`Không ghi được nhật ký ${action}`, err as Error));
  }

  private async issueTokens(
    user: { id: string; username: string; role: string; tokenVersion: number },
    familyId: string = randomUUID(),
  ) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
      tv: user.tokenVersion,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        tokenVersion: user.tokenVersion,
        expiresAt: new Date(Date.now() + getRefreshTokenTtlMs()),
      },
    });
    return { accessToken, refreshToken };
  }

  async login(username: string, password: string, ip?: string) {
    this.loginThrottle.assertAllowed(username);

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: AUTH_USER_INCLUDE,
    });

    // Cố tình dùng chung 1 thông báo lỗi cho sai username lẫn sai password
    // để tránh lộ thông tin tài khoản nào tồn tại (dò tài khoản).
    const passwordOk = !!user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !passwordOk) {
      this.loginThrottle.recordFailure(username);
      this.recordEvent('LOGIN_FAILED', '/api/auth/login', ip, user?.id ?? null, { username });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    this.loginThrottle.recordSuccess(username);

    const tokens = await this.issueTokens(user);
    // Cùng bộ quyền/phạm vi với JwtStrategy (/auth/me), để client ẩn/hiện chức năng nhất quán.
    return { ...tokens, user: toAuthenticatedUser(user) };
  }

  /** Đổi refresh token còn hiệu lực lấy cặp token mới (xoay vòng). */
  async refresh(refreshToken: string, ip?: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    const now = Date.now();
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() <= now ||
      !stored.user.isActive ||
      stored.tokenVersion !== stored.user.tokenVersion
    ) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (stored.rotatedAt && now - stored.rotatedAt.getTime() > ROTATION_GRACE_MS) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
      this.logger.warn(`Refresh token bị dùng lại, đã thu hồi phiên của "${stored.user.username}"`);
      this.recordEvent('REFRESH_TOKEN_REUSED', '/api/auth/refresh', ip, stored.userId, {
        familyId: stored.familyId,
      });
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (!stored.rotatedAt) {
      // Điều kiện rotatedAt=null để 2 request đồng thời không ghi đè mốc xoay của nhau.
      await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, rotatedAt: null },
        data: { rotatedAt: new Date(now) },
      });
    }
    return this.issueTokens(stored.user, stored.familyId);
  }

  /** Đăng xuất: thu hồi cả chuỗi token của phiên này. Token không hợp lệ thì bỏ qua (idempotent). */
  async logout(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Tự cập nhật đơn vị — chỉ sửa user hiện tại, không cần quyền `user:manage`. */
  async updateUnit(userId: string, unit: string) {
    // Đã gán phòng ban: đơn vị do quản trị viên gán theo danh mục, người dùng không tự sửa.
    const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    if (current?.departmentId) {
      throw new ConflictException('Đơn vị do quản trị viên gán theo phòng ban — liên hệ quản trị viên để đổi');
    }
    const trimmed = unit.trim();
    await this.prisma.user.update({
      where: { id: userId },
      data: { unit: trimmed || null },
    });
  }

  /**
   * Tự đổi mật khẩu — khác `UsersService.update` (chỉ ADMIN, reset hộ người khác, không cần biết
   * mật khẩu cũ): đây là người dùng tự đổi mật khẩu của chính mình, bắt buộc xác minh mật khẩu hiện tại.
   * Tăng `tokenVersion` để đăng xuất mọi thiết bị khác; thiết bị đang thao tác nhận cặp token mới.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    return this.issueTokens(updated);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredRefreshTokens() {
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - EXPIRED_RETENTION_MS) } },
      });
      if (count) this.logger.log(`Đã xóa ${count} refresh token hết hạn`);
    } catch (err) {
      this.logger.error('Dọn refresh token thất bại', err as Error);
    }
  }
}
