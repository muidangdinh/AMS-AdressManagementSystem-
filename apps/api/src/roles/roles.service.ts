import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG } from '../auth/permissions';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh mục quyền cố định (từ code) — để dựng ma trận gán quyền trên UI. */
  listPermissions() {
    return PERMISSION_CATALOG;
  }

  private shape(role: {
    permissions: { permission: { code: string } }[];
    _count: { users: number };
    [k: string]: unknown;
  }) {
    const { permissions, _count, ...rest } = role;
    return {
      ...rest,
      permissionCodes: permissions.map((rp) => rp.permission.code),
      userCount: _count.users,
    };
  }

  async findAll() {
    const roles = await this.prisma.appRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      include: ROLE_INCLUDE,
    });
    return roles.map((r) => this.shape(r as never));
  }

  async findOne(id: string) {
    const role = await this.prisma.appRole.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    return this.shape(role as never);
  }

  /** Đổi danh sách mã quyền → id (kiểm tra mọi mã tồn tại trong danh mục). */
  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    const unique = [...new Set(codes)];
    if (unique.length === 0) return [];
    const perms = await this.prisma.permission.findMany({ where: { code: { in: unique } } });
    if (perms.length !== unique.length) {
      throw new BadRequestException('Có mã quyền không hợp lệ');
    }
    return perms.map((p) => p.id);
  }

  async create(dto: CreateRoleDto) {
    const existed = await this.prisma.appRole.findUnique({ where: { code: dto.code } });
    if (existed) throw new ConflictException('Mã vai trò đã tồn tại');
    const permissionIds = await this.resolvePermissionIds(dto.permissionCodes ?? []);

    const role = await this.prisma.appRole.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: ROLE_INCLUDE,
    });
    return this.shape(role as never);
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    const role = await this.prisma.appRole.update({
      where: { id },
      data: { name: dto.name, description: dto.description, isActive: dto.isActive },
      include: ROLE_INCLUDE,
    });
    return this.shape(role as never);
  }

  async remove(id: string) {
    const role = await this.prisma.appRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò');
    if (role.isSystem) {
      throw new BadRequestException('Không thể xóa vai trò hệ thống');
    }
    if (role._count.users > 0) {
      throw new BadRequestException('Vai trò đang được gán cho người dùng, không thể xóa');
    }
    await this.prisma.appRole.delete({ where: { id } });
    return { success: true };
  }

  /** Thay thế toàn bộ danh sách quyền của vai trò. */
  async setPermissions(id: string, dto: SetPermissionsDto) {
    await this.findOne(id);
    const permissionIds = await this.resolvePermissionIds(dto.permissionCodes);
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
    return this.findOne(id);
  }
}
