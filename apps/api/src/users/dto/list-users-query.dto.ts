import { UserLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/** Bộ lọc GET /api/users — mỗi tab của trang Người dùng là 1 cấp (`level`). */
export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(UserLevel)
  level?: UserLevel;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  hamletId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  /** Tìm theo tên đăng nhập hoặc họ tên. */
  @IsOptional()
  @IsString()
  search?: string;
}
