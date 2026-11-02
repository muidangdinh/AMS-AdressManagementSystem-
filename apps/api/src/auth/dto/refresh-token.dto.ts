import { IsNotEmpty, IsString } from 'class-validator';

/** Body POST /api/auth/refresh và POST /api/auth/logout. */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
