import { IsOptional, IsString, MinLength } from 'class-validator';

/** campaignId cố ý KHÔNG cho sửa (đổi đợt = tạo phân vùng mới). */
export class UpdateInstallZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
