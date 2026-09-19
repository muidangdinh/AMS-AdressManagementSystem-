import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { HouseStatus, HouseReviewStage } from '@prisma/client';

export class ListHousesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  /** Phase 6 — lọc theo danh mục địa chỉ chuẩn hoá (tùy chọn). */
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  streetId?: string;

  /** Lọc theo thôn/ấp/tổ dân phố (Phase 6 — IV). */
  @IsOptional()
  @IsString()
  hamletId?: string;

  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;

  /** Lọc theo giai đoạn phân loại (5 giai đoạn, độc lập với `status`). */
  @IsOptional()
  @IsEnum(HouseReviewStage)
  reviewStage?: HouseReviewStage;

  /** Tìm theo số nhà, tên đường, tên chủ sở hữu, SĐT, CCCD/CMND hoặc mã QR. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Lọc theo người tạo — dùng cho "nhà của tôi" (mobile Dashboard, báo cáo nhanh cá nhân). */
  @IsOptional()
  @IsString()
  createdById?: string;
}
