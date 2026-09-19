# KẾ HOẠCH TRIỂN KHAI DỰ ÁN
# Phần mềm GIS Đánh số & Gắn biển số nhà — Tỉnh Tây Ninh

> Tài liệu này chuyển hóa đặc tả chức năng (`GIS_sonha.docx`) và 2 bản demo giao diện
> (`GIS_sonha_webquantri.html`, `GIS_sonha_Mobileapp.html`) thành một lộ trình triển khai
> phần mềm thực tế: kiến trúc, công nghệ, cơ sở dữ liệu, các giai đoạn, nhân sự và rủi ro.

- **Phiên bản:** 1.0
- **Ngày lập:** 03/08/2026
- **Phạm vi:** Cấp tỉnh (Tây Ninh), có khả năng mở rộng liên tỉnh
- **Mục tiêu:** Số hóa toàn bộ quy trình đánh số nhà, gắn biển QR, phục vụ chuyển đổi số

---

## MỤC LỤC

1. [Tổng quan & Mục tiêu](#1-tổng-quan--mục-tiêu)
2. [Phạm vi triển khai (Scope)](#2-phạm-vi-triển-khai-scope)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Công nghệ đề xuất (Tech Stack)](#4-công-nghệ-đề-xuất-tech-stack)
5. [Thiết kế cơ sở dữ liệu](#5-thiết-kế-cơ-sở-dữ-liệu)
6. [Lộ trình triển khai theo giai đoạn](#6-lộ-trình-triển-khai-theo-giai-đoạn)
7. [Ánh xạ chức năng ↔ giai đoạn](#7-ánh-xạ-chức-năng--giai-đoạn)
8. [Tích hợp hệ thống ngoài](#8-tích-hợp-hệ-thống-ngoài)
9. [Bảo mật & Tuân thủ](#9-bảo-mật--tuân-thủ)
10. [Hạ tầng & Triển khai (DevOps)](#10-hạ-tầng--triển-khai-devops)
11. [Nhân sự & Tổ chức đội ngũ](#11-nhân-sự--tổ-chức-đội-ngũ)
12. [Rủi ro & Giải pháp](#12-rủi-ro--giải-pháp)
13. [Tiêu chí nghiệm thu](#13-tiêu-chí-nghiệm-thu)
14. [Việc cần làm ngay (Next Steps)](#14-việc-cần-làm-ngay-next-steps)

---

## 1. Tổng quan & Mục tiêu

### Bài toán
Hiện trạng đánh số nhà thủ công dẫn đến trùng số, thiếu số, sai lệch địa chỉ, khó tra cứu.
Dự án xây dựng hệ thống GIS tập trung để:

- Quản lý **toàn bộ số nhà trên bản đồ số** với tọa độ GPS chính xác.
- Chuẩn hóa quy trình **khảo sát → đánh số → gắn biển QR → phê duyệt** theo quy định.
- Cung cấp **dịch vụ công trực tuyến** cho người dân và **API** cho các hệ thống khác.

### Mục tiêu đo lường được (KPI)
| KPI | Chỉ tiêu |
|-----|----------|
| Tỷ lệ số nhà được số hóa lên GIS | ≥ 95% trong năm đầu |
| Thời gian tra cứu một địa chỉ | < 2 giây |
| Thời gian xử lý hồ sơ cấp số | Giảm ≥ 50% so với thủ công |
| Khả năng làm việc offline ngoài hiện trường | 100% chức năng khảo sát |
| Số người dùng đồng thời (concurrent) | ≥ 500 |

---

## 2. Phạm vi triển khai (Scope)

### Trong phạm vi (In-scope)
Toàn bộ 11 phân hệ trong đặc tả:

| # | Phân hệ | Ưu tiên |
|---|---------|:-------:|
| I | Quản lý bản đồ GIS (dữ liệu nền, tra cứu) | ⭐ Cao |
| II | CSDL số nhà (hồ sơ, ảnh, QR) | ⭐ Cao |
| III | Quản lý đánh số nhà (tự động/thủ công) | ⭐ Cao |
| IV | Quản lý gắn biển số (kho, in, QR) | ⭐ Cao |
| V | Quy trình nghiệp vụ (workflow phê duyệt, ký số) | Trung bình |
| VI | App khảo sát hiện trường (offline) | ⭐ Cao |
| VII | Dịch vụ công trực tuyến (đăng ký, thanh toán) | Trung bình |
| VIII | Tích hợp & chia sẻ dữ liệu (LGSP/NGSP, API) | Trung bình |
| IX | Báo cáo - Thống kê | Trung bình |
| X | Quản trị hệ thống (user, phân quyền) | ⭐ Cao (nền tảng) |
| XI | Bảo mật (SSO, MFA, chữ ký số) | ⭐ Cao (nền tảng) |

### Ngoài phạm vi (Out-of-scope) — giai đoạn 1
- Phần cứng in biển (máy in kim loại/nhựa) — chỉ tích hợp giao tiếp.
- Ứng dụng cho các tỉnh khác (chỉ chuẩn bị kiến trúc multi-tenant).

---

## 3. Kiến trúc hệ thống

### 3.1. Sơ đồ tổng thể

```
┌───────────────────────────────────────────────────────────────────────┐
│                          NGƯỜI DÙNG CUỐI                               │
│  Cán bộ địa chính | Cán bộ khảo sát | Lãnh đạo | Người dân            │
└───────────────┬───────────────┬───────────────┬───────────────────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼────────┐
        │ Web Quản trị │ │ Mobile App  │ │ Cổng DVC      │
        │ (React)      │ │ (Flutter)   │ │ (Portal)      │
        └───────┬──────┘ └──────┬──────┘ └──────┬────────┘
                │               │               │
                └───────────────┼───────────────┘
                                │  HTTPS / REST + WebSocket
                        ┌───────▼────────┐
                        │  API GATEWAY   │  (xác thực, rate-limit, routing)
                        └───────┬────────┘
        ┌───────────────┬───────┼───────────┬──────────────┐
   ┌────▼────┐   ┌──────▼────┐ ┌▼─────────┐ ┌▼──────────┐ ┌▼──────────┐
   │ Auth &  │   │ Hồ sơ số  │ │ Đánh số  │ │ Bản đồ    │ │ Báo cáo   │
   │ Phân    │   │ nhà (CRUD)│ │ & Biển   │ │ GIS       │ │ Thống kê  │
   │ quyền   │   │           │ │ QR       │ │ (GeoServer)│ │           │
   └────┬────┘   └──────┬────┘ └────┬─────┘ └────┬──────┘ └────┬──────┘
        │               │           │            │             │
        └───────────────┴───────────┴────────────┴─────────────┘
                                │
         ┌──────────────────────┼───────────────────────┐
    ┌────▼─────┐        ┌───────▼────────┐       ┌───────▼────────┐
    │ PostgreSQL│        │ Object Storage │       │ Redis (cache,  │
    │ + PostGIS │        │ (MinIO/S3):    │       │ session, queue)│
    │ (dữ liệu  │        │ ảnh, tài liệu  │       │                │
    │ + không   │        │                │       │                │
    │ gian)     │        │                │       │                │
    └───────────┘        └────────────────┘       └────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  TÍCH HỢP NGOÀI (VIII) │
                    │ LGSP/NGSP | CSDL đất đai│
                    │ CSDL dân cư | DVC Quốc gia│
                    └────────────────────────┘
```

### 3.2. Nguyên tắc kiến trúc
- **API-first:** mọi chức năng expose qua REST API → web/mobile/tích hợp dùng chung.
- **Tách biệt dữ liệu không gian:** PostGIS làm nguồn sự thật, GeoServer publish WMS/WFS.
- **Offline-first cho mobile:** đồng bộ 2 chiều, giải quyết xung đột (conflict resolution).
- **Modular monolith trước, microservices sau:** khởi đầu 1 backend module hóa rõ ràng
  để giảm chi phí vận hành; tách service khi tải tăng.

---

## 4. Công nghệ đề xuất (Tech Stack)

| Lớp | Công nghệ đề xuất | Lý do |
|-----|-------------------|-------|
| **Web quản trị** | React + TypeScript + Leaflet/MapLibre GL + TailwindCSS | Kế thừa trực tiếp demo hiện có (Leaflet + Tailwind) |
| **Mobile khảo sát** | Flutter (hoặc React Native) | 1 codebase iOS/Android, hỗ trợ offline & camera/GPS tốt |
| **Backend API** | Node.js (NestJS) *hoặc* Java (Spring Boot) | NestJS: nhanh, hợp JS team. Spring: hợp chuẩn cơ quan nhà nước |
| **CSDL** | PostgreSQL 16 + **PostGIS** | Chuẩn vàng cho dữ liệu GIS, miễn phí |
| **GIS Server** | GeoServer + MapProxy | Publish WMS/WFS, cache tile bản đồ nền |
| **Lưu trữ file** | MinIO (S3-compatible) | Ảnh hiện trạng, tài liệu, on-premise được |
| **Cache/Queue** | Redis | Session, hàng đợi đồng bộ, cache tra cứu |
| **Xác thực** | Keycloak (SSO + OAuth2/OIDC + MFA) | Đáp ứng SSO/MFA phân hệ XI, kết nối được SSO tỉnh |
| **Bản đồ nền** | OpenStreetMap + ảnh vệ tinh Esri (như demo) + nền VN2000 | Tùy dữ liệu bản đồ địa chính tỉnh cấp |
| **QR Code** | thư viện `qrcode` (sinh) + `zxing`/`ml_kit` (quét trên mobile) | Sinh & quét mã QR số nhà |
| **Báo cáo** | Xuất Excel (`exceljs`), PDF (`puppeteer`/`jsPDF`) | Phân hệ IX |
| **CI/CD** | GitLab CI / GitHub Actions + Docker | Tự động build, test, deploy |
| **Giám sát** | Prometheus + Grafana + Loki | Log, metric, cảnh báo |

> **Lưu ý hệ tọa độ:** Dữ liệu địa chính Việt Nam dùng **VN2000** (EPSG theo múi tỉnh Tây Ninh).
> Bản đồ nền web dùng **WGS84/Web Mercator (EPSG:3857)**. Cần lớp chuyển đổi tọa độ (proj4)
> giữa VN2000 ↔ WGS84 khi nhập/xuất dữ liệu địa chính.

---

## 5. Thiết kế cơ sở dữ liệu

### 5.1. Các bảng cốt lõi (rút ra từ demo + đặc tả)

```
-- Dữ liệu nền hành chính (I)
administrative_unit (id, code, name, level[tinh/huyen/xa], parent_id, geom POLYGON)
street            (id, name, type[duong/hem/ngo], ward_id, geom LINESTRING)
land_parcel       (id, so_to, so_thua, ward_id, owner_ref, geom POLYGON)  -- thửa đất

-- CSDL số nhà (II) — bảng trung tâm
house (
  id, house_number, street_id, ward_id, district_id,
  owner_name, owner_phone, owner_cccd,           -- chủ sở hữu
  building_type, floors, area,                    -- đặc điểm công trình
  status[da_cap|cho_duyet|can_hieu_chinh],       -- trạng thái phê duyệt
  qr_code, latitude, longitude, geom POINT,       -- định danh & tọa độ
  land_parcel_id, so_to, so_thua,                 -- liên kết thửa đất
  created_by, created_at, updated_at
)
house_photo       (id, house_id, url, type[mat_tien|hien_trang], taken_at, gps)
house_document    (id, house_id, url, doc_type, uploaded_at)   -- hồ sơ điện tử
house_history     (id, house_id, action[doi|cap_lai|gop|tach|huy], old_value,
                   new_value, reason, changed_by, changed_at)   -- lịch sử (III.2)

-- Đánh số & phương án (III)
numbering_plan    (id, street_id, method[auto|manual], rule_config JSON,
                   status, created_by, approved_by)
numbering_plan_item (id, plan_id, house_id, proposed_number, side[chan|le])

-- Biển số (IV)
sign_template     (id, name, material, size, template_config JSON)
sign             (id, house_id, template_id, status[cap_moi|cap_doi|cap_lai|thu_hoi],
                  printed_at, installed_at, installed_photo_url, qr_code)
sign_inventory   (id, warehouse, quantity, template_id)          -- kho biển

-- Khảo sát hiện trường (VI) — khớp mobile demo
survey_record    (id, owner, phone, cccd, so_to, so_thua, street, house_no,
                  building_type, floors, status, note, lat, lng, img_url,
                  is_synced, surveyor_id, created_at, synced_at)

-- Quy trình nghiệp vụ (V)
workflow_case    (id, house_id, type[cap_moi|doi_so|cap_lai], current_step,
                  assignee_id, status, digital_signature, created_at)
workflow_log     (id, case_id, step, actor_id, action, note, created_at)

-- Dịch vụ công (VII)
public_request   (id, citizen_name, citizen_cccd, request_type, house_ref,
                  status, payment_status, created_at)

-- Quản trị & bảo mật (X, XI)
user             (id, username, full_name, unit_id, role_id, mfa_enabled, ...)
role             (id, name, permissions JSON)
unit             (id, name, level, parent_id)
audit_log        (id, user_id, action, entity, entity_id, ip, timestamp)
```

### 5.2. Chỉ mục không gian
- Tạo **GiST index** trên tất cả cột `geom` để tra cứu theo tọa độ/bán kính nhanh.
- Index thường trên `house_number`, `qr_code`, `owner_cccd`, `so_to+so_thua`.

---

## 6. Lộ trình triển khai theo giai đoạn

> Tổng thời gian dự kiến: **~12 tháng** cho bản đầy đủ. Có thể có **MVP sau 3 tháng**.

### Giai đoạn 0 — Khởi động & Chuẩn bị *(2–3 tuần)*
- [ ] Khảo sát hiện trạng, chốt quy tắc đánh số theo quy định tỉnh Tây Ninh.
- [ ] Thu thập dữ liệu nền: bản đồ hành chính, ranh giới phường/xã, thửa đất (VN2000).
- [ ] Thiết lập hạ tầng dev: Git, CI/CD, môi trường dev/staging.
- [ ] Chốt tech stack, thiết kế CSDL chi tiết, tài liệu API contract.

### Giai đoạn 1 — Nền tảng & MVP *(Tháng 1–3)* 🎯
**Mục tiêu:** Có hệ thống chạy được với 1 phường thí điểm.
- [ ] **X, XI:** Auth (Keycloak), phân quyền vai trò, quản lý user/đơn vị.
- [ ] **I:** Bản đồ nền GIS, hiển thị lớp hành chính, chuyển nền vệ tinh/giao thông (nâng cấp từ demo web).
- [ ] **II:** CRUD hồ sơ số nhà đầy đủ, upload ảnh, sinh mã QR, lịch sử thay đổi.
- [ ] **VI:** App mobile khảo sát: GPS, chụp ảnh, form, **lưu offline + đồng bộ** (nâng cấp từ demo mobile → backend thật).
- [ ] **Tra cứu:** theo địa chỉ, số nhà, chủ sở hữu, tọa độ, mã QR.
- **Đầu ra:** Web quản trị + Mobile app kết nối chung 1 backend/CSDL thật.

### Giai đoạn 2 — Nghiệp vụ đánh số & biển QR *(Tháng 4–6)*
- [ ] **III:** Lập phương án đánh số (tự động theo quy tắc chẵn/lẻ, thủ công), kiểm tra trùng/thiếu, xem trước trên bản đồ, điều chỉnh (đổi/gộp/tách/hủy).
- [ ] **IV:** Quản lý mẫu biển, kho biển, cấp/đổi/thu hồi, in biển QR, theo dõi lắp đặt, quét QR kiểm tra.
- [ ] **V:** Workflow phê duyệt (tiếp nhận → thẩm định → khảo sát → phê duyệt → ký số → ban hành).

### Giai đoạn 3 — Dịch vụ công & Tích hợp *(Tháng 7–9)*
- [ ] **VII:** Cổng DVC: đăng ký cấp/đổi số nhà, tra cứu hồ sơ, theo dõi trạng thái, thông báo Email/SMS/Zalo, thanh toán trực tuyến.
- [ ] **VIII:** Kết nối CSDL đất đai, CSDL dân cư, LGSP/NGSP, đồng bộ DVC Quốc gia, mở API cho hệ thống khác.
- [ ] **XI (nâng cao):** Chữ ký số cho quyết định, mã hóa dữ liệu nhạy cảm.

### Giai đoạn 4 — Báo cáo, Tối ưu & Nhân rộng *(Tháng 10–12)*
- [ ] **IX:** Dashboard thống kê, báo cáo theo địa bàn/tuyến/thời gian, bản đồ chuyên đề, xuất Excel/PDF.
- [ ] Tối ưu hiệu năng, kiểm thử tải (≥500 concurrent).
- [ ] Đào tạo người dùng, nghiệm thu, nhân rộng ra toàn tỉnh.

---

## 7. Ánh xạ chức năng ↔ giai đoạn

| Phân hệ (docx) | GĐ1 (MVP) | GĐ2 | GĐ3 | GĐ4 |
|----------------|:---------:|:---:|:---:|:---:|
| I. Bản đồ GIS | ● | ◐ | | |
| II. CSDL số nhà | ● | | | |
| III. Đánh số nhà | | ● | | |
| IV. Gắn biển số | | ● | | |
| V. Quy trình nghiệp vụ | | ● | ◐ | |
| VI. App khảo sát | ● | | | |
| VII. Dịch vụ công | | | ● | |
| VIII. Tích hợp | | | ● | |
| IX. Báo cáo | | | | ● |
| X. Quản trị | ● | | | ◐ |
| XI. Bảo mật | ● | | ◐ | |

> ● = triển khai chính | ◐ = bổ sung/nâng cao

---

## 8. Tích hợp hệ thống ngoài

| Hệ thống | Mục đích | Giao thức |
|----------|----------|-----------|
| CSDL đất đai (VILIS/VBDLIS) | Lấy thông tin thửa đất, chủ sử dụng | API / trục LGSP |
| CSDL quốc gia về dân cư | Xác thực CCCD chủ hộ | Trục NGSP (qua Bộ CA) |
| LGSP tỉnh | Trục tích hợp nội tỉnh | Web service chuẩn |
| Cổng DVC Quốc gia | Đồng bộ hồ sơ dịch vụ công | API chuẩn DVCQG |
| Hệ thống cấp phép xây dựng | Đối chiếu công trình | API |
| Zalo OA / SMS / Email | Thông báo cho người dân | API nhà cung cấp |

> Cần văn bản pháp lý & tài khoản kết nối trục cho các CSDL quốc gia — **xin sớm** vì thủ tục lâu.

---

## 9. Bảo mật & Tuân thủ

- **Xác thực:** SSO qua Keycloak, bắt buộc **MFA** cho tài khoản quản trị/phê duyệt.
- **Phân quyền:** RBAC chi tiết theo vai trò + phạm vi đơn vị (cán bộ xã chỉ thấy xã mình).
- **Mã hóa:** TLS 1.3 toàn bộ; mã hóa at-rest cho CCCD, tài liệu nhạy cảm.
- **Chữ ký số:** ký quyết định cấp số theo chuẩn CA Việt Nam (USB token/HSM).
- **Nhật ký:** `audit_log` ghi mọi thao tác nhạy cảm, bất biến (append-only).
- **Sao lưu:** backup CSDL hằng ngày, kiểm thử phục hồi định kỳ.
- **Tuân thủ:** Nghị định 13/2023 về bảo vệ dữ liệu cá nhân; quy định an toàn thông tin cấp độ.

---

## 10. Hạ tầng & Triển khai (DevOps)

- **Đóng gói:** Docker cho mọi service; Docker Compose (dev) → Kubernetes (prod, nếu tải lớn).
- **Môi trường:** `dev` → `staging` → `production` tách biệt.
- **CI/CD:** tự động test + build image + deploy; migration CSDL có version (Flyway/Prisma).
- **Hạ tầng:** ưu tiên **on-premise/private cloud** của tỉnh (dữ liệu công dân), hoặc cloud trong nước đạt chuẩn.
- **Giám sát:** Prometheus + Grafana (metric), Loki (log), cảnh báo qua email/Telegram.
- **Sao lưu:** snapshot CSDL + object storage định kỳ, lưu ngoài site.

---

## 11. Nhân sự & Tổ chức đội ngũ

| Vai trò | Số lượng | Nhiệm vụ |
|---------|:--------:|----------|
| Quản lý dự án (PM) | 1 | Điều phối, làm việc với cơ quan chủ quản |
| Chuyên gia GIS | 1 | Dữ liệu nền, PostGIS, GeoServer, hệ tọa độ VN2000 |
| Backend Dev | 2 | API, CSDL, tích hợp, workflow |
| Frontend Dev (Web) | 2 | Web quản trị (React) |
| Mobile Dev | 1–2 | App khảo sát (Flutter) |
| DevOps | 1 | Hạ tầng, CI/CD, giám sát |
| QA/Tester | 1 | Kiểm thử chức năng, tải, bảo mật |
| Chuyên viên nghiệp vụ | 1 | Cầu nối quy định đánh số ↔ phần mềm |

> Đội tối thiểu ~9–10 người cho lộ trình 12 tháng.

---

## 12. Rủi ro & Giải pháp

| Rủi ro | Mức độ | Giải pháp |
|--------|:------:|-----------|
| Dữ liệu địa chính không chuẩn/thiếu | Cao | Làm sạch dữ liệu ở GĐ0; cho phép khảo sát bổ sung ngoài hiện trường |
| Thủ tục kết nối trục LGSP/NGSP lâu | Cao | Xin phép sớm ngay từ GĐ0; thiết kế module tích hợp có thể chờ |
| Sai lệch tọa độ VN2000 ↔ WGS84 | Trung bình | Chuẩn hóa lớp chuyển đổi proj4, kiểm định với điểm mốc thực địa |
| Kết nối mạng yếu khi khảo sát | Trung bình | Kiến trúc **offline-first**, đồng bộ khi có mạng (đã có trong demo mobile) |
| Xung đột dữ liệu khi đồng bộ | Trung bình | Cơ chế resolve conflict theo timestamp + đánh dấu cần review |
| Thay đổi quy định đánh số | Thấp | Cấu hình quy tắc đánh số dạng JSON, không hardcode |
| Chống thay đổi thói quen người dùng | Trung bình | Đào tạo, tài liệu, giao diện thân thiện (đã có 2 demo trực quan) |

---

## 13. Tiêu chí nghiệm thu

- ✅ Toàn bộ 11 phân hệ hoạt động đúng đặc tả, có tài liệu hướng dẫn.
- ✅ Số hóa thành công phường thí điểm, mở rộng ≥ 95% địa bàn.
- ✅ Đạt hiệu năng: tra cứu < 2s, chịu ≥ 500 concurrent, uptime ≥ 99.5%.
- ✅ Vượt qua kiểm thử bảo mật (pentest) và đánh giá an toàn thông tin cấp độ.
- ✅ Kết nối thành công tối thiểu: CSDL đất đai, dân cư, DVC Quốc gia.
- ✅ App mobile hoạt động offline hoàn chỉnh + đồng bộ ổn định.

---

## 14. Việc cần làm ngay (Next Steps)

**Ưu tiên trong 2 tuần đầu:**

1. 📋 **Chốt quy tắc đánh số** của tỉnh Tây Ninh (chẵn/lẻ, hẻm/ngõ, khu đô thị).
2. 🗺️ **Thu thập dữ liệu nền** — bản đồ hành chính + thửa đất Tây Ninh (VN2000).
3. 🏗️ **Dựng khung dự án thật:** khởi tạo repo backend (NestJS/Spring) + PostGIS + Keycloak.
4. 🔄 **Chuyển 2 demo HTML** thành ứng dụng kết nối API:
   - Web quản trị → React app đọc/ghi dữ liệu qua API.
   - Mobile → Flutter app thay cho localStorage bằng đồng bộ backend.
5. 📝 **Xin chủ trương kết nối** LGSP/NGSP, CSDL đất đai & dân cư (thủ tục dài).
6. 🎯 **Chọn 1 phường thí điểm** để triển khai MVP trước.

---

> **Ghi chú:** 2 file demo hiện tại (`GIS_sonha_webquantri.html`, `GIS_sonha_Mobileapp.html`)
> là **prototype giao diện xuất sắc** để làm cơ sở UX. Dữ liệu demo đang đặt ở Hà Nội
> (đường Trần Nhân Tông) — khi triển khai thật cần **thay bằng dữ liệu Tây Ninh** và
> kết nối backend chung thay cho dữ liệu hard-code / localStorage.
