import { IsString, MinLength } from 'class-validator';

export class NotInstalledPlateDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
