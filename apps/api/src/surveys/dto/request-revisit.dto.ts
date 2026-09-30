import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Một nhà cần khảo sát lại kèm lý do riêng (Phase 11 Đợt 2b). */
export class RevisitHouseDto {
  @IsString()
  @MinLength(1)
  houseId: string;

  /** Lý do riêng của nhà này; bỏ trống thì dùng lý do chung (`reviewNote`). */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RequestRevisitDto {
  @IsString()
  @MinLength(1)
  reviewNote: string;

  /**
   * Các nhà cụ thể cần khảo sát lại. Không gửi/để rỗng = khảo sát lại chung (cán bộ thêm nhà còn thiếu như trước).
   * Mọi nhà phải thuộc nhiệm vụ này (BR-86).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RevisitHouseDto)
  houses?: RevisitHouseDto[];
}
