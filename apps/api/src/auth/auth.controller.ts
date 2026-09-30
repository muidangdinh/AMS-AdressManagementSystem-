import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login — công khai, không cần token.
   * JWT là stateless nên không có endpoint "logout" phía server;
   * client tự xóa token đã lưu để đăng xuất.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  /** GET /api/auth/me — trả thông tin người dùng đang đăng nhập. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /** PATCH /api/auth/me/password — tự đổi mật khẩu của chính mình, phải nhập đúng mật khẩu hiện tại. */
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
