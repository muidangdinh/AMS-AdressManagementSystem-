import { PartialType } from '@nestjs/mapped-types';
import { CreateUsageStatusDto } from './create-usage-status.dto';

export class UpdateUsageStatusDto extends PartialType(CreateUsageStatusDto) {}
