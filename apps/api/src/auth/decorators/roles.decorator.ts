import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Giới hạn route/controller chỉ cho các vai trò được liệt kê. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
