import { IsOptional, IsString } from 'class-validator';

export class ListRoutesQueryDto {
  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}
