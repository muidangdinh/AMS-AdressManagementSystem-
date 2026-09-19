import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssignmentStatus } from '@prisma/client';

export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  /** true = chỉ trả về nhiệm vụ của chính người gọi API (mobile "Nhiệm vụ của tôi"). */
  @IsOptional()
  mine?: string;
}
