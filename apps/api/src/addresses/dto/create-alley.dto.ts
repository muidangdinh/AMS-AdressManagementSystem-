import { IsString, MinLength } from 'class-validator';

export class CreateAlleyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  streetId: string;
}
