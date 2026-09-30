import { IsArray, IsString } from 'class-validator';

export class SetPermissionsDto {
  /** Danh sách mã quyền mới của vai trò (thay thế toàn bộ). Mảng rỗng = gỡ hết quyền. */
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}
