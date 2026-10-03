import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { BuildingType, HouseStatus, PlateNeed, NumberingSide } from '@prisma/client';

export class CreateHouseDto {
  @IsString()
  @MinLength(1)
  houseNumber: string;

  @IsString()
  @MinLength(1)
  street: string;

  @IsString()
  @MinLength(1)
  ward: string;

  @IsOptional()
  @IsString()
  district?: string;

  /** Phase 6 — liên kết danh mục địa chỉ chuẩn hoá (tùy chọn, song song với text ở trên). */
  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  hamletId?: string;

  @IsOptional()
  @IsString()
  streetId?: string;

  @IsOptional()
  @IsString()
  alleyId?: string;

  @IsString()
  @MinLength(1)
  ownerName: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$|^\d{12}$/, {
    message: 'Số CCCD/CMND phải gồm 9 (CMND cũ) hoặc 12 (CCCD mới) chữ số',
  })
  ownerIdNumber?: string;

  @IsEnum(BuildingType)
  buildingType: BuildingType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floors?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area?: number;

  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;

  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  soTo?: string;

  @IsOptional()
  @IsString()
  soThua?: string;

  /** Phase 9 — nhiệm vụ khảo sát đang active lúc SURVEYOR tạo hồ sơ (tùy chọn, không bắt buộc). */
  @IsOptional()
  @IsString()
  surveyAssignmentId?: string;

  /** Hiện trạng nhà lúc khảo sát (Could-have, để trống nếu không xác định). */
  @IsOptional()
  @IsUUID()
  usageStatusId?: string;

  /** Nhu cầu gắn biển của chủ hộ lúc khảo sát. */
  @IsOptional()
  @IsEnum(PlateNeed)
  plateNeed?: PlateNeed;

  /** Phía đường (chẵn/lẻ) ghi nhận lúc khảo sát — tái dùng NumberingSide. */
  @IsOptional()
  @IsEnum(NumberingSide)
  side?: NumberingSide;

  /** Ghi chú khảo sát tự do (mobile SurveyScreen). */
  @IsOptional()
  @IsString()
  note?: string;
}
