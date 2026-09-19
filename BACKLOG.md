# BACKLOG — Đợt xử lý góp ý phần mềm mobile

| | |
|---|---|
| **Nguồn yêu cầu** | `Góp ý phần mềm.docx` — Phạm Hoàng An, 11/09/2026 |
| **Phạm vi** | Ứng dụng mobile là trọng tâm; kéo theo thay đổi ở API, lược đồ dữ liệu và form nhà trên web |
| **Ngày lập backlog** | 18/09/2026 |
| **Tổng số yêu cầu** | 27 góp ý (GY-01…GY-27) → **27 công việc** (TN-00…TN-26) |
| **Tài liệu liên quan** | `business-logic.md` (nghiệp vụ hiện tại) · `KE_HOACH_NANG_CAP.md` (lộ trình dài hạn) |

## Quy ước

- **Trạng thái**: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong · `[!]` bị chặn
- **Ước lượng**: ngày công tương đối của một lập trình viên quen dự án — **không phải cam kết tiến độ**
- **Ưu tiên**: 🔴 bắt buộc đợt này · 🟠 nên có · 🟡 làm sau nếu còn thời gian
- Mọi công việc đều phải qua **Tiêu chí nghiệm thu** mới coi là xong

## Các quyết định đã chốt

> ⚠️ **Quyết định #1 đã được điều chỉnh sau phản hồi (18/09/2026).** Bản đầu tiên hiểu nhầm rằng hệ
> thống chạy cho **một xã duy nhất**. Thực tế: *"xã A"* trong góp ý **chỉ là ví dụ của người góp ý**;
> hệ thống phục vụ **nhiều xã**, và **có cán bộ phụ trách nhiều xã cùng lúc**.

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | "Xã A, Tỉnh Tây Ninh" lặp lại khắp góp ý | **Ngữ cảnh "xã đang làm việc"** giải theo 3 lớp ưu tiên — xem bảng ngay dưới. **Không** cấu hình một xã cố định |
| 2 | Đổi tab "Gắn Biển" thành "Tra cứu" | **Giữ nguyên** chức năng xác nhận gắn biển, chỉ đổi tên và thêm tra cứu |
| 3 | Báo cáo theo ấp | Thêm ô **Ấp** ở **cả mobile và web**, cộng gộp báo cáo theo ấp |
| 4 | Địa giới hành chính cũ trên bản đồ | Chưa có dữ liệu ranh giới mới — **tách ra, chờ khách hàng** |

### Mô hình "xã đang làm việc" *(thay quyết định #1 cũ)*

Giải theo thứ tự ưu tiên, dừng ở lớp đầu tiên có giá trị:

| Lớp | Nguồn xác định | Làm đợt này? |
|---|---|---|
| 1 | **Nhiệm vụ khảo sát đang chọn** → `activeAssignment.zone.ward` | ✅ Có |
| 2 | Xã công tác gán cho tài khoản (`User.wardId`) | ❌ **Hoãn** sang đợt phân quyền địa bàn — xem TN-25 |
| 3 | **Người dùng tự chọn** từ bộ chọn xã, nhớ lại lần sau | ✅ Có |
| — | Chưa có gì → **"Toàn tỉnh"** | ✅ Có |

> ✅ **Lớp 1 gần như đã có sẵn.** `ASSIGNMENT_INCLUDE` tại
> `apps/api/src/surveys/assignments.service.ts:15-26` **đã** trả kèm `zone.ward { id, name }` trong
> mọi payload nhiệm vụ, và mobile **đã** dùng nó — `AssignmentsScreen.tsx:163` hiện tên xã từng
> nhiệm vụ, `SurveyScreen.tsx:142-157` đã đọc nhiệm vụ đang chọn. **Không cần cột mới, API mới hay
> migration** — chỉ là chưa dùng thông tin đó để đặt tiêu đề và lọc danh mục.

> ✅ **Bỏ ô Quận/Huyện vẫn đúng** bất kể mô hình nào — `schema.prisma:282-284` ghi rõ Tây Ninh là
> tỉnh một cấp, bảng `District` chỉ giữ để tương thích địa chỉ lịch sử. Riêng **"Tỉnh Tây Ninh"**
> đúng là hằng số toàn hệ thống, vẫn để trong `AppSetting`.

---

## TỔNG HỢP THEO ĐỢT

> **Trạng thái thực thi (18/09/2026):** đã code xong **23/27** công việc (TN-01 → TN-05,
> TN-07 → TN-23, TN-26) — toàn bộ phần **làm được mà không cần đầu vào từ khách hàng**. API build
> sạch, web `next build` sạch, mobile `tsc`/`eslint` sạch; đã kiểm chứng sống các điểm truy cập
> `app-config`, `dashboard/summary` (cả 2 chế độ có/không `wardId`), `auth/login` trả `position`.
> **Còn lại 4 mục đều chặn bởi đầu vào bên ngoài, không phải việc code:** TN-00 (câu hỏi gửi
> khách hàng), TN-06 (cần danh sách ấp/xã thật để nhập — màn quản trị đã sẵn sàng), TN-24 (cần
> file ranh giới hành chính mới), TN-25 (cần khách hàng xác nhận có muốn tự nhập chức vụ không).

| Đợt | Mục tiêu | Công việc | Ước lượng | Trạng thái |
|---|---|---|---|---|
| **Đợt 0** | Thu thập đầu vào từ khách hàng *(không code)* | TN-00 | 0 | ⏳ Chờ khách hàng |
| **Đợt 1** | Nền tảng — ngữ cảnh xã, lược đồ dữ liệu | TN-01 → TN-06 | ~4,25 ngày | ✅ 5/6 — chỉ TN-06 chờ dữ liệu |
| **Đợt 2** | Dữ liệu ấp: thu thập và báo cáo | TN-07 → TN-10 | ~5 ngày | ✅ Xong |
| **Đợt 3** | Màn hình mobile theo góp ý | TN-11 → TN-21 | ~7 ngày | ✅ Xong |
| **Đợt 4** | Hoàn thiện giao diện, lọc bản đồ, tài liệu | TN-22 → TN-23, TN-26 | ~3,5 ngày | ✅ Xong |
| **Tồn đọng** | Chặn hoặc chờ quyết định | TN-24, TN-25 | chưa ước lượng | ⏳ Chờ khách hàng |

**Tổng ước lượng phần làm được ngay: ~19,75 ngày công.**

---

## ĐỢT 0 — THU THẬP ĐẦU VÀO

### `[ ]` TN-00 — Làm rõ 7 điểm với khách hàng 🔴

Không code. Phải xong trước khi bắt đầu Đợt 1, nếu không sẽ phải làm lại dữ liệu.

| # | Câu hỏi | Chặn công việc |
|---|---|---|
| 1 | **Danh sách các xã đang triển khai** *(góp ý ghi "xã A" chỉ là ví dụ)* | TN-03, TN-06 |
| 2 | **Danh mục ấp của từng xã** *(góp ý ghi "Ấp 1…Ấp 12" — cần danh sách thật cho mỗi xã)* | TN-06 |
| 3 | **Danh mục đường của từng xã** *(góp ý ghi rõ là "ví dụ 12 tuyến đường")* | TN-18 |
| 4 | Cán bộ phụ trách nhiều xã thường phụ trách **mấy xã**, có cố định không? | TN-03 |
| 5 | Khách hàng có cần **tự nhập chức vụ** cán bộ không? Nếu có, phải làm thêm trang quản trị tài khoản | TN-13, TN-25 |
| 6 | Ai **bổ sung ấp cho hồ sơ cũ** đã nhập trước đợt này? | TN-10 |
| 7 | Có **file ranh giới hành chính mới** (GeoJSON/SHP) không? | TN-24 |

**Tiêu chí nghiệm thu:** có văn bản/email trả lời đủ 7 mục, đính kèm danh mục **ấp và đường theo
từng xã** dạng bảng.

---

## ĐỢT 1 — NỀN TẢNG

### `[x]` TN-01 — Cấu hình hằng số toàn hệ thống 🔴 · 0,25 ngày

Tái dùng bảng **`AppSetting`** có sẵn từ Phase 0 (`apps/api/prisma/schema.prisma:28`) — bảng này
hiện **không được dùng ở bất kỳ đâu trong mã nguồn**. Không cần bảng mới, không cần migration.

Seed **2 khoá** — chỉ những thứ **thực sự toàn hệ thống**:
`province.name` (= `Tỉnh Tây Ninh`) · `app.shortName` (= `AMS`).

> ⚠️ **Không** đặt `deployment.wardId`/`wardName` ở đây. Xã là **ngữ cảnh theo người dùng**, không
> phải hằng số hệ thống — xem mô hình 3 lớp ở đầu tài liệu và TN-03.

- **Tệp:** `apps/api/prisma/seed.ts`

**Tiêu chí nghiệm thu**
- Chạy `npm run seed` hai lần liên tiếp không lỗi, không tạo bản ghi trùng *(idempotent như `seedAddressCatalogSample()` đang có)*
- Đổi tên tỉnh trong `AppSetting` thì toàn hệ thống đổi theo, **không phải build lại ứng dụng**

---

### `[x]` TN-02 — API `GET /api/app-config` 🔴 · 0,5 ngày

Trả `{ provinceName, appShortName }`. Đánh dấu **`@Public()`** vì màn đăng nhập phải hiển thị tên
tỉnh và tên viết tắt **trước khi** có token.

- **Tệp:** `apps/api/src/app-config/` *(module mới — dựng theo khuôn `apps/api/src/health/`, module nhỏ nhất dự án)*, `apps/api/src/app.module.ts`
- **Phụ thuộc:** TN-01

**Tiêu chí nghiệm thu**
- `curl localhost:3001/api/app-config` **không kèm token** trả 200 với đủ 2 trường
- Điểm truy cập mới xuất hiện đúng trong nhật ký kiểm toán khi bị gọi *(chỉ với phương thức ghi — GET không ghi nhật ký, đúng thiết kế hiện tại)*

---

### `[x]` TN-03 — Ngữ cảnh "xã đang làm việc" 🔴 · 1,5 ngày

**Công việc trụ cột của đợt này** — TN-08, TN-14, TN-17, TN-18 đều dựa vào nó. Hiện thực mô hình
3 lớp ở đầu tài liệu.

**a) Bộ giải ngữ cảnh — mobile**
`apps/mobile/src/lib/workingWard.ts` *(mới)*, dựng theo đúng khuôn
`apps/mobile/src/lib/activeAssignment.ts` (AsyncStorage, 3 hàm get/set/clear).
Trả `{ id, name, source: 'assignment' | 'manual' | null }` — ưu tiên `activeAssignment.zone.ward`,
sau đó tới lựa chọn tay của người dùng.

**b) Bộ giải ngữ cảnh — web**
`apps/web/src/lib/working-ward.ts` *(mới)*, localStorage, theo khuôn lưu token ở
`apps/web/src/lib/api.ts:8-19`.

**c) Bộ chọn xã (giao diện)**
Mobile: đầu tab Tổng quan và tab Khảo sát. Web: thanh header `apps/web/src/app/houses/layout.tsx`.
**Bắt buộc có lựa chọn "Tất cả xã"**, và phải đổi được dễ dàng — khách hàng xác nhận **có cán bộ
phụ trách nhiều xã**, nên tuyệt đối không chôn bộ chọn này vào menu sâu.

> ✅ **Tái dùng:** trang `/houses` trên web **đã có sẵn bộ lọc `wardId`**
> (`apps/web/src/app/houses/page.tsx:273`). Xã đang làm việc chỉ cần đặt **giá trị mặc định** cho
> bộ lọc đó — không phải viết cơ chế lọc mới.

- **Phụ thuộc:** TN-02, TN-00 (câu 1, 4)

**Tiêu chí nghiệm thu**
- Chọn nhiệm vụ ở tab Nhiệm Vụ → tiêu đề Tổng quan và Khảo sát **tự đổi sang xã của nhiệm vụ đó**
- Bỏ chọn nhiệm vụ → quay về xã người dùng tự chọn; chưa chọn gì → hiện **"Toàn tỉnh"**
- Đổi xã trên bộ chọn → danh mục ấp/đường và số liệu báo cáo đổi theo **ngay**, không phải mở lại app
- Không màn hình nào còn viết cứng tên xã hay "Tỉnh Tây Ninh"
- Mất mạng lúc khởi động: ứng dụng vẫn mở được, hiển thị giá trị dự phòng thay vì treo

---

### `[x]` TN-04 — Bổ sung và đổi tên loại công trình 🔴 · 0,5 ngày
> Đáp ứng **GY-23**, **GY-24**

Thêm **Công ty/Nhà máy**, **Khu dân cư**; đổi nhãn *Chung cư đô thị* → **Nhà chung cư**.

- **Tệp:**
  - `apps/api/prisma/migrations/11_building_type_extra/migration.sql` *(mới)* — dùng `ALTER TYPE "BuildingType" ADD VALUE`, theo đúng khuôn migration `10_house_survey_attrs`
  - `apps/api/prisma/schema.prisma`
  - `packages/shared/src/index.ts` — enum + `BUILDING_TYPE_LABELS`
  - `apps/api/src/houses/houses.service.ts:40` — `BUILDING_TYPE_LABELS_VI`

> ⚠️ **Hai chỗ phải sửa song song.** `houses.service.ts` **không import được** enum từ
> `packages/shared` (lý do ghi ở chú thích dòng 32-39) nên có bảng nhãn riêng cho xuất Excel.
> Sửa một nơi quên nơi kia thì Excel hiện sai nhãn mà không báo lỗi.

> ⚠️ **Không được drop `house_geom_idx`** trong migration. Prisma không thấy cột `geom`
> (kiểu `Unsupported`) nên `migrate diff` hay đề xuất xoá nhầm chỉ mục GIST này — mất nó thì
> `/houses/nearby` chậm thảm hại.

**Tiêu chí nghiệm thu**
- Chọn được 6 loại công trình trên **cả web và mobile** mà **không phải sửa hai màn hình đó** *(cả hai đều duyệt `Object.values(BuildingType)`)*
- Xuất Excel hiện đúng nhãn tiếng Việt của 2 loại mới và nhãn "Nhà chung cư"
- Hồ sơ cũ đang mang `APARTMENT` vẫn hiển thị bình thường

---

### `[x]` TN-05 — Thêm trường chức vụ cho tài khoản 🔴 · 0,5 ngày
> Phục vụ **GY-03**

`User` hiện chỉ có `unit` (đơn vị công tác, text tự do), **không có chức vụ**.

- **Tệp:** `apps/api/prisma/schema.prisma` (cột `position`), migration, `apps/api/src/users/dto/create-user.dto.ts` + `update-user.dto.ts`, `packages/shared/src/index.ts` (`UserSummary`, `LoginResponse`)

> ⚠️ **Hạn chế phải nói trước với khách hàng:** dự án **chưa có màn hình quản trị tài khoản trên
> web** — chỉ có API `/api/users` dành cho ADMIN. Sau khi thêm `position`, việc điền chức vụ phải
> làm qua API hoặc seed. Nếu khách hàng muốn tự nhập → xem **TN-25** *(TN-00 câu 5)*.

**Tiêu chí nghiệm thu**
- Đăng nhập trả về chức vụ trong thông tin người dùng
- Tài khoản cũ chưa có chức vụ: giao diện bỏ qua phần đó, **không hiện chuỗi rỗng hay `undefined`**

---

### `[ ]` TN-06 — Nhập danh mục ấp cho các xã 🔴 · 0,25 ngày
> Phục vụ **GY-11**, **GY-22**

**Chủ yếu là việc dữ liệu, không phải việc code.** Màn `/houses/addresses` **đã hỗ trợ Thôn/Ấp đầy
đủ** (thêm/sửa/xoá) — ADMIN nhập thẳng danh mục ấp cho **từng xã đang triển khai** qua giao diện.

Chỉ viết thêm script nhập hàng loạt *(khuôn idempotent của `seedAddressCatalogSample()` trong
`apps/api/prisma/seed.ts`)* **nếu** khách hàng cung cấp danh sách dài nhiều xã.

- **Phụ thuộc:** TN-00 (câu 1, 2)

**Tiêu chí nghiệm thu**
- Mỗi xã đang triển khai có đủ danh mục ấp, hiện đúng trong `/houses/addresses`
- Ấp của xã này **không** lẫn sang xã khác trong ô chọn *(ràng buộc `unique(name, wardId)` đã có sẵn)*
- Nếu dùng script: chạy lần hai không nhân đôi dữ liệu

---

## ĐỢT 2 — DỮ LIỆU ẤP

> **Bối cảnh:** bảng `Hamlet` và API `/api/hamlets` **đã có đủ từ Phase 6**, nhưng **chưa form nào
> thu thập** — nên hiện **không có dữ liệu nào** để báo cáo theo ấp. Đây là nhóm việc nặng nhất đợt này.

### `[x]` TN-07 — Ô Ấp trong form khảo sát mobile 🔴 · 1 ngày
> Đáp ứng **GY-22**

Thay ô *Phường/Xã* (`SurveyScreen.tsx:463`) bằng ô **Ấp**, nạp từ
`/api/hamlets?wardId=<xã đang làm việc>` *(TN-03)*.

- **Tệp:** `apps/mobile/src/screens/SurveyScreen.tsx`, `apps/mobile/src/lib/surveyStore.ts` (`SurveyDraft.hamletId` + gửi kèm trong `syncDraft()`), `apps/mobile/src/lib/addressCatalog.ts` (`fetchHamlets`)
- **Phụ thuộc:** TN-03, TN-06

> ✅ **API không phải sửa** — `CreateHouseDto.hamletId` đã nhận sẵn từ Phase 6.

**Tiêu chí nghiệm thu**
- Chọn ấp từ danh mục, **không gõ tay tự do**
- Nháp cũ lưu trước khi cập nhật (chưa có trường ấp) vẫn mở và đồng bộ được, không văng
- Tạo hồ sơ khi **tắt mạng** → bật lại → hồ sơ lên server **có đúng ấp**

---

### `[x]` TN-08 — Bỏ ô Quận/Huyện, xã tự điền theo ngữ cảnh 🔴 · 0,5 ngày
> Đáp ứng **GY-20**, **GY-21**

- **Bỏ** ô *Quận/Huyện/TP* (`SurveyScreen.tsx:477`) — Tây Ninh là tỉnh một cấp.
- Ô **Xã/Phường**: **tự điền** theo xã đang làm việc (TN-03) nhưng **vẫn đổi được**.

> ⚠️ **Không khoá cứng ô xã.** Khách hàng xác nhận có cán bộ phụ trách nhiều xã — khoá cứng sẽ chặn
> đúng nhóm người dùng đó. Tự điền là để đỡ thao tác, không phải để giới hạn.

> ✅ **Yêu cầu "đường chỉ trong xã" đã có sẵn** — `SurveyScreen.tsx:450` đang lọc đường theo
> `wardId` đã chọn, **không phải viết logic lọc mới**.

- **Tệp:** `apps/mobile/src/screens/SurveyScreen.tsx`
- **Phụ thuộc:** TN-03

**Tiêu chí nghiệm thu**
- Không còn ô Quận/Huyện trên form khảo sát
- Mở form khi đang có nhiệm vụ → ô xã **tự điền đúng xã của nhiệm vụ**
- Đổi sang xã khác được, và danh sách đường đổi theo ngay
- Hồ sơ tạo ra luôn có đủ dữ liệu xã/phường ở phía server, **không để trống**

---

### `[x]` TN-09 — Ô Ấp trong form nhà trên web 🔴 · 0,5 ngày
> Bảo đảm dữ liệu ấp không bị thủng khi nhập từ web *(quyết định #3)*

Tái dùng **`AddressComboField`** đã có sẵn tại `apps/web/src/app/houses/page.tsx:51` — đúng thành
phần web đang dùng cho Đường và Phường.

- **Tệp:** `apps/web/src/app/houses/page.tsx`
- **Phụ thuộc:** TN-03, TN-06

**Tiêu chí nghiệm thu**
- Thêm và sửa hồ sơ trên web đều chọn được ấp; danh sách ấp lọc theo xã đã chọn
- Ấp đã chọn hiện đúng trong ngăn chi tiết hồ sơ và trong lịch sử thay đổi

---

### `[x]` TN-10 — Báo cáo hai mức: xã → ấp (API) 🔴 · 2 ngày
> Đáp ứng **GY-11**, **GY-12**

`GET /api/dashboard/summary` nhận thêm tham số **tuỳ chọn `wardId`**, trả số liệu theo hai mức:

| Tham số | Kết quả trả về |
|---|---|
| **Có `wardId`** | `byHamlet` = đủ ấp của xã đó · `byStreet` = đủ đường của xã đó *(kể cả mục 0 nhà)* |
| **Không có** | `byWard` = gộp theo xã toàn tỉnh, mỗi xã 2 chỉ số; giữ `topStreets` như hiện tại |

**Khác biệt so với `topWards`/`topStreets` hiện có** — lý do phải viết mới chứ không sửa cái cũ:

| | `topWards` / `topStreets` hiện tại | `byWard` / `byHamlet` / `byStreet` mới |
|---|---|---|
| Số dòng | Top 5 | **Đủ danh mục, kể cả mục 0 nhà** |
| Nhóm theo | Tên **dạng chữ tự do** | **Mã danh mục** (`wardId`, `hamletId`, `streetId`) |
| Chỉ số | 1 (tổng số nhà) | **2** — đã cấp số · chưa–chờ cấp số |

Hồ sơ cũ chưa gán ấp gom vào nhóm **"Chưa xác định"** *(không ẩn đi — cán bộ cần thấy còn bao nhiêu hồ sơ phải bổ sung)*.

- **Tệp:** `apps/api/src/dashboard/dashboard.service.ts` + DTO query mới, `packages/shared/src/index.ts` (`DashboardSummary`)
- **Phụ thuộc:** TN-06

**Tiêu chí nghiệm thu**
- `...summary?wardId=<X> | jq '.byHamlet'` trả **đủ ấp của xã X**, ấp chưa có nhà hiện `0` chứ không biến mất
- `...summary` **không kèm `wardId`** trả `byWard` gộp đủ mọi xã
- Tổng hai chỉ số của mọi mục + nhóm "Chưa xác định" = tổng số nhà trong phạm vi đang xem
- Thời gian phản hồi không xấu đi rõ rệt so với trước *(đã có 10 truy vấn song song trong hàm này)*

---

## ĐỢT 3 — MÀN HÌNH MOBILE

### `[x]` TN-11 — Đăng nhập: thương hiệu AMS 🟠 · 0,5 ngày
> Đáp ứng **GY-01**

Thay tiêu đề "Tây Ninh GIS / Khảo Sát Thực Địa Số Nhà" bằng logo + **AMS** + `{provinceName}`.

> ⚠️ **Không hiện tên xã ở màn đăng nhập.** Lúc chưa đăng nhập, hệ thống chưa biết người dùng là ai
> nên chưa có ngữ cảnh xã. Tên xã xuất hiện từ màn Tổng quan trở đi (TN-14).

- **Tệp:** `apps/mobile/src/screens/LoginScreen.tsx`
- **Phụ thuộc:** TN-02

**Tiêu chí nghiệm thu:** hiện "AMS — Tỉnh Tây Ninh"; đổi tên tỉnh trong cấu hình thì đổi theo, không phải build lại.

---

### `[x]` TN-12 — Đăng nhập: nút hiện/ẩn mật khẩu 🔴 · 0,25 ngày
> Đáp ứng **GY-02** — khách hàng nêu là *"hiện nay thanh nhập này không hiện được thông tin đăng nhập"*

- **Tệp:** `apps/mobile/src/screens/LoginScreen.tsx:65`

**Tiêu chí nghiệm thu:** bấm con mắt thấy được mật khẩu đang gõ; mặc định vẫn là ẩn.

---

### `[x]` TN-13 — Tổng quan: lời chào có chức vụ và phòng ban 🟠 · 0,5 ngày
> Đáp ứng **GY-03**

`Xin chào {fullName}, {position} {unit}` + xã đang làm việc nếu có — thay dòng
"Báo cáo nhanh tiến độ khảo sát của bạn" (`DashboardScreen.tsx:552-553`).

- **Phụ thuộc:** TN-03, TN-05

**Tiêu chí nghiệm thu**
- Tài khoản thiếu chức vụ hoặc đơn vị vẫn hiện câu chào gọn gàng, **không lòi dấu phẩy thừa**
- Đổi xã đang làm việc → phần xã trong câu chào đổi theo

---

### `[x]` TN-14 — Tổng quan: đổi nhãn khối quản lý nhà 🔴 · 0,25 ngày
> Đáp ứng **GY-04 → GY-08**

| Hiện tại | Đổi thành | Dòng |
|---|---|---|
| Nhà đã khảo sát | **THÔNG TIN QUẢN LÝ NHÀ XÃ {xã đang làm việc}** — chưa chọn xã thì hiện **"— TOÀN TỈNH"** | 558 |
| Tổng số nhà | Tổng số nhà/hộ | 562 |
| Đã có số | Nhà đã cấp số | 569 |
| Chưa có số | Nhà chưa cấp/chờ duyệt số | 581 |
| Cần hiệu chỉnh | Số nhà cần hiệu chỉnh | 593 |

- **Tệp:** `apps/mobile/src/screens/DashboardScreen.tsx`
- **Phụ thuộc:** TN-03 *(tên xã trong tiêu đề)*

---

### `[x]` TN-15 — Tổng quan: bỏ khối thừa và mã tham chiếu 🔴 · 0,25 ngày
> Đáp ứng **GY-09/GY-14**, **GY-15**

- Xoá khối **"Báo cáo số lượng nhà (10.1)"** (dòng 660) — khách hàng chỉ rõ **trùng lặp** với khối quản lý nhà, và nhắc **hai lần** trong góp ý
- Xoá khối **"Tiến độ đánh số (10.11)"** (dòng 833)
- Bỏ mọi mã `(10.x)` khỏi tiêu đề hiển thị — đó là mã tài liệu nội bộ, cán bộ không cần thấy

---

### `[x]` TN-16 — Tổng quan: sắp xếp lại thứ tự khối 🔴 · 0,5 ngày
> Đáp ứng **GY-10**, **GY-13**

| Thứ tự mới | Khối | Ghi chú |
|---|---|---|
| 1 | Lời chào | TN-13 |
| 2 | THÔNG TIN QUẢN LÝ NHÀ XÃ … | TN-14 |
| 3 | Phân loại số nhà | **chuyển lên** từ dòng 700 |
| 4 | Theo ấp | TN-17 |
| 5 | Theo tuyến đường | TN-18 |
| 6 | Nhiệm vụ khảo sát | **chuyển xuống** từ dòng 605 |
| 7+ | Số nhà trùng · Biển số · Tiến độ khảo sát · Hồ sơ · Đồng bộ | giữ nguyên |

- **Phụ thuộc:** TN-14, TN-15

---

### `[x]` TN-17 — Tổng quan: khối "Theo ấp" 🔴 · 0,5 ngày
> Đáp ứng **GY-11**

Thay khối "Theo địa bàn (10.2)" (dòng 719). Mỗi mục hiện **2 chỉ số**: đã cấp số · chưa–chờ cấp số.

**Hiển thị theo ngữ cảnh:**
- **Đang chọn một xã** → liệt kê **đủ ấp của xã đó**
- **Chưa chọn xã (Toàn tỉnh)** → hiện khối **"Theo xã/phường"**; bấm vào một xã thì mở xuống danh sách ấp của xã đó

- **Phụ thuộc:** TN-03, TN-10

**Tiêu chí nghiệm thu**
- Liệt kê **đủ danh mục** trong phạm vi đang xem, **không cắt top 5**, mục 0 nhà vẫn hiện
- Bấm vào một ấp mở được danh sách nhà của ấp đó
- Đổi xã trên bộ chọn → khối này đổi nội dung ngay

---

### `[x]` TN-18 — Tổng quan: khối "Theo tuyến đường" 🟠 · 0,5 ngày
> Đáp ứng **GY-12**

Sửa khối dòng 729 sang dùng `byStreet`, liệt kê **đủ danh mục đường của xã đang chọn** kèm số nhà
từng tuyến. Chưa chọn xã → giữ danh sách top tuyến đường toàn tỉnh như hiện tại.

- **Phụ thuộc:** TN-03, TN-10, TN-00 (câu 3)

---

### `[x]` TN-19 — Tab "Gắn Biển" → "Tra Cứu" 🔴 · 1 ngày
> Đáp ứng **GY-25** — theo quyết định #2, **không mất nghiệp vụ nào**

- `MainTabs.tsx`: đổi `title`/`tabBarLabel` thành **Tra Cứu**, icon sang `magnify`. **Giữ nguyên route name `Plates`** để không phải sửa điều hướng ở nơi khác.
- `PlatesScreen.tsx`: thêm thanh tra cứu ở đầu màn hình, gọi `GET /api/houses?search=` *(đã hỗ trợ tìm theo số nhà, đường, chủ hộ, SĐT, CCCD, mã QR)*. Danh sách **biển chờ gắn** và thao tác *xác nhận đã gắn* / *ghi lý do chưa gắn* giữ nguyên bên dưới.

> ⚠️ Xác nhận gắn biển là **đường duy nhất** để hồ sơ tự chuyển sang trạng thái "Đã cấp biển & QR"
> *(quy tắc BR-40 trong `business-logic.md`)*. Tuyệt đối không bỏ khi đổi tên tab.

**Tiêu chí nghiệm thu**
- Tìm được nhà theo số nhà và theo tên chủ hộ
- Luồng xác nhận gắn biển vẫn chạy trọn vẹn: chọn biển → chụp ảnh → hồ sơ đổi trạng thái

---

### `[x]` TN-20 — Nhiệm vụ: dòng thời gian xử lý 🟠 · 0,75 ngày
> Đáp ứng **GY-19**

Vòng đời giao việc **đã đủ** (ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED/NEEDS_REVISIT), chỉ
thiếu phần "lưu trong nhật ký" khách hàng nhắc.

**Không thêm bảng mới** — dựng dòng thời gian từ các mốc đã có sẵn trong `SurveyAssignment`:
`createdAt` (giao việc) · `submittedAt` (gửi duyệt) · `reviewedAt` + `reviewedBy` + `reviewNote`
(nghiệm thu hoặc yêu cầu khảo sát lại).

- **Tệp:** `apps/mobile/src/screens/AssignmentsScreen.tsx`

---

### `[x]` TN-21 — Địa chỉ đầy đủ 5 cấp 🟠 · 0,5 ngày
> Đáp ứng **GY-26**

Hàm dựng chuỗi dùng chung: `{số nhà} {đường}, {ấp}, xã {xã}, {tỉnh}`.

- **Tệp:** `packages/shared/src/index.ts` *(cho web + mobile)*, áp dụng ở ngăn chi tiết hồ sơ trên mobile và web

> ⚠️ **API không import được** hàm này khi chạy `node dist/main.js` — cùng lý do với
> `BUILDING_TYPE_LABELS_VI` *(chú thích `houses.service.ts:32-39`)*. Nếu xuất Excel cần chuỗi này
> thì viết bản cục bộ bên API, theo đúng tiền lệ đã có.

- **Phụ thuộc:** TN-07, TN-09

---

## ĐỢT 4 — HOÀN THIỆN

### `[x]` TN-22 — Bản đồ: lọc theo ấp và đường 🟠 · 0,75 ngày
> Đáp ứng **GY-17** *(phần làm được)*

`MapScreen.tsx` hiện chỉ có ô tìm kiếm + chip lọc trạng thái. Bổ sung lọc theo **ấp** và **đường**.

- **Phụ thuộc:** TN-07

---

### `[x]` TN-23 — Giao diện: đồ hoạ và màu sắc 🟠 · 2 ngày
> Đáp ứng **GY-16**, **GY-27** — khách hàng nêu *"hiện chỉ hiển thị thông tin rất đơn điệu"*

Phạm vi: màn **Tổng quan** và **Khảo sát**. Thẻ số liệu có icon tròn màu, thanh tiến độ cho các chỉ
số phần trăm, phân nhóm khối rõ ràng hơn.

**Tái dùng bảng màu đã có** ở đầu `DashboardScreen.tsx` (`OK_BADGE`, `WARN_BADGE`, `BAD_BADGE`,
`CARD_COLOR`) — **không tạo hệ màu thứ hai**.

---

### `[x]` TN-26 — Cập nhật tài liệu nghiệp vụ 🟠 · 0,75 ngày

Sau khi các công việc trên xong, cập nhật `business-logic.md`: loại công trình (6 giá trị), trường
ấp trong từ điển dữ liệu, chức vụ trong tài khoản, chỉ tiêu báo cáo theo ấp, và đóng các khoảng
trống đã xử lý. Nâng phiên bản tài liệu lên 1.1.

---

## TỒN ĐỌNG — CHẶN HOẶC CHỜ QUYẾT ĐỊNH

### `[!]` TN-24 — Lớp ranh giới hành chính mới 🔴 *(chặn)*
> **GY-18** — *"hiện lớp này đang dùng thông tin hành chính, địa giới cũ"*

**Bị chặn vì thiếu dữ liệu, không phải vì khó kỹ thuật.** Nền bản đồ Esri/Google cập nhật địa giới
sau sáp nhập rất chậm và **không sửa được từ phía phần mềm**. Cần khách hàng cung cấp file ranh
giới mới (GeoJSON/SHP) thì mới chồng lớp lên bản đồ được — khi có file, ước lượng khoảng 1,5 ngày
cho cả web và mobile.

- **Chặn bởi:** TN-00 (câu 7)

---

### `[!]` TN-25 — Trang quản trị tài khoản trên web 🟡 *(chờ quyết định)*

Chỉ làm **nếu** khách hàng trả lời "có" ở TN-00 câu 5. Dự án hiện **chưa có màn hình quản trị tài
khoản** — API `/api/users` đã đủ chức năng, chỉ thiếu giao diện. Ước lượng ~1,5 ngày, cộng ~0,5
ngày nếu gộp lớp 2 bên dưới.

> 💡 **Khi làm việc này thì gộp luôn lớp 2 của mô hình xã:** thêm cột `User.wardId` (xã công tác)
> vào cùng màn quản trị, cạnh trường `position` của TN-05. Cả ba đều vướng đúng một chỗ — thiếu
> giao diện quản trị tài khoản — nên làm một lần sẽ gọn hơn ba lần.

- **Chặn bởi:** TN-00 (câu 5)

---

## TRUY VẾT: GÓP Ý → CÔNG VIỆC

Bảng này bảo đảm **không góp ý nào bị bỏ sót**.

| Mã | Màn hình | Nội dung góp ý | Công việc |
|---|---|---|---|
| GY-01 | Đăng nhập | Logo + tên viết tắt AMS, xã + tỉnh | TN-11 *(chỉ tỉnh — chưa đăng nhập thì chưa biết xã)* |
| GY-02 | Đăng nhập | Ô mật khẩu cần nút con mắt hiện mật khẩu | TN-12 |
| GY-03 | Tổng quan | Lời chào kèm chức vụ và phòng ban | TN-05, TN-13 |
| GY-04 | Tổng quan | "Nhà đã khảo sát" → "THÔNG TIN QUẢN LÝ NHÀ XÃ …" | TN-03, TN-14 |
| GY-05 | Tổng quan | "Tổng số nhà" → "Tổng số nhà/hộ" | TN-14 |
| GY-06 | Tổng quan | "Đã có số" → "Nhà đã cấp số" | TN-14 |
| GY-07 | Tổng quan | "Chưa có số" → "Nhà chưa cấp/chờ duyệt số" | TN-14 |
| GY-08 | Tổng quan | "Cần hiệu chỉnh" → "Số nhà cần hiệu chỉnh" | TN-14 |
| GY-09 | Tổng quan | Bỏ khối "Báo cáo số lượng nhà (10.1)" | TN-15 |
| GY-10 | Tổng quan | Đưa "Phân loại số nhà" lên sau khối quản lý nhà | TN-16 |
| GY-11 | Tổng quan | "Theo địa bàn" → theo ấp, 2 chỉ số mỗi ấp | TN-03, TN-06, TN-10, TN-17 |
| GY-12 | Tổng quan | "Theo tuyến đường" → đủ danh mục đường kèm số nhà | TN-03, TN-10, TN-18 |
| GY-13 | Tổng quan | Nhiệm vụ khảo sát đưa xuống sau tuyến đường | TN-16 |
| GY-14 | Tổng quan | *(nhắc lại GY-09 — khối 10.1 trùng lặp)* | TN-15 |
| GY-15 | Tổng quan | Bỏ "Tiến độ đánh số (10.11) – 50% đã duyệt" | TN-15 |
| GY-16 | Tổng quan | Bố cục cần đồ hoạ màu, hiện rất đơn điệu | TN-23 |
| GY-17 | Bản đồ | Thanh tìm kiếm đa dạng, dễ dùng | TN-22 |
| GY-18 | Bản đồ | Lớp bản đồ đang dùng địa giới hành chính cũ | **TN-24 (chặn)** |
| GY-19 | Nhiệm vụ | Luồng giao việc khép kín, lưu nhật ký | TN-20 |
| GY-20 | Khảo sát | Quận/Huyện/TP → xã + tỉnh | TN-03, TN-08 *(bỏ Quận/Huyện; xã theo ngữ cảnh, vẫn đổi được)* |
| GY-21 | Khảo sát | Đường/phố chỉ hiện đường trong xã | TN-08 *(đã có sẵn một phần)* |
| GY-22 | Khảo sát | "Phường/Xã" → "Ấp" kèm danh mục ấp | TN-03, TN-06, TN-07 |
| GY-23 | Khảo sát | Bổ sung Công ty/Nhà máy, Khu dân cư | TN-04 |
| GY-24 | Khảo sát | "Chung cư đô thị" → "Nhà chung cư" | TN-04 |
| GY-25 | Gắn biển | Đổi thành TRA CỨU, thêm thanh tra cứu | TN-19 |
| — | Đã lưu | *Khách hàng chưa có góp ý* | — |
| GY-26 | Thông tin hộ | Địa chỉ đủ: số nhà, đường, ấp, xã, tỉnh | TN-21 |
| GY-27 | Chung | Cải thiện giao diện toàn bộ | TN-23 |

---

## GHI CHÚ KHI THỰC HIỆN

**Mobile không build được trên máy phát triển hiện tại** — thiếu Android SDK và Xcode, đã ghi rõ ở
`apps/mobile/README.md`. Phải build trên máy có môi trường native. Trước khi chạy thử, kiểm tra
`apps/mobile/src/lib/api.ts` — hiện đang trỏ `API_URL = 'https://rv.librasoft.vn'`.

**Danh sách kiểm thử tay trên máy thật** *(bám sát đúng góp ý)*:

1. Đăng nhập — thấy **AMS — Tỉnh Tây Ninh**; bấm con mắt thấy được mật khẩu đang gõ
2. Tổng quan — lời chào có chức vụ; đúng 7 khối theo thứ tự mới; **không còn** khối 10.1 và 10.11
3. **Chọn nhiệm vụ** ở tab Nhiệm Vụ → tiêu đề Tổng quan và Khảo sát **tự đổi sang xã của nhiệm vụ**
4. **Đổi xã** trên bộ chọn → danh mục ấp/đường và số liệu đổi theo ngay; chọn "Tất cả xã" → hiện "Toàn tỉnh"
5. Tổng quan — khối *Theo ấp* liệt kê **đủ ấp của xã đang chọn**, mỗi ấp 2 chỉ số; ở chế độ Toàn tỉnh thì hiện theo xã
6. Khảo sát — không còn ô Quận/Huyện; ô xã **tự điền nhưng đổi được**; có ô **Ấp**; đường lọc theo xã
7. Khảo sát — tạo hồ sơ khi **tắt mạng**, bật lại, hồ sơ đồng bộ và **có ấp** khi xem trên web
8. Tab **Tra Cứu** — tìm được nhà theo số nhà và chủ hộ; **vẫn xác nhận gắn biển được**
9. Nhiệm vụ — thấy dòng thời gian giao việc → gửi duyệt → nghiệm thu
10. Chọn loại công trình — thấy đủ 6 loại, có *Công ty/Nhà máy*, *Khu dân cư*, *Nhà chung cư*

**Kiểm chứng phía máy chủ** *(chạy được ngay tại máy phát triển)*:

```bash
npm run prisma:migrate          # migration 11 chạy sạch, KHÔNG drop house_geom_idx
npm run seed --workspace @tayninh/api
npm run dev:api & npm run dev:web

curl localhost:3001/api/app-config               # không cần token, đúng tên tỉnh + AMS
curl "localhost:3001/api/dashboard/summary?wardId=<X>" -H "Authorization: Bearer <t>" | jq '.byHamlet'
curl localhost:3001/api/dashboard/summary          -H "Authorization: Bearer <t>" | jq '.byWard'
curl "localhost:3001/api/houses/export.xlsx?ward=..." -o /tmp/t.xlsx
```
