import { PartialType } from '@nestjs/mapped-types';
import { CreateSchemeDto } from './create-scheme.dto';

/** streetId cố ý KHÔNG cho sửa sau khi tạo (đổi tuyến = tạo phương án mới, tránh nhầm lẫn). */
export class UpdateSchemeDto extends PartialType(CreateSchemeDto) {}
