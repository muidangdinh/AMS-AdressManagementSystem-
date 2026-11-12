import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body DELETE /api/houses — xóa hàng loạt hồ sơ số nhà; yêu cầu nhập chính xác `DELETE`. */
export class DeleteHousesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  confirmation: string;
}
