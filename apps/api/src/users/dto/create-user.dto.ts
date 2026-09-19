import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  unit?: string;

  /** Chức vụ (TN-05, góp ý khách hàng 11/09/2026) — tự do nhập, tuỳ chọn. */
  @IsOptional()
  @IsString()
  position?: string;
}
