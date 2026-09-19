# Tây Ninh GIS — Hệ thống Đánh số & Gắn biển số nhà

Monorepo dự án — Phase 0-3 hoàn chỉnh & đã kiểm thử; Phase 4 (mobile) có code, chưa build;
Phase 5 hoàn chỉnh **trừ backup tự động** (xem mục "Còn thiếu" cuối file).
Kiến trúc: **Next.js (web) · NestJS (api) · PostgreSQL + PostGIS**. Mọi thứ chạy **trên host**, không dùng cloud ngoài.

📘 **Hướng dẫn dùng cho cán bộ:** xem `HUONG_DAN_SU_DUNG.md`.

## Cấu trúc
```
apps/
  web/     Next.js (App Router, TailwindCSS)  -> cổng 3000
  api/     NestJS + Prisma                     -> cổng 3001 (/api)
  mobile/  React Native CLI (bare, không Expo) -> xem apps/mobile/README.md
           ⚠️ KHÔNG nằm trong workspaces gốc — cài đặt riêng (npm install
           ngay trong apps/mobile), tránh kéo theo dependencies RN nặng
           mỗi khi npm install ở gốc cho web/api.
packages/
  shared/  Kiểu dữ liệu dùng chung FE/BE/Mobile
uploads/   Ảnh & tài liệu lưu trên host
scripts/   backup.sh (pg_dump + rsync)
docker-compose.yml
```

## Chạy Phase 0 (dev)

Yêu cầu: Node ≥ 20, Docker + Docker Compose.

```bash
# 0) Chuẩn bị biến môi trường
cp .env.example .env

# 1) Cài dependencies (npm workspaces)
npm install

# 2) Khởi động PostgreSQL + PostGIS trên host
npm run db:up

# 3) Tạo bảng lần đầu (migration) + sinh Prisma client
npm run prisma:migrate       # đặt tên migration, ví dụ: init

# 4) Tạo tài khoản Admin đầu tiên (đọc SEED_ADMIN_USERNAME/PASSWORD từ apps/api/.env)
npm run seed --workspace @tayninh/api

# 5) Chạy backend (cổng 3001) và frontend (cổng 3000) ở 2 terminal
npm run dev:api
npm run dev:web
```

Mở http://localhost:3000 → trang sẽ gọi `http://localhost:3001/api/health`
và hiển thị trạng thái **API + Database + PostGIS**.

## Xác thực & phân quyền (Phase 1)

3 vai trò MVP: **ADMIN**, **CADASTRAL** (Cán bộ địa chính), **SURVEYOR** (Cán bộ khảo sát).

```bash
# Đăng nhập, lấy accessToken (JWT, hết hạn sau 8h)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# Gọi API cần xác thực — đính token vào header
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# Quản lý người dùng (CRUD) — chỉ vai trò ADMIN mới gọi được
curl http://localhost:3001/api/users -H "Authorization: Bearer <accessToken_admin>"
```

- `/api/health` là route công khai (`@Public()`), không cần token.
- JWT là stateless nên không có API "logout" — client tự xóa token đã lưu.
- Tài khoản bị vô hiệu hóa (`isActive=false`) sẽ bị từ chối **ngay lập tức**
  ở lần gọi API tiếp theo, kể cả khi JWT chưa hết hạn (JwtStrategy tra lại DB mỗi request).
- Mọi thao tác `POST/PATCH/PUT/DELETE` được ghi vào bảng `audit_log`
  (ai, khi nào, endpoint nào, nội dung — mật khẩu luôn được ẩn thành `***`).

## Chạy toàn bộ bằng Docker (triển khai server tỉnh, đứng sau reverse proxy dùng chung)

```bash
docker compose --profile full up -d --build
```

Cấu trúc theo mẫu triển khai chung của các dự án trên server tỉnh (giống EDMS):
- `postgres`, `api`, `web` đọc chung biến môi trường qua `env_file: .env`.
- `api`/`web` **không** mở port trực tiếp ra host — chạy trong mạng nội bộ `tayninh`
  (nói chuyện với `postgres`) và mạng `proxy` (**mạng ngoài**, tên `web_server_default`)
  để dùng chung 1 reverse proxy với các dự án khác đã có trên server.
- `postgres` vẫn giữ port ra host (`${POSTGRES_PORT:-5432}`) — quy trình dev hằng ngày
  (`npm run db:up` + `npm run dev:api`/`dev:web` chạy trực tiếp trên host) vẫn phụ thuộc vào việc này.

> ⚠️ **Trước khi chạy `--profile full` trên server thật:** mạng `web_server_default` phải
> đã tồn tại (do stack reverse proxy tạo ra từ trước, ví dụ đứng cùng EDMS). Nếu chưa có,
> `docker compose` sẽ báo lỗi `network web_server_default declared as external, but could
> not be found`. Cấu hình routing domain → `tayninh_api:3001` / `tayninh_web:3000` thực hiện
> ở phía stack reverse proxy, không thuộc file `docker-compose.yml` này.

## Dashboard, xuất Excel, in tem QR (Phase 5)

```bash
# Thống kê tổng quan
curl http://localhost:3001/api/houses/stats -H "Authorization: Bearer <accessToken>"

# Xuất Excel (tôn trọng filter street/ward/status/search giống GET /api/houses)
curl "http://localhost:3001/api/houses/export.xlsx?ward=..." \
  -H "Authorization: Bearer <accessToken>" -o danh-sach.xlsx
```

Trên web: nút **"Xuất Excel"** ở trang danh sách, nút **"In Tem QR"** trong hồ sơ chi tiết
(mở trang in riêng tại `/houses/:id/label`, ẩn header khi in qua CSS `print:hidden`).

## Sao lưu (trên host) — script đã viết, CHƯA lên lịch tự động
```bash
npm run backup      # tạo file backups/db_*.sql.gz + bản sao uploads/ — chạy thủ công
```
> ⚠️ **Còn thiếu:** chưa đặt cron job tự động cho script này (nằm ngoài phạm vi lần triển
> khai Phase 5 gần nhất theo yêu cầu). Trước khi chạy thật ở phường thí điểm, cần:
> `crontab -e` rồi thêm dòng tương tự
> `0 2 * * * cd <đường-dẫn-dự-án> && npm run backup >> backups/backup.log 2>&1`
> và chạy thử ít nhất 1 lần để xác nhận `backups/db_*.sql.gz` được tạo đúng.

## Ứng dụng khảo sát hiện trường — Mobile (Phase 4)

Kế hoạch gốc dự tính PWA cho nhanh, nhưng dự án đã chuyển sang **React Native CLI thuần**
(không dùng Expo) theo yêu cầu thực tế. App nằm ở `apps/mobile/`, dùng chung API + JWT với
web quản trị, hỗ trợ khảo sát GPS + chụp ảnh + lưu offline + tự đồng bộ. Xem
`apps/mobile/README.md` để biết cách cài đặt/build — **cần môi trường Android
Studio/Xcode riêng, không build được trên máy chủ dev này** (thiếu SDK và dung lượng đĩa).

## Lộ trình
Xem `KE_HOACH_MVP_PHASES.md` (phân chia feature theo phase) và
`KE_HOACH_TRIEN_KHAI.md` (kế hoạch tổng thể).
