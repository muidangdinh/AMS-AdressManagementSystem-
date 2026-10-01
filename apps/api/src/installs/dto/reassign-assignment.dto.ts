import { IsString, MinLength } from 'class-validator';

export class ReassignInstallAssignmentDto {
  @IsString()
  @MinLength(1)
  assigneeId: string;
}
