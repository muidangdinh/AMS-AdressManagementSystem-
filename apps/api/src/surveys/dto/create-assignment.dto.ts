import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @MinLength(1)
  zoneId: string;

  @IsString()
  @MinLength(1)
  assigneeId: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
