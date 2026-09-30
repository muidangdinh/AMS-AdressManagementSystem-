import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CaseRequestType } from '@prisma/client';

export class CreateCaseDto {
  @IsString()
  @MinLength(1)
  applicantName: string;

  @IsOptional()
  @IsString()
  applicantPhone?: string;

  @IsOptional()
  @IsEnum(CaseRequestType)
  requestType?: CaseRequestType;

  @IsOptional()
  @IsString()
  description?: string;

  /** Hạn xử lý (YYYY-MM-DD) — Phase 11. */
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
