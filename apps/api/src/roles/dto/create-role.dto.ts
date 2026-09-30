import { IsArray, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  /** Mã ổn định, không dấu (a-z, 0-9, _). Không đổi sau khi tạo. */
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Mã vai trò chỉ gồm chữ thường, số và dấu gạch dưới, bắt đầu bằng chữ',
  })
  code: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Danh sách mã quyền gán cho vai trò (tùy chọn khi tạo). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}
