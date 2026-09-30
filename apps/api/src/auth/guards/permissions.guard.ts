import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionCode } from '../permissions';

/**
 * PHASE 17 — Guard phân quyền theo PERMISSION (thay cho RolesGuard).
 * Route/controller không gắn @RequirePermissions(...) ⇒ chỉ cần đăng nhập.
 * Người dùng phải có ĐỦ mọi quyền được liệt kê (quyền = hợp từ các vai trò,
 * đã được nạp sẵn vào request.user.permissions ở JwtStrategy).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const granted: string[] = user?.permissions ?? [];
    const ok = required.every((p) => granted.includes(p));
    if (!user || !ok) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
