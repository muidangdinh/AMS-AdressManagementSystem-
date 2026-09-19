import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlateStatus } from '@prisma/client';

export class ListPlatesQueryDto {
  @IsOptional()
  @IsEnum(PlateStatus)
  status?: PlateStatus;

  @IsOptional()
  @IsString()
  houseId?: string;

  /** Tìm theo mã biển, số nhà hoặc chủ hộ. */
  @IsOptional()
  @IsString()
  search?: string;
}
