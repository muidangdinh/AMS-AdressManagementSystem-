import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user';
import { getJwtSecret } from '../auth.config';
import { AUTH_USER_INCLUDE, toAuthenticatedUser } from '../auth-user';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  /** `User.tokenVersion` lúc ký. Token phát hành trước khi có claim này được coi là phiên bản 0. */
  tv?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /**
   * Tra lại DB (thay vì tin tuyệt đối vào token) để phát hiện ngay
   * tài khoản đã bị vô hiệu hóa (isActive=false) sau khi token đã phát hành.
   *
   * PHASE 17 — nạp luôn vai trò động + hợp quyền tại đây. Vì chạy MỖI request
   * nên đổi quyền của vai trò có hiệu lực ngay, không cần đăng nhập lại và không
   * phải nhồi quyền vào JWT.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: AUTH_USER_INCLUDE,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }
    // Mật khẩu đã đổi sau khi token này được phát hành.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    // Quyền thực tế đã trừ quyền bị bỏ theo cấp tài khoản (vd ấp/thôn không quản lý đợt khảo sát).
    return toAuthenticatedUser(user);
  }
}
