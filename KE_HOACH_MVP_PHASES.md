# KẾ HOẠCH MVP — PHÂN CHIA FEATURE THEO PHASE
# Hệ thống GIS Đánh số & Gắn biển số nhà — Tây Ninh

> Tài liệu tập trung vào **MVP**, chia feature theo từng phase rõ ràng.
> Kiến trúc chốt: **Frontend Next.js · Backend NestJS · Database PostgreSQL (PostGIS)**.
> **Toàn bộ lưu trực tiếp trên host** — KHÔNG dùng cloud/dịch vụ bên thứ ba trong giai đoạn này.

- **Phiên bản:** 1.0 · **Ngày:** 03/08/2026
- **Mục tiêu MVP:** Số hóa 1 phường/xã thí điểm — khảo sát, quản lý hồ sơ số nhà, tra cứu trên bản đồ.

---

## 0. Nguyên tắc kiến trúc cho giai đoạn này (On-host, no external cloud)

| Thành phần | Giải pháp trên host | Thay cho (giai đoạn sau) |
|-----------|---------------------|--------------------------|
| Frontend | **Next.js** (SSR/CSR) chạy trên server tỉnh | — |
| Backend | **NestJS** (REST API) cùng server | — |
| Database | **PostgreSQL 16 + PostGIS** cài local trên host | — |
| Lưu ảnh/tài liệu | **Thư mục local trên host** (`/var/app/uploads`), phục vụ qua NestJS static | MinIO/S3 |
| Xác thực | **JWT tự phát hành** (module Auth trong NestJS) | Keycloak SSO/MFA |
| Cache/Queue | Chưa cần — hoặc Redis local nếu có | Redis cluster |
| Bản đồ nền | Tile **OpenStreetMap / Esri công cộng** (chỉ đọc tile, không lưu dữ liệu ra ngoài) | Tile server nội bộ (MapProxy) |
| Backup | **Cron `pg_dump` + rsync thư mục uploads** ra ổ cứng khác trên host | Backup offsite |

> **Ghi chú:** Dữ liệu công dân (ảnh, CCCD, hồ sơ) **nằm hoàn toàn trên host của tỉnh**.
> Chỉ có *tile bản đồ nền* được tải từ OSM/Esri (dữ liệu công khai, không gửi dữ liệu đi).
> Nếu yêu cầu tuyệt đối kín, có thể tự host tile ở phase sau.

### Cấu trúc thư mục dự án (monorepo gợi ý)
```
tayninh-gis/
├── apps/
│   ├── web/          # Next.js (App Router, TypeScript, TailwindCSS, Leaflet)
│   └── api/          # NestJS (module hóa theo phân hệ)
├── packages/
│   └── shared/       # Kiểu dữ liệu dùng chung FE/BE (DTO, enum)
├── uploads/          # Ảnh & tài liệu lưu trực tiếp trên host
├── docker-compose.yml# postgres + api + web (tất cả on-host)
└── scripts/backup.sh # pg_dump + rsync
```

---

## PHASE 0 — Nền móng kỹ thuật *(Tuần 1)*
**Mục tiêu:** Bộ khung chạy được "Hello World" xuyên suốt FE ↔ BE ↔ DB.

### Feature / công việc
- [ ] Khởi tạo monorepo: `apps/web` (Next.js) + `apps/api` (NestJS) + `packages/shared`.
- [ ] Cài **PostgreSQL 16 + PostGIS** trên host, tạo database `tayninh_gis`.
- [ ] Docker Compose: `postgres` + `api` + `web` chạy chung 1 host.
- [ ] NestJS kết nối DB qua **Prisma** (hoặc TypeORM) + migration đầu tiên.
- [ ] Next.js gọi thử 1 API `/health` từ NestJS thành công.
- [ ] Cấu hình biến môi trường (`.env`), CORS, logging cơ bản.

**Tiêu chí xong:** Mở web → gọi API → API đọc DB → trả về dữ liệu thật.

---

## PHASE 1 — Xác thực & Quản trị người dùng *(Tuần 2)*
**Mục tiêu:** Đăng nhập, phân quyền tối thiểu để bảo vệ dữ liệu.
> Tương ứng phân hệ **X, XI** (bản MVP, chưa SSO/MFA).

### Feature
- [ ] Đăng nhập / đăng xuất bằng **JWT** (username + password, mã hóa bcrypt).
- [ ] 3 vai trò MVP: **Admin**, **Cán bộ địa chính** (web), **Cán bộ khảo sát** (mobile/web field).
- [ ] Guard phân quyền theo vai trò (RBAC cơ bản, NestJS Guards).
- [ ] CRUD người dùng + gán vai trò (chỉ Admin).
- [ ] Middleware ghi **audit log** thao tác quan trọng (tạo/sửa/xóa số nhà).

**Tiêu chí xong:** Không đăng nhập → không vào được. Vai trò khác → thấy quyền khác.

---

## PHASE 2 — CSDL số nhà (lõi hệ thống) *(Tuần 3–4)* 🎯
**Mục tiêu:** Quản lý hồ sơ số nhà đầy đủ — trái tim của MVP.
> Tương ứng phân hệ **II**.

### Feature — Backend (NestJS)
- [ ] Bảng `house` + `house_photo` + `house_history` (PostGIS `geom POINT`).
- [ ] API CRUD số nhà: tạo / sửa / xóa / xem chi tiết / danh sách (phân trang, lọc).
- [ ] **Upload ảnh hiện trạng** → lưu vào thư mục `uploads/` trên host, trả URL.
- [ ] Sinh **mã QR** cho mỗi số nhà (thư viện `qrcode`, lưu chuỗi định danh).
- [ ] Ghi **lịch sử thay đổi** mỗi lần sửa (ai, khi nào, đổi gì).

### Feature — Frontend (Next.js)
- [ ] Trang danh sách số nhà: bảng + bộ lọc (đường, phường, trạng thái) + tìm kiếm.
- [ ] Form thêm/sửa số nhà (kế thừa UX từ demo `webquantri.html`).
- [ ] Trang/drawer chi tiết hồ sơ: ảnh, chủ sở hữu, đặc điểm, tọa độ, mã QR.
- [ ] Upload ảnh từ giao diện.

**Tiêu chí xong:** Nhập được 1 hồ sơ số nhà thật (ảnh + tọa độ + QR) và tra ra lại được.

---

## PHASE 3 — Bản đồ GIS & Tra cứu *(Tuần 5–6)*
**Mục tiêu:** Hiển thị số nhà trên bản đồ, tra cứu không gian.
> Tương ứng phân hệ **I** (mức MVP).

### Feature — Frontend
- [ ] Tích hợp **Leaflet/MapLibre** vào Next.js (chuyển từ demo HTML sang component React).
- [ ] Hiển thị marker số nhà từ API (màu theo trạng thái: đã cấp / chờ duyệt / cần hiệu chỉnh).
- [ ] Chuyển nền **giao thông ↔ vệ tinh** (OSM / Esri).
- [ ] Click marker → mở chi tiết hồ sơ; click danh sách → bay tới vị trí trên bản đồ.
- [ ] Hiển thị lớp ranh giới phường/xã thí điểm.

### Feature — Backend
- [ ] API tra cứu: theo **địa chỉ, số nhà, chủ sở hữu, mã QR**.
- [ ] API tra cứu **theo tọa độ / bán kính** (dùng PostGIS `ST_DWithin`).
- [ ] API trả dữ liệu số nhà dạng **GeoJSON** cho bản đồ.

**Tiêu chí xong:** Mở bản đồ thấy toàn bộ số nhà của phường, tra cứu và định vị được.

---

## PHASE 4 — Khảo sát hiện trường (Web-field / PWA) *(Tuần 7–8)*
**Mục tiêu:** Cán bộ ra hiện trường thu thập số nhà bằng điện thoại.
> Tương ứng phân hệ **VI**. MVP làm dạng **PWA (Next.js)** thay cho app native để nhanh.

### Feature
- [ ] Giao diện mobile-friendly (kế thừa UX từ demo `Mobileapp.html`).
- [ ] Lấy **GPS** thiết bị (`navigator.geolocation`), hiển thị mini-map.
- [ ] Form khảo sát: chủ hộ, CCCD, SĐT, số tờ/thửa, loại công trình, số tầng, ghi chú.
- [ ] **Chụp/chọn ảnh** hiện trạng từ camera điện thoại → upload lên host.
- [ ] **Lưu offline** (IndexedDB) khi mất mạng + **đồng bộ** khi có mạng trở lại.
- [ ] Danh sách hồ sơ đã khảo sát + trạng thái "đã đồng bộ / chờ đồng bộ".

**Tiêu chí xong:** Ra hiện trường không mạng vẫn nhập được, về có mạng đồng bộ lên hệ thống.

---

## PHASE 5 — Hoàn thiện MVP & Nghiệm thu *(Tuần 9–10)*
**Mục tiêu:** Ổn định, thống kê cơ bản, sẵn sàng chạy thí điểm.

### Feature
- [ ] **Dashboard thống kê MVP:** tổng số nhà, đã cấp, chờ duyệt, cần hiệu chỉnh (như header demo).
- [ ] **Xuất Excel** danh sách số nhà theo bộ lọc (`exceljs`).
- [ ] **In mã QR** số nhà (trang in đơn giản, khổ tem).
- [ ] Kiểm thử end-to-end, sửa lỗi, tối ưu truy vấn PostGIS.
- [ ] **Backup tự động** trên host: cron `pg_dump` + rsync thư mục `uploads/`.
- [ ] Tài liệu hướng dẫn sử dụng + triển khai lên server tỉnh.

**Tiêu chí xong:** Chạy thật ở 1 phường, cán bộ dùng được end-to-end, có backup an toàn.

---

## Tổng hợp phạm vi MVP

### ✅ CÓ trong MVP
| Phân hệ | Mức độ trong MVP |
|---------|------------------|
| II. CSDL số nhà | Đầy đủ (CRUD, ảnh, QR, lịch sử) |
| I. Bản đồ & tra cứu | Cơ bản (hiển thị, lọc, tra cứu không gian) |
| VI. Khảo sát hiện trường | PWA offline + đồng bộ |
| X. Quản trị người dùng | RBAC cơ bản (3 vai trò) |
| XI. Bảo mật | JWT + audit log (chưa SSO/MFA) |
| IX. Báo cáo | Tối thiểu (dashboard + xuất Excel) |

### ❌ CHƯA làm trong MVP (để phase sau)
| Phân hệ | Lý do hoãn |
|---------|-----------|
| III. Đánh số tự động theo quy tắc | Nghiệp vụ phức tạp, cần chốt quy định trước |
| IV. Quản lý kho biển, cấp/đổi/thu hồi | Cần quy trình vận hành thực tế |
| V. Workflow phê duyệt + ký số | Cần chữ ký số CA, thủ tục pháp lý |
| VII. Dịch vụ công + thanh toán | Cần tích hợp cổng DVC, thanh toán |
| VIII. Tích hợp LGSP/NGSP, đất đai, dân cư | Thủ tục kết nối trục dài |
| XI nâng cao (SSO, MFA, chữ ký số) | Chuyển sang Keycloak ở phase sau |

---

## Lịch trình tổng quan

| Phase | Nội dung | Thời gian | Cộng dồn |
|:-----:|----------|:---------:|:--------:|
| 0 | Nền móng kỹ thuật | Tuần 1 | 1 tuần |
| 1 | Auth & quản trị user | Tuần 2 | 2 tuần |
| 2 | CSDL số nhà (lõi) 🎯 | Tuần 3–4 | 4 tuần |
| 3 | Bản đồ GIS & tra cứu | Tuần 5–6 | 6 tuần |
| 4 | Khảo sát hiện trường (PWA) | Tuần 7–8 | 8 tuần |
| 5 | Hoàn thiện & nghiệm thu | Tuần 9–10 | **~2.5 tháng** |

> **Đường găng (critical path):** Phase 0 → 2 là bắt buộc tuần tự.
> Phase 3 và 4 có thể **làm song song** nếu đủ người (1 người bản đồ, 1 người khảo sát).

---

## Thứ tự ưu tiên nếu bị rút ngắn thời gian

Nếu chỉ còn **6 tuần**, cắt theo thứ tự ưu tiên:
1. **Giữ:** Phase 0, 1, 2, 3 (nhập liệu + bản đồ + tra cứu = giá trị cốt lõi).
2. **Cắt/hoãn:** Phase 4 (khảo sát offline) → tạm nhập liệu trực tiếp trên web.
3. **Rút gọn:** Phase 5 chỉ giữ dashboard + backup, bỏ xuất Excel/in QR.

---

## Việc làm ngay (bắt đầu Phase 0)

1. Cài PostgreSQL + PostGIS trên host, tạo DB `tayninh_gis`.
2. `npx create-next-app apps/web` + `nest new apps/api`.
3. Viết `docker-compose.yml` (postgres + api + web) chạy on-host.
4. Migration đầu tiên (Prisma) + API `/health` + Next.js gọi thử.
5. Chuẩn bị dữ liệu 1 phường thí điểm (ranh giới + vài số nhà mẫu Tây Ninh).

> Tôi có thể dựng sẵn khung monorepo (Next.js + NestJS + Prisma + PostGIS + docker-compose)
> để bắt đầu Phase 0 ngay — chỉ cần bạn ra hiệu.
