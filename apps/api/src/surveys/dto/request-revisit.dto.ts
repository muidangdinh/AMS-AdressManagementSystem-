import { IsString, MinLength } from 'class-validator';

export class RequestRevisitDto {
  @IsString()
  @MinLength(1)
  reviewNote: string;
}
