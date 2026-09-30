import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  /** PHASE 17 — cập nhật danh sách vai trò (nếu truyền, phải có ít nhất 1). */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  unit?: string;

  /** Chức vụ (TN-05, góp ý khách hàng 11/09/2026) — tự do nhập, tuỳ chọn. */
  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Đổi mật khẩu (tùy chọn). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
