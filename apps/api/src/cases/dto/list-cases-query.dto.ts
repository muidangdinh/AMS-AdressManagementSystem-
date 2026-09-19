import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CaseStatus } from '@prisma/client';

export class ListCasesQueryDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  /** Tìm theo số hồ sơ hoặc tên người yêu cầu. */
  @IsOptional()
  @IsString()
  search?: string;
}
