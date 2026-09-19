import { IsOptional, IsString } from 'class-validator';

export class ListAlleysQueryDto {
  @IsOptional()
  @IsString()
  streetId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
