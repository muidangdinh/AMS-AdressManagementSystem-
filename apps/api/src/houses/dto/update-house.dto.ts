import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { HouseReviewStage } from '@prisma/client';
import { CreateHouseDto } from './create-house.dto';

export class UpdateHouseDto extends PartialType(CreateHouseDto) {
  /**
   * Chuyển giai đoạn phân loại (Đề xuất/Đã kiểm tra/Đã duyệt/Đã ký duyệt/Từ
   * chối) — chỉ có ý nghĩa lúc update, không có ở CreateHouseDto vì mobile
   * tạo mới luôn khởi tạo PROPOSED server-side.
   */
  @IsOptional()
  @IsEnum(HouseReviewStage)
  reviewStage?: HouseReviewStage;
}
