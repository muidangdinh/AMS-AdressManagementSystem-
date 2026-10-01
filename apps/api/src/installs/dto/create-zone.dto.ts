import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInstallZoneDto {
  @IsString()
  @MinLength(1)
  campaignId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
