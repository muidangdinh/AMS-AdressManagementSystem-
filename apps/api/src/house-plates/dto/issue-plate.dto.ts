import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PlateIssueReason } from '@prisma/client';

export class IssuePlateDto {
  @IsString()
  @MinLength(1)
  houseId: string;

  @IsOptional()
  @IsEnum(PlateIssueReason)
  reason?: PlateIssueReason;

  /**
   * Khi reason = REPLACEMENT/REISSUE, service tự thu hồi biển đang hiệu lực
   * trước khi cấp biển mới — note này (nếu có) được dùng làm lý do thu hồi.
   */
  @IsOptional()
  @IsString()
  note?: string;
}
