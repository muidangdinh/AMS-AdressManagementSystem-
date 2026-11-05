import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body DELETE /api/survey-routes/:id — yêu cầu nhập chính xác `DELETE <tên tuyến>`. */
export class DeleteRouteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  confirmation: string;
}
