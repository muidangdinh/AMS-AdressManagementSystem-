import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Chỉ tài khoản cấp hệ thống được quản lý người dùng và phòng ban. Quyền `user:manage` vốn đã bị bỏ ở
 * cấp xã/ấp (xem `PERMISSIONS_DENIED_BY_LEVEL`); guard này chặn thêm 1 lớp nếu danh sách đó bị sửa nhầm.
 */
@Injectable()
export class SystemLevelGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (user?.level !== 'SYSTEM') {
      throw new ForbiddenException('Chỉ tài khoản hệ thống được thực hiện thao tác này');
    }
    return true;
  }
}
