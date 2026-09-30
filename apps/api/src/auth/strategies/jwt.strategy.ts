import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev_only_change_me',
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
      include: {
        roleLinks: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const activeRoles = user.roleLinks
      .map((link) => link.role)
      .filter((role) => role.isActive);
    const roles = activeRoles.map((role) => ({ id: role.id, code: role.code, name: role.name }));
    const permissions = [
      ...new Set(
        activeRoles.flatMap((role) => role.permissions.map((rp) => rp.permission.code)),
      ),
    ];

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      roles,
      permissions,
      unit: user.unit,
      position: user.position,
    };
  }
}
