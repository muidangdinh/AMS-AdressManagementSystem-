import { IsString, MinLength } from 'class-validator';

export class RevokePlateDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
