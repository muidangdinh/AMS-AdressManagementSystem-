import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/** Không cho đổi `code` sau khi tạo (giữ ổn định tham chiếu). */
export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
