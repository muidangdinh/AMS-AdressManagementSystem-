// ============================================================
//  seed.ts — Tạo tài khoản Admin đầu tiên (Phase 1) + danh mục địa chỉ
//  mẫu (Phase 6). Chạy: npm run seed --workspace @tayninh/api
//  Đổi mật khẩu mặc định ngay sau lần đăng nhập đầu tiên.
// ============================================================
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISSION_CATALOG, DEFAULT_ROLES, LEGACY_ROLE_TO_CODE } from '../src/auth/permissions';

const prisma = new PrismaClient();

/**
 * TN-01 — Hằng số toàn hệ thống (KHÔNG phải theo người dùng — xem ghi chú ở
 * AppConfigService) tái dùng bảng `AppSetting` có sẵn từ Phase 0 (trước đây
 * không dùng tới). Chỉ 2 khoá theo góp ý khách hàng 11/09/2026 (đổi thương
 * hiệu "AMS"). Idempotent: upsert theo key, chạy lại không tạo trùng.
 */
async function seedAppConfig() {
  const entries: [string, string][] = [
    ['province.name', 'Tỉnh Tây Ninh'],
    ['app.shortName', 'AMS'],
  ];
  for (const [key, value] of entries) {
    await prisma.appSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log('Đã seed cấu hình hệ thống (province.name, app.shortName).');
}

/**
 * PHASE 17 — Đồng bộ danh mục QUYỀN từ code vào bảng `permission`. Idempotent:
 * upsert theo code, cập nhật nhãn/nhóm nếu đổi. Không xóa quyền cũ tự động.
 */
async function seedPermissions() {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, group: p.group },
      create: { code: p.code, name: p.name, group: p.group },
    });
  }
  console.log(`Đã đồng bộ ${PERMISSION_CATALOG.length} quyền vào danh mục permission.`);
}

/**
 * PHASE 17 — Seed 3 vai trò hệ thống (isSystem=true) GIỮ NGUYÊN hành vi cũ.
 * Chỉ gán bộ quyền mặc định khi TẠO MỚI; lần chạy sau KHÔNG ghi đè để tôn trọng
 * tinh chỉnh quyền do admin thực hiện qua UI.
 */
async function seedRoles() {
  for (const def of DEFAULT_ROLES) {
    const existing = await prisma.appRole.findUnique({ where: { code: def.code } });
    const role = existing
      ? await prisma.appRole.update({ where: { code: def.code }, data: { isSystem: true } })
      : await prisma.appRole.create({
          data: {
            code: def.code,
            name: def.name,
            description: def.description,
            isSystem: true,
          },
        });
    if (!existing) {
      const perms = await prisma.permission.findMany({
        where: { code: { in: def.permissions } },
      });
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`Đã seed ${DEFAULT_ROLES.length} vai trò hệ thống (admin/cadastral/surveyor).`);
}

/**
 * PHASE 17 — Backfill: mỗi user chưa có vai trò động sẽ được gán 1 vai trò suy
 * từ cột `role` (enum legacy). Idempotent: bỏ qua user đã có vai trò.
 */
async function backfillUserRoles() {
  const users = await prisma.user.findMany({ include: { roleLinks: true } });
  const roles = await prisma.appRole.findMany();
  const byCode = new Map(roles.map((r) => [r.code, r.id]));
  let linked = 0;
  for (const u of users) {
    if (u.roleLinks.length > 0) continue;
    const code = LEGACY_ROLE_TO_CODE[u.role];
    const roleId = code ? byCode.get(code) : undefined;
    if (roleId) {
      await prisma.userRoleLink.create({ data: { userId: u.id, roleId } });
      linked += 1;
    }
  }
  console.log(`Đã backfill vai trò động cho ${linked} người dùng từ cột role cũ.`);
}

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const existed = await prisma.user.findUnique({ where: { username } });
  if (existed) {
    console.log(`Tài khoản "${username}" đã tồn tại, bỏ qua tạo mới.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
      fullName: 'Quản trị viên hệ thống',
      role: Role.ADMIN,
      unit: 'Sở Xây dựng Tây Ninh',
    },
  });

  console.log('Đã tạo tài khoản Admin đầu tiên:');
  console.log(`  Tên đăng nhập: ${username}`);
  console.log(`  Mật khẩu:      ${password}`);
  console.log('=> Hãy đổi mật khẩu này ngay sau khi đăng nhập lần đầu.');
}

/**
 * Phase 6 — Danh mục địa chỉ chuẩn hoá: CHƯA có nguồn dữ liệu chính thức
 * (xã/phường/thôn-ấp/đường thật của Tây Ninh) tại thời điểm viết migration
 * này. Seed vài dòng MẪU để có dữ liệu test cho màn hình quản trị danh mục
 * (CRUD) và dropdown trên form House — cán bộ ADMIN tự bổ sung/sửa dữ liệu
 * thật qua UI sau. Idempotent: bỏ qua nếu tên đã tồn tại.
 */
async function seedAddressCatalogSample() {
  const district = await prisma.district.upsert({
    where: { name: 'Thành phố Tây Ninh' },
    update: {},
    create: { name: 'Thành phố Tây Ninh' },
  });

  const wardNames = ['Phường 1', 'Phường 3'];
  const wards: Record<string, string> = {};
  for (const name of wardNames) {
    const ward = await prisma.ward.upsert({
      where: { name_districtId: { name, districtId: district.id } },
      update: {},
      create: { name, districtId: district.id },
    });
    wards[name] = ward.id;
  }

  const streets: [string, string][] = [
    ['Nguyễn Chí Thanh', 'Phường 1'],
    ['Cách Mạng Tháng Tám', 'Phường 3'],
  ];
  for (const [name, wardName] of streets) {
    await prisma.street.upsert({
      where: { name_wardId: { name, wardId: wards[wardName] } },
      update: {},
      create: { name, wardId: wards[wardName] },
    });
  }

  console.log('Đã seed danh mục địa chỉ mẫu (1 quận/huyện, 2 xã/phường, 2 đường).');
}

/**
 * Gán FK danh mục (wardId/streetId/districtId) cho các hồ sơ House đã có sẵn
 * text ward/street/district KHỚP CHÍNH XÁC (không phân biệt hoa/thường) với
 * danh mục vừa seed — chỉ áp dụng khi cột FK đang trống, không ghi đè lựa
 * chọn thủ công đã có. An toàn để chạy lại nhiều lần.
 */
async function backfillHouseAddressLinks() {
  const [districts, wards, streets] = await Promise.all([
    prisma.district.findMany(),
    prisma.ward.findMany(),
    prisma.street.findMany(),
  ]);

  const houses = await prisma.house.findMany({
    where: { OR: [{ wardId: null }, { streetId: null }, { districtId: null }] },
  });

  let linked = 0;
  for (const house of houses) {
    const data: { wardId?: string; streetId?: string; districtId?: string } = {};

    if (!house.wardId) {
      const match = wards.find((w) => w.name.toLowerCase() === house.ward.trim().toLowerCase());
      if (match) data.wardId = match.id;
    }
    if (!house.streetId) {
      const match = streets.find(
        (s) => s.name.toLowerCase() === house.street.trim().toLowerCase(),
      );
      if (match) data.streetId = match.id;
    }
    if (!house.districtId && house.district) {
      const match = districts.find(
        (d) => d.name.toLowerCase() === house.district!.trim().toLowerCase(),
      );
      if (match) data.districtId = match.id;
    }

    if (Object.keys(data).length > 0) {
      await prisma.house.update({ where: { id: house.id }, data });
      linked += 1;
    }
  }

  console.log(`Đã gán danh mục địa chỉ cho ${linked}/${houses.length} hồ sơ số nhà khớp tên.`);
}

async function main() {
  await seedAppConfig();
  await seedPermissions();
  await seedRoles();
  await seedAdmin();
  await backfillUserRoles();
  await seedAddressCatalogSample();
  await backfillHouseAddressLinks();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
