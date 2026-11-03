import { UserLevel } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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

  /** Cấp tổ chức: SYSTEM (tài khoản hệ thống) / WARD (nhân sự UBND xã) / HAMLET (nhân sự ấp, thôn). */
  @IsOptional()
  @IsEnum(UserLevel)
  level?: UserLevel;

  /** Bắt buộc khi level = WARD. Với HAMLET tự lấy theo xã của ấp. */
  @IsOptional()
  @IsString()
  wardId?: string | null;

  /** Bắt buộc khi level = HAMLET. */
  @IsOptional()
  @IsString()
  hamletId?: string | null;

  /** Phòng ban (danh mục): cấp tỉnh, hoặc thuộc đúng xã của tài khoản. null = bỏ gán. */
  @IsOptional()
  @IsString()
  departmentId?: string | null;
}
