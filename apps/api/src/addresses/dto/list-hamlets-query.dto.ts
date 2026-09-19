import { IsOptional, IsString } from 'class-validator';

export class ListHamletsQueryDto {
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
