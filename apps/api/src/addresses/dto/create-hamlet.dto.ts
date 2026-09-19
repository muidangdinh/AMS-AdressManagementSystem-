import { IsString, MinLength } from 'class-validator';

export class CreateHamletDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  wardId: string;
}
