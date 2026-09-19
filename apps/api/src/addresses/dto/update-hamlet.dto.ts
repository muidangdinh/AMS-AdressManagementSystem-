import { PartialType } from '@nestjs/mapped-types';
import { CreateHamletDto } from './create-hamlet.dto';

export class UpdateHamletDto extends PartialType(CreateHamletDto) {}
