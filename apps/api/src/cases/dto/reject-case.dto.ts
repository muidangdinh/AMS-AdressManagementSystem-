import { IsString, MinLength } from 'class-validator';

export class RejectCaseDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
