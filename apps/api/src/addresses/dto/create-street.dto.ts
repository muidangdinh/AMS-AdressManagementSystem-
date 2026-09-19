import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStreetDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  wardId?: string;
}
