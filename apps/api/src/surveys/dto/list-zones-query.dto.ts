import { IsOptional, IsString } from 'class-validator';

export class ListZonesQueryDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;
}
