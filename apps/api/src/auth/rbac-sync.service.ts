import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLES, PERMISSION_CATALOG } from './permissions';

/**
 * Đồng bộ danh mục QUYỀN và vai trò hệ thống vào DB mỗi lần API khởi động (container chỉ chạy
 * `migrate deploy`, không chạy seed — nếu không đồng bộ thì quyền mới không xuất hiện trên server).
 * Idempotent, không ghi đè tinh chỉnh quyền do admin làm trên giao diện:
 *  - `permission`: upsert theo code (cập nhật nhãn/nhóm).
 *  - Vai trò hệ thống CHƯA có: tạo + gán toàn bộ quyền mặc định.
 *  - Vai trò hệ thống ĐÃ có: chỉ gán các quyền MỚI xuất hiện lần đồng bộ này (admin luôn nhận mọi quyền);
 *    quyền cũ mà admin đã gỡ khỏi vai trò sẽ không bị gán lại.
 *  - DB chưa có người dùng nào (hạ tầng mới): tạo tài khoản admin khởi tạo từ SEED_ADMIN_USERNAME/PASSWORD.
 *  - Người dùng chưa có vai trò động: gán theo cột `role` cũ (như prisma/seed.ts).
 */
@Injectable()
export class RbacSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.sync();
    } catch (err) {
      // Đồng bộ lỗi không được làm API không khởi động được.
      this.logger.error('Đồng bộ quyền/vai trò thất bại', err as Error);
    }
  }

  async sync() {
    const existing = new Set((await this.prisma.permission.findMany({ select: { code: true } })).map((p) => p.code));
    const newCodes = new Set<string>();

    for (const p of PERMISSION_CATALOG) {
      if (!existing.has(p.code)) newCodes.add(p.code);
      await this.prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, group: p.group },
        create: { code: p.code, name: p.name, group: p.group },
      });
    }

    for (const def of DEFAULT_ROLES) {
      const role = await this.prisma.appRole.findUnique({ where: { code: def.code } });
      let roleId: string;
      let grant: string[];
      if (!role) {
        roleId = (
          await this.prisma.appRole.create({
            data: { code: def.code, name: def.name, description: def.description, isSystem: true },
          })
        ).id;
        grant = def.permissions;
        this.logger.log(`Đã tạo vai trò hệ thống "${def.code}"`);
      } else {
        roleId = role.id;
        grant = def.code === 'admin' ? def.permissions : def.permissions.filter((c) => newCodes.has(c));
      }
      if (grant.length === 0) continue;
      const perms = await this.prisma.permission.findMany({ where: { code: { in: grant } } });
      const res = await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
      if (res.count > 0) this.logger.log(`Vai trò "${def.code}": thêm ${res.count} quyền`);
    }

    await this.ensureInitialAdmin();

    // Backfill: người dùng chưa có vai trò động → gán theo cột `role` cũ.
    const orphans = await this.prisma.user.findMany({ where: { roleLinks: { none: {} } } });
    if (orphans.length > 0) {
      const roles = await this.prisma.appRole.findMany();
      const byCode = new Map(roles.map((r) => [r.code, r.id]));
      for (const u of orphans) {
        const roleId = byCode.get(u.role.toLowerCase());
        if (roleId) await this.prisma.userRoleLink.create({ data: { userId: u.id, roleId } });
      }
      this.logger.log(`Đã gán vai trò cho ${orphans.length} người dùng chưa có vai trò`);
    }
  }

  /**
   * Hạ tầng mới (bảng app_user trống) → tạo admin khởi tạo, giống `seedAdmin()` trong prisma/seed.ts.
   * Chỉ chạy khi CHƯA có user nào: admin bị xóa/đổi tên sau này sẽ không tự sinh lại với mật khẩu mặc định.
   * Vai trò động `admin` được gán ở bước backfill ngay sau (theo cột role = ADMIN).
   */
  private async ensureInitialAdmin() {
    if ((await this.prisma.user.count()) > 0) return;

    const username = process.env.SEED_ADMIN_USERNAME || 'admin';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
    await this.prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: 'Quản trị viên hệ thống',
        role: Role.ADMIN,
        unit: 'Sở Xây dựng Tây Ninh',
      },
    });
    this.logger.warn(`DB chưa có người dùng: đã tạo tài khoản admin khởi tạo "${username}". Hãy đổi mật khẩu ngay sau khi đăng nhập.`);
  }
}
