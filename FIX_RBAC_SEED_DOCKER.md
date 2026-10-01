# Khắc phục: deploy Docker xong mất menu "Người dùng", "Vai trò & phân quyền", "Quản lý tuyến đường"

> Phạm vi: sửa ngay từ khâu **build image** (repo root) để mọi lần deploy (kể cả DB mới) tự có dữ liệu phân quyền — không cần chạy tay `hotfix_rbac.sql` trên server nữa.

---

## 1. Hiện tượng

- Sau khi deploy image mới, tài khoản admin đăng nhập được nhưng **không thấy** menu *Người dùng*, *Vai trò & phân quyền*, *Quản lý tuyến đường*.
- Nhiều thao tác ghi khác (giao khảo sát, sửa hồ sơ nhà, cấp biển…) trả **403**.
- Kiểm tra DB server:

```sql
SELECT (SELECT count(*) FROM permission)  AS perms,
       (SELECT count(*) FROM app_role)    AS roles,
       (SELECT count(*) FROM user_role)   AS user_links;
-- 0 | 0 | 0
```

## 2. Nguyên nhân gốc

| Thành phần | Hiện trạng |
|---|---|
| `apps/api/prisma/migrations/17_rbac_core` | Chỉ **tạo 4 bảng rỗng** (`permission`, `app_role`, `role_permission`, `user_role`). |
| `apps/api/prisma/seed.ts` | Là nơi **duy nhất** đổ danh mục quyền, 3 vai trò hệ thống và backfill `user_role` từ cột `app_user.role` cũ. |
| `apps/api/docker-entrypoint.sh` | Chỉ chạy `npx prisma migrate deploy` → `node dist/main.js`. **Không chạy seed.** |
| Image `runner` | Chỉ có `dist/` (biên dịch từ `src/`) + prod deps → **không có `ts-node`**, không có `src/` → không thể chạy `npm run seed` trong container. |

→ Quyền của user được tính lúc đăng nhập từ `user_role → role_permission → permission` (`auth.service.ts`). Bảng rỗng ⇒ `user.permissions = []` ⇒ web ẩn menu (`hasPermission(...)` ở `apps/web/src/app/houses/layout.tsx`) và API chặn bằng `@RequirePermissions`.

## 3. Giải pháp đề xuất (khuyến nghị): đồng bộ RBAC khi API khởi động

Đưa phần **RBAC** của seed vào chính ứng dụng NestJS, chạy ở `onApplicationBootstrap`. Vì code nằm trong `src/` nên được `nest build` biên dịch vào `dist/` — **không cần sửa Dockerfile, không cần ts-node, không đụng migration**.

### 3.1. Tạo service đồng bộ

`apps/api/src/auth/rbac-sync.service.ts`

```ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLES, LEGACY_ROLE_TO_CODE, PERMISSION_CATALOG } from './permissions';

/**
 * Đồng bộ danh mục quyền + vai trò hệ thống mỗi lần API khởi động.
 * Idempotent, an toàn chạy lại; KHÔNG ghi đè quyền admin đã chỉnh trên UI
 * (chỉ gán quyền mặc định cho vai trò vừa tạo mới) — cùng logic với prisma/seed.ts.
 */
@Injectable()
export class RbacSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // 1) Danh mục quyền: upsert theo code (cập nhật nhãn/nhóm nếu đổi).
    for (const p of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, group: p.group },
        create: { code: p.code, name: p.name, group: p.group },
      });
    }

    // 2) Vai trò hệ thống: tạo nếu thiếu, chỉ gán quyền mặc định khi TẠO MỚI.
    for (const def of DEFAULT_ROLES) {
      const existing = await this.prisma.appRole.findUnique({ where: { code: def.code } });
      if (existing) continue;
      const role = await this.prisma.appRole.create({
        data: { code: def.code, name: def.name, description: def.description, isSystem: true },
      });
      const perms = await this.prisma.permission.findMany({ where: { code: { in: def.permissions } } });
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
      this.logger.log(`Đã tạo vai trò hệ thống "${def.code}" (${perms.length} quyền)`);
    }

    // 3) Backfill: user chưa có vai trò động → gán theo cột role cũ.
    const users = await this.prisma.user.findMany({ where: { roleLinks: { none: {} } } });
    if (users.length > 0) {
      const roles = await this.prisma.appRole.findMany();
      const byCode = new Map(roles.map((r) => [r.code, r.id]));
      for (const u of users) {
        const roleId = byCode.get(LEGACY_ROLE_TO_CODE[u.role]);
        if (roleId) await this.prisma.userRoleLink.create({ data: { userId: u.id, roleId } });
      }
      this.logger.log(`Đã backfill vai trò cho ${users.length} người dùng`);
    }
  }
}
```

### 3.2. Đăng ký vào module

Thêm `RbacSyncService` vào `providers` của module đang import `PrismaService` cho phần auth (vd `apps/api/src/auth/auth.module.ts`):

```ts
providers: [/* ...các provider hiện có... */, RbacSyncService],
```

### 3.3. Giữ `prisma/seed.ts` cho môi trường dev

Có thể để nguyên (vẫn dùng cho dev local: tạo admin, địa chỉ mẫu). Tuỳ chọn: tách 3 hàm RBAC trong `seed.ts` gọi sang logic chung để tránh lặp code — không bắt buộc.

### 3.4. Build & deploy (từ repo root)

```powershell
docker build -f .\apps\api\Dockerfile -t thiengis-be-<N> .
docker build -f .\apps\web\Dockerfile -t thiengis-web-<N> .
docker save -o thiengis-be-<N>.tar thiengis-be-<N>:latest
docker save -o thiengis-web-<N>.tar thiengis-web-<N>:latest
scp -P 2223 thiengis-be-<N>.tar thiengis-web-<N>.tar datateam2@118.69.224.60:/data/myanGis/
```

Trên server: `docker load -i …`, sửa image trong `docker-compose.yml`, `docker compose --env-file .env --profile full up -d`.

### 3.5. Kiểm tra sau deploy

```bash
docker logs --tail 50 tayninh_api      # thấy log RbacSyncService (lần đầu) + "Nest application successfully started"
docker exec -it tayninh_postgres psql -U tayninh -d tayninh_gis -c \
"SELECT (SELECT count(*) FROM permission) perms, (SELECT count(*) FROM app_role) roles, (SELECT count(*) FROM user_role) user_links;"
# perms = 19, roles = 3, user_links = số người dùng
```

Người dùng **đăng xuất → đăng nhập lại** (quyền nạp lúc login) → menu hiện đủ.

---

## 4. Phương án thay thế: chạy seed RBAC trong entrypoint

Dùng khi không muốn thêm logic vào app.

1. Tạo `apps/api/prisma/seed-rbac.ts` chỉ chứa `seedPermissions()`, `seedRoles()`, `backfillUserRoles()` (copy từ `seed.ts`).
2. Dockerfile — stage `build`, sau `npm run build`:
   ```dockerfile
   RUN npx tsc prisma/seed-rbac.ts --outDir dist-seed --module commonjs --target ES2021 \
       --esModuleInterop --skipLibCheck
   ```
3. Dockerfile — stage `runner`:
   ```dockerfile
   COPY --from=build --chown=node:node /app/apps/api/dist-seed ./dist-seed
   ```
4. `apps/api/docker-entrypoint.sh`:
   ```sh
   npx prisma migrate deploy
   node dist-seed/prisma/seed-rbac.js
   exec node dist/main.js
   ```

Nhược điểm: thêm bước build riêng, đường dẫn output của `tsc` phụ thuộc cấu trúc import (`../src/auth/permissions`) — cần kiểm tra thực tế; dễ lệch khi đổi cấu trúc thư mục. Vì vậy **ưu tiên phương án ở mục 3**.

---

## 5. Lưu ý liên quan (đã gặp trong cùng lần deploy)

- **Không đổi tên thư mục migration đã áp lên server.** Commit `71f3863` đổi `0_init…9_house_case` → `00_init…09_house_case` khiến server chạy lại `00_init` → lỗi `P3009` → API restart liên tục → **HTTP 502**. Nếu bắt buộc đổi tên, phải cập nhật bảng `_prisma_migrations` trên mọi DB đã deploy trước khi chạy image mới:
  ```sql
  UPDATE _prisma_migrations SET migration_name = '0' || migration_name WHERE migration_name ~ '^[0-9]_';
  ```
- Migration `20260930034358_` chứa `DROP INDEX "house_geom_idx"` (GIST cho tra cứu nhà gần đây) — xác nhận đây là chủ ý trước khi deploy lên môi trường khác.
- Trước mỗi lần deploy nên chạy local: `npx prisma migrate status` trỏ vào bản sao DB server để phát hiện sớm migration lạ/đổi tên.
