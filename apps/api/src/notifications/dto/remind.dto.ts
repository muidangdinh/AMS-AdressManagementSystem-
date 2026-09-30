import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NotificationEntity } from '@prisma/client';

export class RemindDto {
  @IsEnum(NotificationEntity)
  entityType: NotificationEntity;

  @IsString()
  @MinLength(1)
  entityId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
