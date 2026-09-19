import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { NumberingSide } from '@prisma/client';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  houseId: string;

  @IsOptional()
  @IsEnum(NumberingSide)
  side?: NumberingSide;

  /** Bỏ trống thì tự đặt = (thứ tự lớn nhất hiện có trong cùng side) + 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sequenceOrder?: number;
}
