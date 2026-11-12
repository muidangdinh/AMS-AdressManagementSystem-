import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body DELETE /api/houses/:id — yêu cầu nhập chính xác `DELETE`. */
export class DeleteHouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  confirmation: string;
}
