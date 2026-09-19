import { PartialType } from '@nestjs/mapped-types';
import { CreateAlleyDto } from './create-alley.dto';

export class UpdateAlleyDto extends PartialType(CreateAlleyDto) {}
