import { IsString, MinLength } from 'class-validator';

export class RejectSchemeDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
