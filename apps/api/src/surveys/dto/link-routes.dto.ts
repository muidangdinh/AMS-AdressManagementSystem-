import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

/** Body POST /api/survey-zones/:id/routes/link — chọn tuyến có sẵn trong kho. */
export class LinkRoutesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  routeIds: string[];
}
