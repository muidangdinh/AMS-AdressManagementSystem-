import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePermissions, PERMISSIONS } from '../auth/permissions';
import { AUTH_USER_INCLUDE, resolveRolesAndPermissions, type UserWithAuthRelations } from '../auth/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

const SALT_ROUNDS = 10;

/** Không bao giờ trả passwordHash; kèm roles + quyền thực tế (đã trừ quyền bị bỏ theo cấp) và xã/ấp. */
function toSafeUser(user: UserWithAuthRelations & { passwordHash: string; [key: string]: unknown }) {
  const { passwordHash: _passwordHash, roleLinks: _roleLinks, ...rest } = user;
  return { ...rest, ...resolveRolesAndPermissions(user) };
}

type Location = { level: UserLevel; wardId: string | null; hamletId: string | null };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto = {}) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      level: query.level,
      wardId: query.wardId,
      hamletId: query.hamletId,
      departmentId: query.departmentId,
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: AUTH_USER_INCLUDE,
    });
    return users.map(toSafeUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: AUTH_USER_INCLUDE });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toSafeUser(user);
  }

  /**
   * Chuẩn hóa xã/ấp theo cấp: SYSTEM không gắn địa bàn; WARD bắt buộc xã; HAMLET bắt buộc ấp,
   * xã tự lấy theo ấp (gửi kèm xã khác với xã của ấp thì báo lỗi).
   */
  private async resolveLocation(level: UserLevel, wardId?: string | null, hamletId?: string | null): Promise<Location> {
    if (level === UserLevel.SYSTEM) return { level, wardId: null, hamletId: null };
    if (level === UserLevel.WARD) {
      if (!wardId) throw new BadRequestException('Nhân sự UBND xã phải chọn xã/phường');
      const ward = await this.prisma.ward.findUnique({ where: { id: wardId }, select: { id: true } });
      if (!ward) throw new BadRequestException('Xã/phường không tồn tại');
      return { level, wardId, hamletId: null };
    }
    if (!hamletId) throw new BadRequestException('Nhân sự ấp/thôn phải chọn ấp/thôn');
    const hamlet = await this.prisma.hamlet.findUnique({ where: { id: hamletId }, select: { wardId: true } });
    if (!hamlet) throw new BadRequestException('Ấp/thôn không tồn tại');
    if (wardId && wardId !== hamlet.wardId) {
      throw new BadRequestException('Ấp/thôn không thuộc xã/phường đã chọn');
    }
    return { level, wardId: hamlet.wardId, hamletId };
  }

  /**
   * Phòng ban gán cho tài khoản phải là phòng ban cấp tỉnh, hoặc thuộc đúng xã của tài khoản.
   * Chỉ chặn phòng ban đã ngừng sử dụng khi GÁN MỚI (giữ nguyên phòng ban cũ thì vẫn được).
   * Trả về tên phòng ban để ghi vào `unit`, hoặc null khi không gán.
   */
  private async resolveDepartment(
    departmentId: string | null,
    userWardId: string | null,
    isNewAssignment: boolean,
  ): Promise<string | null> {
    if (!departmentId) return null;
    const d = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { name: true, wardId: true, isActive: true },
    });
    if (!d) throw new BadRequestException('Phòng ban không tồn tại');
    if (isNewAssignment && !d.isActive) throw new BadRequestException('Phòng ban đã ngừng sử dụng');
    if (d.wardId && d.wardId !== userWardId) {
      throw new BadRequestException(
        'Phòng ban thuộc xã/phường khác với tài khoản — chọn phòng ban cấp tỉnh hoặc phòng ban của xã đó',
      );
    }
    return d.name;
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
    const location = await this.resolveLocation(dto.level ?? UserLevel.SYSTEM, dto.wardId, dto.hamletId);
    const departmentId = dto.departmentId || null;
    const departmentName = await this.resolveDepartment(departmentId, location.wardId, true);

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        // Có phòng ban thì đơn vị lấy theo tên phòng ban (lời chào mobile/APK cũ vẫn đọc `unit`).
        unit: departmentName ?? dto.unit,
        position: dto.position,
        ...location,
        departmentId,
        roleLinks: { create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })) },
      },
      include: AUTH_USER_INCLUDE,
    });
    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { level: true, wardId: true, hamletId: true, departmentId: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy người dùng');

    // Chặn tự khóa.
    if (id === actorId && dto.isActive === false) {
      throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    }
    // Chặn tự hạ cấp: chỉ tài khoản hệ thống mới quản lý được người dùng.
    if (id === actorId && dto.level && dto.level !== UserLevel.SYSTEM) {
      throw new BadRequestException('Không thể tự chuyển tài khoản của chính mình khỏi cấp hệ thống');
    }

    // Đổi cấp/xã/ấp: trường nào không gửi thì giữ như cũ nếu vẫn cùng cấp.
    let location: Location | undefined;
    if (dto.level !== undefined || dto.wardId !== undefined || dto.hamletId !== undefined) {
      const level = dto.level ?? current.level;
      const sameLevel = level === current.level;
      location = await this.resolveLocation(
        level,
        dto.wardId !== undefined ? dto.wardId : sameLevel ? current.wardId : null,
        dto.hamletId !== undefined ? dto.hamletId : sameLevel ? current.hamletId : null,
      );
    }
    const locationChanged =
      !!location &&
      (location.level !== current.level ||
        location.wardId !== current.wardId ||
        location.hamletId !== current.hamletId);

    // Phòng ban: kiểm tra lại cả khi chỉ đổi xã (phòng ban của xã cũ không còn hợp lệ).
    const departmentId = dto.departmentId !== undefined ? dto.departmentId || null : current.departmentId;
    const departmentName = await this.resolveDepartment(
      departmentId,
      location ? location.wardId : current.wardId,
      departmentId !== current.departmentId,
    );

    // Chặn tự gỡ quyền quản trị phân quyền của chính mình (khỏi tự khóa mình ra ngoài).
    if (id === actorId && dto.roleIds) {
      const newPerms = effectivePermissions(UserLevel.SYSTEM, await this.loadRolesOrThrow(dto.roleIds));
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
      // Có phòng ban thì đơn vị luôn theo tên phòng ban; bỏ gán thì giữ/nhận đơn vị tự nhập.
      unit: departmentName ?? dto.unit,
      position: dto.position,
      isActive: dto.isActive,
      ...(location ?? {}),
      departmentId,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    // Đặt lại mật khẩu, khóa tài khoản hoặc đổi cấp/địa bàn: mọi phiên đang mở của người này mất
    // hiệu lực (kể cả khi mở khóa lại sau đó), để lần đăng nhập sau nhận đúng quyền và phạm vi mới.
    if (dto.password || dto.isActive === false || locationChanged) {
      data.tokenVersion = { increment: 1 };
    }
    if (dto.roleIds) {
      // Đặt lại toàn bộ vai trò: xóa link cũ, tạo link mới trong 1 transaction.
      data.roleLinks = {
        deleteMany: {},
        create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })),
      };
    }

    const user = await this.prisma.user.update({ where: { id }, data, include: AUTH_USER_INCLUDE });
    return toSafeUser(user);
  }

  /** Vô hiệu hóa tài khoản thay vì xóa cứng — giữ toàn vẹn liên kết audit_log. */
  async deactivate(id: string, actorId?: string) {
    if (id === actorId) throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false, tokenVersion: { increment: 1 } },
      include: AUTH_USER_INCLUDE,
    });
    return toSafeUser(user);
  }
}
