import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveUnmatchedStreetDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  @IsIn(['create', 'merge'])
  action: 'create' | 'merge';

  @IsOptional()
  @IsString()
  targetStreetId?: string;
}
