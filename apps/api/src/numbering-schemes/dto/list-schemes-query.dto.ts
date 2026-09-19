import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NumberingSchemeStatus } from '@prisma/client';

export class ListSchemesQueryDto {
  @IsOptional()
  @IsString()
  streetId?: string;

  @IsOptional()
  @IsEnum(NumberingSchemeStatus)
  status?: NumberingSchemeStatus;
}
