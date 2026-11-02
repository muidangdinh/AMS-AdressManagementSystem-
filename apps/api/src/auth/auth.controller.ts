import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/login — công khai, trả access token + refresh token. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }

  /** POST /api/auth/refresh — công khai vì access token lúc này đã hết hạn; xác thực bằng refresh token. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string) {
    return this.authService.refresh(dto.refreshToken, ip);
  }

  /** POST /api/auth/logout — công khai để vẫn đăng xuất được khi access token đã hết hạn. */
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /** GET /api/auth/me — trả thông tin người dùng đang đăng nhập. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /** PATCH /api/auth/me/unit — tự cập nhật đơn vị của chính mình. */
  @Patch('me/unit')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateUnit(@Body() dto: UpdateUnitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.updateUnit(user.id, dto.unit);
  }

  /**
   * PATCH /api/auth/me/password — tự đổi mật khẩu của chính mình, phải nhập đúng mật khẩu hiện tại.
   * Mọi phiên khác bị đăng xuất; trả cặp token mới để thiết bị hiện tại không phải đăng nhập lại.
   */
  @Patch('me/password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
