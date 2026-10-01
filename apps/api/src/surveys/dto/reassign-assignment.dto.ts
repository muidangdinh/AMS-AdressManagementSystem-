import { IsString, MinLength } from 'class-validator';

export class ReassignAssignmentDto {
  @IsString()
  @MinLength(1)
  assigneeId: string;
}
