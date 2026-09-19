import { IsOptional, IsString } from 'class-validator';

export class ListStreetsQueryDto {
  @IsOptional()
  @IsString()
  wardId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
