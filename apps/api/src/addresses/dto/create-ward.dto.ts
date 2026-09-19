import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWardDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  districtId?: string;
}
