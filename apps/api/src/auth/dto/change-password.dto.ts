import { IsString, MinLength } from 'class-validator';

/** Body PATCH /api/auth/me/password — người dùng tự đổi mật khẩu, phải biết mật khẩu hiện tại. */
export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
