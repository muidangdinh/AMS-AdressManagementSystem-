import { IsEnum, IsOptional } from 'class-validator';
import { CampaignStatus } from '@prisma/client';

export class ListInstallCampaignsQueryDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
