import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });

    // Cố tình dùng chung 1 thông báo lỗi cho sai username lẫn sai password
    // để tránh lộ thông tin tài khoản nào tồn tại (dò tài khoản).
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit,
        position: user.position,
      },
    };
  }

  /**
   * Tự đổi mật khẩu — khác `UsersService.update` (chỉ ADMIN, reset hộ người khác, không cần biết
   * mật khẩu cũ): đây là người dùng tự đổi mật khẩu của chính mình, bắt buộc xác minh mật khẩu hiện tại.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Không tìm thấy người dùng');

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
