import { IsOptional, IsString } from 'class-validator';

export class StreetSuggestionsQueryDto {
  @IsOptional()
  @IsString()
  wardId?: string;
}
