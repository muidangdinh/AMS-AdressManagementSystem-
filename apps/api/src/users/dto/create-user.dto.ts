import { ArrayNotEmpty, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

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

  /** PHASE 17 — danh sách id vai trò động gán cho user (ít nhất 1). */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds: string[];

  @IsOptional()
  @IsString()
  unit?: string;

  /** Chức vụ (TN-05, góp ý khách hàng 11/09/2026) — tự do nhập, tuỳ chọn. */
  @IsOptional()
  @IsString()
  position?: string;
}
