import { IsString, MinLength } from 'class-validator';

export class AssignCaseDto {
  @IsString()
  @MinLength(1)
  assignedToId: string;
}
