import { IsString, MinLength } from 'class-validator';

export class LinkHouseDto {
  @IsString()
  @MinLength(1)
  houseId: string;
}
