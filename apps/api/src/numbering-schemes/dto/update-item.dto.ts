import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { NumberingSide } from '@prisma/client';

export class UpdateItemDto {
  @IsOptional()
  @IsEnum(NumberingSide)
  side?: NumberingSide;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sequenceOrder?: number;

  /** Sửa tay đè lên số do "Sinh số tự động" sinh ra. */
  @IsOptional()
  @IsString()
  proposedNumber?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
