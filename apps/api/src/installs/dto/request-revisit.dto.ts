import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Một biển cần thi công lại kèm lý do riêng. */
export class RevisitPlateDto {
  @IsString()
  @MinLength(1)
  plateId: string;

  /** Bỏ trống thì dùng lý do chung (`reviewNote`). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RequestInstallRevisitDto {
  @IsString()
  @MinLength(1)
  reviewNote: string;

  /** Các biển cần thi công lại — bắt buộc ít nhất 1; mọi biển phải thuộc nhiệm vụ này. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RevisitPlateDto)
  plates: RevisitPlateDto[];
}
