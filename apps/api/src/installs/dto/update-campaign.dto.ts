import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CampaignStatus } from '@prisma/client';
import { CreateInstallCampaignDto } from './create-campaign.dto';

export class UpdateInstallCampaignDto extends PartialType(CreateInstallCampaignDto) {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
