import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../auth/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

/** Include chuỗi role→permission để dựng roles/permissions trả về. */
const USER_INCLUDE = {
  roleLinks: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

type UserWithRoles = {
  passwordHash: string;
  roleLinks: {
    role: {
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      permissions: { permission: { code: string } }[];
    };
  }[];
  [key: string]: unknown;
};

/** Không bao giờ trả passwordHash; kèm mảng roles + permissions (hợp quyền). */
function toSafeUser(user: UserWithRoles) {
  const { passwordHash: _passwordHash, roleLinks, ...rest } = user;
  const roles = roleLinks.map((l) => ({ id: l.role.id, code: l.role.code, name: l.role.name }));
  const permissions = [
    ...new Set(
      roleLinks
        .filter((l) => l.role.isActive)
        .flatMap((l) => l.role.permissions.map((rp) => rp.permission.code)),
    ),
  ];
  return { ...rest, roles, permissions };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: USER_INCLUDE,
    });
    return users.map((u) => toSafeUser(u as unknown as UserWithRoles));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toSafeUser(user as unknown as UserWithRoles);
  }

  /** Kiểm tra mọi roleId tồn tại, trả về danh sách quyền (mã) gộp của các vai trò đó. */
  private async loadRolesOrThrow(roleIds: string[]): Promise<string[]> {
    const uniqueIds = [...new Set(roleIds)];
    const roles = await this.prisma.appRole.findMany({
      where: { id: { in: uniqueIds } },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== uniqueIds.length) {
      throw new BadRequestException('Có vai trò không tồn tại trong danh sách gán');
    }
    return [...new Set(roles.flatMap((r) => r.permissions.map((rp) => rp.permission.code)))];
  }

  async create(dto: CreateUserDto) {
    const existed = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existed) throw new ConflictException('Tên đăng nhập đã tồn tại');
    await this.loadRolesOrThrow(dto.roleIds);

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        unit: dto.unit,
        position: dto.position,
        roleLinks: { create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })) },
      },
      include: USER_INCLUDE,
    });
    return toSafeUser(user as unknown as UserWithRoles);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    await this.findOne(id); // ném NotFoundException nếu không tồn tại

    // Chặn tự khóa.
    if (id === actorId && dto.isActive === false) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    }
    // Chặn tự gỡ quyền quản trị phân quyền của chính mình (khỏi tự khóa mình ra ngoài).
    if (id === actorId && dto.roleIds) {
      const newPerms = await this.loadRolesOrThrow(dto.roleIds);
      if (!newPerms.includes(PERMISSIONS.ROLE_MANAGE)) {
        throw new BadRequestException(
          'Không thể tự gỡ quyền "Quản lý vai trò & phân quyền" khỏi tài khoản của chính mình',
        );
      }
    } else if (dto.roleIds) {
      await this.loadRolesOrThrow(dto.roleIds);
    }

    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      unit: dto.unit,
      position: dto.position,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    if (dto.roleIds) {
      // Đặt lại toàn bộ vai trò: xóa link cũ, tạo link mới trong 1 transaction.
      data.roleLinks = {
        deleteMany: {},
        create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })),
      };
    }

    const user = await this.prisma.user.update({ where: { id }, data, include: USER_INCLUDE });
    return toSafeUser(user as unknown as UserWithRoles);
  }

  /** Vô hiệu hóa tài khoản thay vì xóa cứng — giữ toàn vẹn liên kết audit_log. */
  async deactivate(id: string, actorId?: string) {
    if (id === actorId) throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: USER_INCLUDE,
    });
    return toSafeUser(user as unknown as UserWithRoles);
  }
}
