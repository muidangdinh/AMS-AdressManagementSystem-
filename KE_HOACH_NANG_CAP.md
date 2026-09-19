# Kế hoạch nâng cấp — Từ MVP lên hệ thống GIS đánh số nhà đầy đủ

> Nguồn đối chiếu: `nghiệp vụ/GIS_SONHA_FEATURE_LIST.docx` (danh sách nghiệp vụ mục tiêu, 2 phân hệ:
> Web quản lý tập trung 13 nhóm + Mobile khảo sát 10 nhóm) và 4 ảnh UI tham khảo trong
> `nghiệp vụ/`. Đối chiếu với codebase hiện tại (xem `KE_HOACH_MVP_PHASES.md` — đã xong Phase 0-3,
> Phase 5 gần xong, Phase 4 mobile chưa build được) và `KE_HOACH_TRIEN_KHAI.md` (kế hoạch dài hạn
> đã có sẵn ở mức khung sườn — tài liệu này cụ thể hoá thành backlog kỹ thuật bám theo codebase
> thật, không lặp lại nội dung khung sườn đó).

## 1. Vì sao cần tài liệu này

`GIS_SONHA_FEATURE_LIST.docx` mô tả một **hệ thống ở quy mô rất lớn** so với MVP hiện tại: có quy
trình "lập phương án đánh số" chính thức, quản lý biển số như một tài sản vật lý riêng (kho, sản
xuất, thu hồi, cấp đổi), phân hệ hồ sơ - quy trình hành chính, danh mục địa chỉ chuẩn hoá nhiều
cấp, tích hợp LGSP/NGSP/CSDL đất đai - dân cư, và phân quyền theo địa bàn/lớp GIS. MVP hiện tại
chỉ có **1 bảng `House` phẳng** (ward/street là chuỗi tự do, không có danh mục), 3 vai trò đơn
giản, và một luồng CRUD trực tiếp không qua quy trình phê duyệt.

Mục tiêu tài liệu: (1) đối chiếu rõ cái gì đã có / chưa có, (2) chỉ ra **quyết định kiến trúc phải
chốt sớm** vì ảnh hưởng lan toả, (3) đề xuất lộ trình nâng cấp theo từng phase kế thừa được code
hiện tại, tránh viết lại từ đầu.

## 2. Đối chiếu hiện trạng MVP với danh sách nghiệp vụ mục tiêu

Ký hiệu: ✅ đã có · 🟡 có một phần/thô sơ · ⬜ chưa có.

### Phân hệ 1 — Web quản lý tập trung

| # | Nhóm chức năng (mục tiêu) | Hiện trạng MVP | Ghi chú |
|---|---|---|---|
| 1 | Dashboard tổng quan | 🟡 | Chỉ có 4 số liệu trạng thái (`GET /houses/stats`) trong header trang `/houses`; chưa có trang dashboard riêng, chưa có biểu đồ theo thời gian, chưa có bản đồ trạng thái tổng quan, chưa có "cảnh báo dữ liệu bất thường". |
| 2 | Quản lý bản đồ GIS | 🟡 | Có bản đồ Leaflet 2 nền (OSM/vệ tinh), marker theo trạng thái, tìm lân cận (`ST_DWithin`). Chưa có: quản lý layer bật/tắt tuỳ ý, quản lý địa giới/tuyến đường/thửa đất như đối tượng GIS riêng, đo khoảng cách/diện tích, chồng lớp, bản đồ chuyên đề, xuất/in bản đồ. |
| 3 | Quản lý CSDL nhà | 🟡 | `House` có hầu hết field (số nhà, GPS, đường, phường, loại công trình, số tầng, ảnh, lịch sử). **Thiếu**: mã định danh nhà chuẩn (đang dùng `id`/`qrCode` tạm), "tình trạng sử dụng" riêng biệt, tài liệu đính kèm (chỉ có ảnh). |
| 4 | Quản lý dữ liệu địa chỉ | ✅ (Phase 6, xong 2026-08-25) | 5 bảng danh mục District/Ward/Hamlet/Street/Alley + trang quản trị `/houses/addresses` + dropdown trên form House (web+mobile). **Còn thiếu trong nhóm này**: chuẩn hoá/phát hiện trùng-thiếu-sai tự động (4.6-4.10), quản lý địa chỉ cũ/mới có lịch sử riêng (4.11-4.12 — hiện chỉ có `district` cột đơn, không phải bảng lịch sử đổi địa chỉ), field Thôn/Ấp chưa lên form House dù đã có bảng+API. |
| 5 | Đánh số nhà (lập phương án, đánh số tự động, kiểm tra, phê duyệt) | ✅ (Phase 7, xong 2026-08-25) | Module `numbering-schemes` đầy đủ vòng đời DRAFT→SUBMITTED→APPROVED/REJECTED, sinh số chẵn/lẻ hoặc liên tục, kiểm tra trùng/thiếu/sai tuyến, UI `/houses/numbering`. **Còn thiếu**: xem trước trên bản đồ GIS (mới có bảng), chưa tạo House mới thẳng từ trong phương án, chưa có chế độ "theo đoạn"/"khu dân cư"/"khu đô thị"/"công trình đặc thù" riêng biệt (chỉ có 2 chế độ chẵn-lẻ/liên tục chung), chưa có màn hình khảo sát-phương án trên mobile (nhóm 6 mobile). |
| 6 | Quản lý biển số nhà | ✅ (Phase 8, xong 2026-08-25) | `HousePlate` tách khỏi `qrCode` cũ — cấp mới/cấp đổi/cấp lại/thu hồi/xác nhận gắn đầy đủ, panel trong drawer House. **Còn thiếu**: quản lý kho/mẫu/sản xuất biển (6.1, 6.6-6.9) — bỏ qua có chủ đích, biển luôn cấp thẳng cho 1 nhà cụ thể. |
| 7 | Quản lý khảo sát thực địa | ✅ (Phase 9, xong 2026-08-25) | Đợt → phân vùng (theo Xã/Phường) → giao nhiệm vụ, vòng đời ASSIGNED→IN_PROGRESS→SUBMITTED→COMPLETED/NEEDS_REVISIT, duyệt cả đợt tách khỏi duyệt từng House. **Không làm**: theo dõi vị trí GPS real-time của cán bộ (7.6 gốc) — chỉ có tiến độ qua số nhà đã tạo. |
| 8 | Dữ liệu từ các phòng ban (import Excel/SHP/GeoJSON, đối soát) | ⬜ | Chỉ có export Excel; chưa có import ở bất kỳ định dạng nào, chưa có đối soát/phát hiện trùng. |
| 9 | Hồ sơ – quy trình | ✅ (Phase 10, xong 2026-08-25) | `HouseCase` — lớp theo dõi mỏng bọc ngoài House/NumberingScheme/SurveyAssignment/HousePlate: tiếp nhận→phân công→thẩm định→khảo sát→lập phương án→duyệt→cấp biển→trả kết quả (tiến tuyến tính, không gate phức tạp — các module con đã tự validate rồi), có số hồ sơ tự sinh (HS-2026-xxxxxx) và dòng thời gian xử lý (9.12). |
| 10 | Báo cáo – thống kê | 🟡 | Có `stats` cơ bản + export Excel (theo filter). Chưa có báo cáo theo nhiều chiều (trùng/thiếu/tiến độ), chưa xuất PDF, chưa in bản đồ chuyên đề. |
| 11 | Tra cứu – cung cấp thông tin | 🟡 (nâng lên, Phase 10) | Trang `/lookup/:id` công khai (không đăng nhập) — chỉ hiện field không nhạy cảm, không có tên/SĐT chủ hộ. **Còn thiếu**: mã QR vật lý (`/qrcode.png`) vẫn mã hoá chuỗi định danh thô, chưa mã hoá URL trang tra cứu — cần chốt domain công khai thật trước khi đổi (xem mục 4, quyết định #7 mới); chưa có tra cứu hồ sơ công khai theo số HS-xxx (chỉ tra được số nhà). |
| 12 | Tích hợp – liên thông (LGSP/NGSP/một cửa/...) | ⬜ | Không có — phụ thuộc đối tác/hạ tầng bên ngoài tỉnh, ngoài phạm vi tự triển khai kỹ thuật thuần tuý. |
| 13 | Quản trị hệ thống | 🟡 | Có quản lý tài khoản + audit log toàn cục. **Chưa có**: quản lý đơn vị, phân quyền theo địa bàn/GIS layer, danh mục hệ thống, cấu hình nghiệp vụ đánh số, sao lưu/phục hồi qua UI (chỉ có script CLI), quản lý phiên đăng nhập. |

### Phân hệ 2 — Mobile khảo sát

| # | Nhóm | Hiện trạng | Ghi chú |
|---|---|---|---|
| 1 | Đăng nhập & người dùng | ✅ | JWT dùng chung với web. "Xem nhiệm vụ được giao" nay có ở tab Nhiệm Vụ (Phase 9). |
| 2 | Bản đồ GIS mobile | 🟡 | Có map/marker/GPS/tìm lân cận. Thiếu dẫn đường, đo khoảng cách, hiển thị thửa đất/hẻm riêng. |
| 3 | Khảo sát nhà | ✅ | Form khảo sát đầy đủ field cơ bản (số nhà, đường, thôn/ấp, số tờ/thửa, loại công trình, số tầng). |
| 4 | Chụp ảnh & bằng chứng | 🟡 | Có chụp/chọn nhiều ảnh, phân loại FACADE/CONDITION. Thiếu: gắn toạ độ vào ảnh (EXIF), ghi chú hiện trường dạng field riêng, đính kèm tài liệu khác ảnh. |
| 5 | Kiểm tra & đối soát | ⬜ | Không có phát hiện trùng/sai ngay trên mobile. |
| 6 | Khảo sát phương án đánh số | ⬜ | Vẫn chưa có màn hình mobile cho Phase 7 (numbering scheme) — soạn/sinh số/trình duyệt phương án chỉ làm được trên web. |
| 7 | Quản lý gắn biển số | ✅ (Phase 8, xong 2026-08-25) | Tab "Gắn Biển" — danh sách chờ gắn, chụp ảnh xác nhận đã gắn hoặc ghi lý do chưa gắn. **Thiếu**: quét QR bằng camera (chọn từ danh sách thay vì quét — chưa có lib scan, không thêm native dep chưa kiểm chứng được). |
| 8 | Làm việc Offline | ✅ | Lưu nháp AsyncStorage, tự đồng bộ khi có mạng — đã đúng tinh thần "rất quan trọng" mà tài liệu nhấn mạnh. Thiếu: tải trước dữ liệu khu vực, phát hiện xung đột đồng bộ (hiện chỉ có retry, chưa xử lý conflict 2 chiều). |
| 9 | Quản lý nhiệm vụ | ✅ (Phase 9, xong 2026-08-25) | Tab "Nhiệm Vụ" — xem nhiệm vụ được giao, bắt đầu/gửi duyệt, chọn nhiệm vụ đang khảo sát (banner ở tab Khảo Sát, House mới tự gắn vào). Tiến độ cá nhân = số nhà đã tạo trong nhiệm vụ. |
| 10 | Báo cáo nhanh | ⬜ | Chưa có màn hình tổng kết cá nhân trên mobile. |

**Nhận xét chung (cập nhật 2026-08-25)**: nhóm 3 (khảo sát nhà), 4 (ảnh), 8 (offline) trên mobile
và CRUD House cơ bản trên web đã khá vững từ MVP; nhóm 4 (danh mục địa chỉ, Phase 6) và nhóm 5
(phương án đánh số, Phase 7) trên web nay **đã xong**. Khối còn lại chưa làm và là nguồn gốc của
phần lớn nhóm còn thiếu khác: **(a) biển số như tài sản quản lý riêng** (nhóm 6 web, nhóm 7
mobile), **(b) khảo sát có tổ chức — đợt/phân vùng/phân công/nhiệm vụ** (nhóm 7 web, nhóm 6 & 9
mobile), **(c) hồ sơ – quy trình** (nhóm 9 web, bọc ngoài toàn bộ luồng). Nên ưu tiên (a) rồi (b)
trước vì (c) và các nhóm báo cáo/tra cứu mở rộng phụ thuộc vào chúng — xem chi tiết Phase 8-10 ở
mục 5 bên dưới.

## 3. Tham khảo UI từ ảnh trong `nghiệp vụ/`

4 ảnh là giao diện của một sản phẩm quản lý hộ dân tương tự (không phải sản phẩm Tây Ninh hiện
tại) — dùng để tham khảo pattern UI, không phải đặc tả bắt buộc:

- **Dashboard dạng thẻ số liệu** (`2aOboQtJEp11...jpg`): các card thống kê có icon tròn màu +
  mũi tên xu hướng (+12% so với tháng trước) + số liệu lớn + nhãn phụ. Nên áp dụng cho nhóm 1
  (Dashboard) thay cho 4 badge nhỏ hiện tại ở `apps/web/src/app/houses/page.tsx`.
- **Danh sách dạng thẻ có bộ lọc cấp bậc** (`2aOboQtJEp2f...jpg`): filter theo Tỉnh/TP → Xã/Phường
  dạng chip có thể xoá từng cái ("Xóa bộ lọc"), tổng số kết quả hiển thị rõ, mỗi thẻ có STT, tên
  chủ hộ, tag loại hiện trạng, địa chỉ mới/cũ, số tờ/số thửa, toạ độ, người tạo/ngày tạo, icon
  xem (mắt)/sửa (bút chì). Đây là pattern tốt để nâng cấp danh sách House hiện tại (đang là bảng
  đơn giản) — đặc biệt hữu ích khi thêm "địa chỉ cũ" theo nhóm 4.11 (Quản lý địa chỉ cũ/mới).
- **Trang chi tiết chia block theo chủ đề** (`2aOboQtJEub...jpg`, `2aOboQtJEue...jpg`): header
  gradient "Thông tin cơ bản", rồi từng block card riêng (Địa chỉ mới, Địa chỉ cũ, Toạ độ) thay vì
  một form dài; cuối trang có nút "Mở trong Google Maps". Có thể áp dụng cho drawer chi tiết House
  (`page.tsx` dòng 764-1011) khi tách thành các block rõ ràng hơn, và thêm nút mở Google Maps.

Không có ảnh nào thể hiện quy trình phương án đánh số hay quản lý biển số — 2 phần đó cần thiết kế
UI mới, không có mẫu tham khảo.

## 4. Quyết định kiến trúc cần chốt trước khi làm

1. **Chuẩn hoá địa chỉ có phải làm ngay không?** Đây là nền cho nhóm 4, 5, 8, 11. Nếu làm, cần
   thêm bảng `Ward`/`Street`/`Hamlet` (thôn/ấp/tổ dân phố) và đổi `House.ward`/`House.street` từ
   `String` sang khoá ngoại — **là migration có ảnh hưởng lớn** (toàn bộ filter/GeoJSON/export
   hiện dựa vào text). Đề xuất: làm ở Phase 6 riêng, có kế hoạch migrate dữ liệu cũ (map text hiện
   có sang danh mục mới) trước khi bật ràng buộc khoá ngoại.
2. **Phạm vi hành chính**: ảnh dashboard tham khảo cho thấy "Tỉnh/Thành Phố: 3" — nhưng dự án Tây
   Ninh hiện chỉ phục vụ 1 tỉnh (theo README/kế hoạch). Xác nhận: danh mục địa chỉ chỉ cần
   xã/phường + thôn/ấp + đường/hẻm **trong phạm vi Tây Ninh**, không cần mô hình đa tỉnh — nếu
   đúng thì tiết kiệm được nhiều công sức thiết kế.
3. **Phương án đánh số** là workflow có trạng thái (soạn → thẩm định → phê duyệt → khoá), tách
   biệt với việc sửa 1 căn nhà đơn lẻ hiện tại. Cần entity mới (`NumberingScheme`,
   `NumberingSchemeItem`) và một App Router/Nest module riêng, không nên nhét vào `houses` module
   hiện tại — giữ `houses` module gọn để không phá vỡ luồng CRUD MVP đang chạy ổn.
4. **Biển số vật lý** nên tách khỏi `House.qrCode` (hiện `qrCode` chỉ là mã sinh tự động để in
   tem, 1-1 với House). Nhóm 6 mục tiêu cần biển số có vòng đời riêng (kho → sản xuất → bàn giao →
   lắp đặt → có thể thu hồi/cấp lại nhiều lần cho cùng 1 nhà) — cần bảng `HousePlate` riêng, quan
   hệ 1-nhiều với `House` (lịch sử các lần cấp/thu hồi biển).
5. **Khảo sát có tổ chức** (đợt/nhiệm vụ/phân công) đổi luồng mobile từ "tự tạo House bất kỳ lúc
   nào" sang "nhận nhiệm vụ trước, khảo sát trong phạm vi được giao". Cần quyết định: có bắt buộc
   phải có nhiệm vụ mới được tạo House không, hay vẫn cho tạo tự do và nhiệm vụ chỉ là lớp gợi ý/
   theo dõi tiến độ (ít phá vỡ luồng hiện tại hơn).
6. **Tích hợp LGSP/NGSP/CSDL đất đai-dân cư/một cửa** (nhóm 12) phụ thuộc thủ tục kết nối với các
   hệ thống của tỉnh/bộ ngành — không phải việc code một mình giải quyết được, cần làm việc với đơn
   vị chủ quản trước. Đề xuất **không đưa vào lộ trình kỹ thuật ở đây**, chỉ thiết kế API Gateway
   nội bộ (12.1) có sẵn để dễ nối sau này.
7. **Mã QR trên biển số nên mã hoá gì?** Hiện `/qrcode.png` (House lẫn HousePlate) mã hoá chuỗi
   định danh thô (vd `TN-3F9A21B4`), không phải URL — quét bằng camera điện thoại thường chỉ ra
   text, không tự mở trang tra cứu `/lookup/:id` mới làm ở Phase 10. Đổi sang mã hoá URL đầy đủ
   (`https://<domain-công-khai>/lookup/<id>`) sẽ biến biển số vật lý thành quét-là-mở-web thật sự,
   nhưng cần biết trước **domain công khai thật của hệ thống khi triển khai thật** (chưa có trong
   `.env` hiện tại) — đổi mù có thể làm sai lệch biển đã in/dán ngoài hiện trường nếu đổi domain
   sau này. Đề xuất: chốt domain trước, thêm `NEXT_PUBLIC_SITE_URL`, rồi đổi encode 1 lần duy nhất.

## 5. Lộ trình nâng cấp đề xuất

Đánh số tiếp theo Phase 5 hiện có (`KE_HOACH_MVP_PHASES.md` đã dùng hết Phase 0-5).

### Phase 6 — Danh mục địa chỉ chuẩn hoá (nền tảng, ưu tiên cao nhất)

> **Tiến độ (2026-08-25):** Đã xong phần backend (additive, không phá luồng MVP đang chạy):
> 5 bảng danh mục (`address_district/ward/hamlet/street/alley`, migration
> `5_address_catalog`), 5 module CRUD Nest (`apps/api/src/addresses/`, đọc mở cho mọi vai
> trò, ghi chỉ ADMIN), cột FK tuỳ chọn trên `House` (`wardId`/`streetId`/`hamletId`/`alleyId`/
> `districtId`, giữ song song cột text cũ), seed dữ liệu mẫu (1 quận/huyện "Thành phố Tây
> Ninh", 2 xã/phường, 2 đường) + script backfill tự động gán FK cho House có text khớp tên.
> Đã kiểm chứng qua API thật (login, CRUD danh mục, filter House theo wardId/streetId, chặn
> trùng tên kể cả khi districtId/wardId rỗng). Districts scoped theo tỉnh 1 cấp — xem quyết
> định #2 mục 4 (đã chốt: chuẩn hoá District thành danh mục riêng dù hiện không dùng, để
> tương thích địa chỉ cũ/lịch sử).
>
> **Cập nhật (2026-08-25, tiếp theo):** Đã xong luôn phần frontend, Phase 6 coi như hoàn chỉnh:
> - Trang quản trị danh mục `/houses/addresses` (chỉ ADMIN, link ở header) — 5 tab CRUD
>   Quận/huyện → Xã/phường → Thôn/ấp, và Đường/phố → Hẻm/ngõ, cascading theo cha.
> - Web: bộ lọc "Đường"/"Phường-Xã" trên `/houses` đổi từ text sang dropdown (lọc theo
>   `wardId`/`streetId`); form tạo/sửa House đổi 3 field Đường/Phường/Quận-huyện thành combobox
>   "chọn từ danh mục hoặc + Nhập tên khác…" (`AddressComboField` trong `page.tsx`) — chọn từ
>   danh mục thì lưu cả id lẫn tên hiển thị, nhập tay thì chỉ lưu tên (như cũ, không chặn tạo
>   nhà ở nơi chưa kịp thêm danh mục).
> - Mobile: `SurveyScreen.tsx` có picker dạng modal tìm-kiếm-và-chọn cho Đường/Phường
>   (`AddressPickerField`, dùng Modal+FlatList vì RN không có `<select>`), tự tải danh mục lúc
>   mở màn hình và im lặng bỏ qua nếu offline — không chặn khảo sát ở vùng sóng yếu. `district`
>   trên mobile vẫn giữ nguyên text tự do (chưa làm picker) để giới hạn rủi ro trên nền tảng
>   không tự build/test trực quan được ở máy dev này.
> - Đã kiểm chứng bằng Chrome thật: đăng nhập, filter cascading, tạo nhà mới qua danh mục (xác
>   nhận `wardId`/`streetId`/`districtId` lưu đúng qua API), mở form sửa nhà đã có link (tự vào
>   chế độ chọn, đúng giá trị) và nhà chưa link (tự vào chế độ nhập tay) — cả 2 đường đều đúng.
> - **Lưu ý phát hiện khi test**: `apps/web/.env` đang trỏ `NEXT_PUBLIC_API_URL` sang server
>   thật `https://rv.librasoft.vn` (không phải `http://localhost:3001`) — lúc test phải tạm
>   override biến env khi chạy `npm run dev:web` cục bộ, không sửa file `.env`. Backend Phase 6
>   (bảng/API danh mục mới) **chưa được deploy lên server đó** — cần deploy migration
>   `5_address_catalog` + code mới trước khi web bản thật có thể dùng trang `/houses/addresses`.
> - **Chưa làm** (ngoài phạm vi lần này): field "Thôn/ấp/Tổ dân phố" (`hamletId`) chưa có ở form
>   House trên cả web và mobile dù đã có bảng + API `Hamlet` — nhóm 4.3 vẫn còn "để trống" thực
>   tế; contract-migration (bắt buộc FK, bỏ cột text cũ) vẫn để dành cho Phase 6b sau khi có dữ
>   liệu danh mục thật.


- Bảng mới: `Ward` (xã/phường), `Hamlet` (thôn/ấp/tổ dân phố), `Street` (đường), `Alley` (hẻm/ngõ)
  — trong phạm vi 1 tỉnh Tây Ninh (xem quyết định #2 ở trên).
- Script migrate dữ liệu: gom `House.ward`/`House.street` hiện có thành danh mục (distinct values
  → bảng mới), rồi đổi cột sang khoá ngoại.
- API CRUD danh mục (`apps/api/src/addresses/` module mới) + quyền theo vai trò (ADMIN quản lý
  danh mục).
- UI web: trang "Danh mục địa chỉ" trong khu quản trị; đổi các dropdown ward/street trên form
  tạo/sửa House (hiện đang text input tự do — `page.tsx` khu vực modal tạo/sửa) thành select từ
  danh mục.
- Chức năng chuẩn hoá/phát hiện trùng-thiếu-sai (4.6-4.10) làm ở cuối phase này, sau khi danh mục
  ổn định.

### Phase 7 — Quy trình lập phương án đánh số
- Module Nest mới `numbering-schemes/`: entity `NumberingScheme` (khu vực, tuyến đường, điểm
  đầu/cuối, hướng, nguyên tắc chẵn/lẻ) + `NumberingSchemeItem` (số đề xuất cho từng thửa/nhà).
- Engine sinh số tự động theo tuyến (chẵn/lẻ, liên tục, theo đoạn) — thuật toán thuần, không cần
  ML.
- Bộ kiểm tra: trùng số, thiếu số, sai thứ tự, sai tuyến (so khớp với danh mục Phase 6).
- Luồng trạng thái: DRAFT → SUBMITTED → APPROVED (khoá) / REJECTED, lưu lịch sử như
  `HouseHistory` hiện có đang làm (tái dùng pattern `changes: {field, old, new}[]`).
- UI web: màn hình mới "Lập phương án đánh số" (danh sách phương án + màn xem trước trên bản đồ,
  tái dùng `HouseMap.tsx` với overlay số đề xuất).
- Sau khi phương án được duyệt → cập nhật `House.houseNumber` hàng loạt (transaction, tương tự
  transaction tạo/sửa House đã có trong `houses.service.ts`).

> **Tiến độ (2026-08-25): Phase 7 đã hoàn chỉnh cả backend lẫn frontend, kiểm chứng qua API thật
> và Chrome thật.**
> - Backend: 2 bảng mới `numbering_scheme`/`numbering_scheme_item` (migration `6_numbering_scheme`),
>   module `apps/api/src/numbering-schemes/` — CRUD phương án, thêm/sửa/xóa nhà trong phương án,
>   `POST .../generate` (thuật toán sinh số chẵn/lẻ hoặc liên tục theo `sequenceOrder`),
>   `GET .../validate` (số trùng, thứ tự trùng, sai tuyến, thiếu số), `submit`/`approve`/`reject`.
>   Phê duyệt chỉ ADMIN; soạn thảo (tạo/sửa/sinh số/trình duyệt) ADMIN+CADASTRAL; đọc mở mọi vai
>   trò. APPROVED tự động ghi `House.houseNumber` hàng loạt trong transaction + tạo `HouseHistory`
>   (tái dùng đúng pattern cũ), coi như khoá (chặn sửa/approve lại, trả 409).
> - Đã test qua curl: tạo phương án → thêm 4 nhà 2 bên chẵn/lẻ → sinh số (ra đúng 1,3 lẻ và 2,4
>   chẵn) → validate sạch → trình duyệt → phê duyệt → xác nhận House.houseNumber đổi đúng +
>   HouseHistory ghi old/new; luồng từ chối (REJECTED) và sửa-lại-quay-về-DRAFT; chặn sửa/duyệt
>   lại phương án đã khoá (409); CADASTRAL gọi approve bị chặn (403, đúng phân quyền).
> - Frontend web: trang danh sách `/houses/numbering` (filter theo đường/trạng thái, modal tạo
>   phương án) + trang chi tiết `/houses/numbering/[id]` (sửa thông tin khi còn DRAFT/REJECTED,
>   thêm nhà từ tuyến đường qua ô tìm kiếm, sửa bên/thứ tự/số đề xuất trực tiếp trên bảng, banner
>   kiểm tra lỗi, nút Sinh số tự động/Trình duyệt/Phê duyệt/Từ chối/Xóa theo đúng trạng thái+vai
>   trò). Link "Phương án đánh số" thêm vào header, hiện cho mọi vai trò (đọc mở).
> - Đã test full luồng qua Chrome thật: tạo phương án → thêm nhà có sẵn trên tuyến → sinh số →
>   trình duyệt → phê duyệt (ADMIN) → xác nhận số nhà đổi trên trang `/houses` chính — khớp 100%
>   với kết quả test qua API.
> - **Chưa làm** (ngoài phạm vi lần này, như đã nêu ở bước "Sau khi phương án được duyệt" gốc):
>   xem trước trên bản đồ GIS (chỉ có bảng danh sách, chưa overlay lên `HouseMap.tsx`); chưa có
>   cách tạo House mới thẳng từ trong phương án (chỉ gán House đã tồn tại sẵn trên tuyến — nhóm
>   5.1 "xác định điểm đầu/cuối" mới ở dạng mô tả tự do, chưa chọn trên bản đồ).

### Phase 8 — Biển số nhà như tài sản quản lý riêng
- Bảng mới `HousePlate` (mã biển, trạng thái: trong kho/đã cấp/đã gắn/thu hồi, ảnh biển, QR
  code — tái dùng lib `qrcode` đã dùng cho House hiện tại), quan hệ nhiều-1 với `House` qua lịch
  sử cấp/thu hồi.
- API: kho biển, cấp mới/cấp đổi/cấp lại/thu hồi, xác nhận đã gắn (đổi từ field `qrCode` cứng
  trên `House` hiện tại sang tham chiếu `HousePlate` đang active).
- Mobile: màn hình mới "Gắn biển số" (nhóm 7 mobile) — quét QR (dùng camera, có thể tái dùng thư
  viện QR scan phổ biến của RN), xác nhận đúng địa chỉ, chụp ảnh sau khi gắn, cập nhật trạng thái.
- Backward-compat: giữ `House.qrCode`/trang in tem hiện tại hoạt động cho đến khi `HousePlate`
  triển khai xong, tránh gián đoạn quy trình in tem đang dùng thật.

> **Tiến độ (2026-08-25): Phase 8 đã hoàn chỉnh backend + web + mobile, kiểm chứng qua API thật
> và Chrome thật (mobile chỉ qua `tsc`/`eslint`, không build được ở máy này).**
> - Backend: bảng mới `house_plate` (migration `7_house_plate`, module
>   `apps/api/src/house-plates/`) — 1 endpoint `POST /house-plates` xử lý cả cấp mới/cấp đổi/cấp
>   lại (phân biệt bằng `reason`, tự thu hồi biển đang hiệu lực khi cấp đổi/cấp lại trong cùng
>   transaction), `POST :id/install` (xác nhận đã gắn — **tự động đồng bộ `House.status` sang
>   APPROVED** đúng theo comment "Đã cấp biển & QR" có sẵn trong schema, kèm `HouseHistory`),
>   `POST :id/not-installed` (ghi lý do chưa gắn, không đổi status), `POST :id/revoke`,
>   `GET :id/qrcode.png` (public). Phân quyền: cấp/thu hồi ADMIN+CADASTRAL; xác nhận
>   gắn/chưa-gắn mở thêm cho SURVEYOR (thao tác hiện trường). **Không làm** quản lý kho/mẫu/sản
>   xuất biển (6.1, 6.6-6.9) — biển luôn cấp thẳng cho 1 nhà cụ thể, không qua kho vô danh (quyết
>   định scope, ghi rõ trong code).
> - Đã test qua curl: cấp mới → chặn cấp mới lần 2 khi đã có biển active (409) → ghi nhận chưa
>   gắn → xác nhận gắn (House.status PENDING→APPROVED tự động, có HouseHistory) → chặn gắn lại
>   biển đã INSTALLED (409) → cấp đổi (biển cũ tự REVOKED kèm lý do, biển mới ISSUED) → tra lịch
>   sử biển theo nhà → QR public 200 → thu hồi. Phân quyền: SURVEYOR cấp biển bị chặn (403),
>   SURVEYOR xác nhận gắn được phép (201), SURVEYOR thu hồi bị chặn (403) — đúng thiết kế.
> - Web: panel "Biển số nhà" trong drawer chi tiết House (`apps/web/src/app/houses/page.tsx`) —
>   không tạo route riêng vì biển luôn gắn với 1 nhà cụ thể. Hiện biển đang hiệu lực + QR + nút
>   Xác nhận đã gắn/Cấp đổi/Cấp lại/Thu hồi theo đúng trạng thái, lịch sử biển cũ dạng collapse.
>   Test qua Chrome: cấp biển → xác nhận gắn (xác nhận cả badge dashboard header tự cập nhật số
>   liệu) → thu hồi — khớp 100% với test API.
> - Mobile: tab mới "Gắn Biển" (`PlatesScreen.tsx`) — danh sách biển `ISSUED` (chờ gắn), chọn 1
>   biển → chụp ảnh xác nhận đã gắn (dùng lại `launchCamera` như `SurveyScreen`) hoặc ghi lý do
>   chưa gắn qua modal nhập tay. **Không quét QR bằng camera** — chưa có thư viện scan trong dự
>   án, thêm mới cần native-link (pod install/gradle) không kiểm chứng được ở máy dev này; cán bộ
>   chọn thẳng từ danh sách thay vì quét, tác dụng nghiệp vụ tương đương.

### Phase 9 — Khảo sát có tổ chức (đợt/phân công/nhiệm vụ)
- Bảng mới: `SurveyCampaign` (đợt khảo sát), `SurveyZone` (phân vùng), `SurveyAssignment` (giao
  cán bộ + khu vực + hạn).
- Mobile: tab "Nhiệm vụ" mới (nhóm 9 mobile) hiển thị khu vực/số nhà được giao, tiến độ cá nhân;
  `SurveyScreen.tsx` hiện tại chuyển từ "tạo tự do" sang có ngữ cảnh nhiệm vụ (theo quyết định #5).
- Web: màn hình phân công (chọn cán bộ + khu vực trên bản đồ), theo dõi tiến độ đợt khảo sát,
  duyệt/yêu cầu khảo sát lại (tách khỏi việc duyệt từng House như hiện tại).
- Đồng bộ: nâng cấp `surveyStore.ts`/`useAutoSync.ts` để xử lý xung đột 2 chiều (8.7 — hiện chỉ có
  retry một chiều).

> **Tiến độ (2026-08-25): Phase 9 đã hoàn chỉnh backend + web + mobile, kiểm chứng qua API thật
> và Chrome thật (mobile chỉ `tsc`/`eslint`).**
> - Quyết định #5 đã chốt cùng người dùng: **không bắt buộc** có nhiệm vụ mới được tạo House —
>   `House.surveyAssignmentId` chỉ gắn tự động khi SURVEYOR đang có nhiệm vụ active lúc tạo,
>   không chặn luồng khảo sát tự do. Phân vùng gán theo Xã/Phường có sẵn (Phase 6), không vẽ polygon.
> - Backend: 3 bảng mới `survey_campaign`/`survey_zone`/`survey_assignment` (migration
>   `8_survey_organization`), module `apps/api/src/surveys/`. Vòng đời assignment
>   ASSIGNED→IN_PROGRESS (SURVEYOR tự bấm)→SUBMITTED (tự gửi)→COMPLETED/NEEDS_REVISIT (ADMIN/
>   CADASTRAL duyệt cả đợt) — NEEDS_REVISIT mở lại được qua `start` lần nữa. Thêm endpoint hẹp
>   `GET /survey-assignments/surveyors` để CADASTRAL (không có quyền `/api/users`) vẫn lấy được
>   danh sách SURVEYOR khi giao việc.
> - **Phát hiện & sửa 1 bug có sẵn từ trước Phase 9**: `POST /api/houses` và
>   `POST /api/houses/:id/photos` chỉ cho ADMIN+CADASTRAL, nhưng mobile (SURVEYOR) lại gọi đúng
>   2 endpoint này để đồng bộ hồ sơ khảo sát — nghĩa là SURVEYOR **chưa bao giờ đồng bộ thành công
>   được** trong suốt MVP trước đó (chỉ lưu offline mãi mãi). Đã thêm `Role.SURVEYOR` vào 2 endpoint
>   này (giữ nguyên PATCH/xoá ảnh chỉ ADMIN+CADASTRAL — SURVEYOR không sửa hồ sơ người khác).
> - Đã test qua curl: tạo đợt→phân vùng→giao việc→SURVEYOR xem "nhiệm vụ của tôi"→bắt đầu→**tạo
>   nhà thành công (xác nhận bug trên đã sửa)**→đếm tiến độ đúng→gửi duyệt→ADMIN yêu cầu khảo sát
>   lại→SURVEYOR mở lại→gửi lại→ADMIN duyệt hoàn tất; cùng các guard: không tự bắt đầu nhiệm vụ
>   người khác (403), CADASTRAL không gọi được action của SURVEYOR, chỉ giao được cho tài khoản
>   role SURVEYOR (400 nếu không đúng), không xoá được đợt/phân vùng còn dữ liệu con (409).
> - Web: trang `/houses/surveys` (danh sách đợt) + `/houses/surveys/[id]` (thêm phân vùng, giao
>   việc, duyệt/yêu cầu khảo sát lại cho nhiệm vụ SUBMITTED). Test qua Chrome: tạo đợt→thêm phân
>   vùng→giao việc cho SURVEYOR có sẵn (Lê Thị Sương) — khớp với dữ liệu thật trong hệ thống.
> - Mobile: tab "Nhiệm Vụ" (`AssignmentsScreen.tsx`) — xem/bắt đầu/gửi duyệt/chọn nhiệm vụ hiện
>   tại; `SurveyScreen.tsx` hiện banner nhiệm vụ đang chọn và tự gắn `surveyAssignmentId` khi tạo
>   hồ sơ (kể cả tạo offline — `surveyStore.ts` lưu kèm, gửi lên lúc đồng bộ).
> - **Chưa làm**: theo dõi vị trí GPS real-time của cán bộ (7.6 gốc); xử lý xung đột đồng bộ 2
>   chiều trong `useAutoSync.ts` (vẫn chỉ có retry 1 chiều như trước Phase 9); màn hình mobile cho
>   Phase 7 (khảo sát phương án đánh số, nhóm 6 mobile).

### Phase 10 — Hồ sơ – quy trình & Báo cáo mở rộng
- Entity `Case` (hồ sơ) bọc ngoài luồng House hiện tại: tiếp nhận → phân công → thẩm định → khảo
  sát → lập phương án → phê duyệt → cấp số → cấp biển → trả kết quả — tái dùng các module Phase
  7-9 làm bước con của quy trình này thay vì xây lại.
- Báo cáo: bổ sung các báo cáo theo nhiều chiều (trùng/thiếu/tiến độ khảo sát/tiến độ gắn biển),
  xuất PDF (thư viện kiểu `pdfkit`/`puppeteer`, tương tự cách `exceljs` đang dùng cho Excel).
- Tra cứu công khai: trang tra cứu bằng mã QR không cần đăng nhập (mở rộng từ endpoint public
  `qrcode.png` hiện có, thêm 1 trang hiển thị thông tin công khai không nhạy cảm của nhà/hồ sơ).

> **Tiến độ (2026-08-25): Phase 10 hoàn chỉnh 2/3 phần (Hồ sơ – quy trình + Tra cứu công khai),
> kiểm chứng qua API thật và Chrome thật. Phần "Báo cáo mở rộng" (đa chiều + xuất PDF) hoãn lại —
> xem lý do bên dưới.**
> - Backend: 2 bảng mới `house_case`/`house_case_event` (migration `9_house_case`), module
>   `apps/api/src/cases/`. `HouseCase` là lớp theo dõi MỎNG — chỉ liên kết `houseId` + nhãn trạng
>   thái tuyến tính (RECEIVED→ASSIGNED→REVIEWING→SURVEYING→NUMBERING→APPROVED→PLATE_ISSUED→
>   COMPLETED, hoặc REJECTED bất kỳ lúc nào rồi mở lại được), **không viết lại** quy trình
>   NumberingScheme/SurveyAssignment/HousePlate đã có ở Phase 7-9 — tiến bước chỉ là nhãn hành
>   chính, việc thật vẫn làm ở module riêng của nó. Số hồ sơ tự sinh `HS-<năm>-000001` (đếm theo
>   tiền tố năm). Endpoint hẹp `GET /house-cases/staff` (ADMIN+CADASTRAL) để chọn người phân công,
>   cùng mẫu với `listSurveyors()` ở Phase 9.
> - Endpoint mới `GET /houses/:id/public` (Public, không cần đăng nhập) — chỉ trả field không
>   nhạy cảm (không có tên/SĐT/CCCD chủ hộ), cùng nguyên tắc với `/qrcode.png` public sẵn có.
> - Đã test qua curl: tạo hồ sơ (số hồ sơ đúng tuần tự) → gán cán bộ (tự chuyển RECEIVED→ASSIGNED)
>   → liên kết hồ sơ nhà → tiến tuần tự qua tất cả 8 bước → chặn tiến/từ chối khi đã COMPLETED
>   (409) → luồng từ chối→mở lại ở hồ sơ khác → endpoint public trả đúng dữ liệu không có PII;
>   phân quyền: SURVEYOR đọc được danh sách hồ sơ (mở) nhưng không tạo được (403).
> - Web: `/houses/cases` (danh sách + tạo) + `/houses/cases/[id]` (liên kết nhà qua tìm kiếm,
>   phân công, nút tiến bước theo đúng nhãn bước kế tiếp, từ chối/mở lại, ghi chú, dòng thời
>   gian). Trang công khai `/lookup/[id]` (ngoài layout `/houses`, không có auth guard) — có link
>   "Xem trang tra cứu công khai" từ drawer chi tiết nhà và trang in tem. Test qua Chrome: tạo hồ
>   sơ → liên kết nhà → tiến bước → mở tab ẩn danh xác nhận `/lookup/:id` hoạt động không cần
>   đăng nhập, và trả lỗi thân thiện khi ID không tồn tại.
> - **Phát hiện khi làm**: mã QR in trên biển số/tem hiện tại (`getQrPngBuffer`) chỉ mã hoá chuỗi
>   định danh thô (vd `TN-3F9A21B4`), KHÔNG phải URL — nghĩa là quét bằng camera điện thoại chưa
>   tự mở được trang `/lookup/:id` mới làm. Đã cố tình **không đổi** việc này (xem quyết định #7
>   mục 4) vì cần biết domain công khai thật trước, tránh làm sai lệch biển đã in ngoài hiện
>   trường nếu đổi domain sau. Trang tra cứu hiện chỉ vào được qua link nội bộ hoặc nhập tay URL.
> - **Hoãn "Báo cáo mở rộng"** (đa chiều + xuất PDF): dữ liệu cần cho báo cáo tiến độ khảo sát/
>   đánh số/gắn biển đã có sẵn đầy đủ qua các module Phase 7-9 (`_count`, `stats`...), nhưng ghép
>   thành trang báo cáo tổng hợp + thêm dependency mới (`pdfkit`/`puppeteer`) là một khối việc
>   riêng, không phụ thuộc Case — để dành làm sau như 1 việc độc lập thay vì gộp cố cho xong Phase
>   10, tránh làm giảm chất lượng kiểm thử phần Case/tra cứu quan trọng hơn.

### Phase 11 — GIS nâng cao & Quản trị mở rộng
- Quản lý layer bật/tắt, bản đồ nền tuỳ chọn, đo khoảng cách/diện tích trên `HouseMap.tsx` (Leaflet
  có sẵn plugin `leaflet-measure`/tự viết đơn giản bằng Turf.js), bản đồ chuyên đề (tô màu theo
  field bất kỳ), xuất/in bản đồ.
- Phân quyền theo địa bàn (chỉ thấy/sửa House trong ward được giao) và theo GIS layer — mở rộng
  `RolesGuard` hiện tại (`apps/api/src/auth/guards/roles.guard.ts`) sang kiểm tra phạm vi địa bàn,
  không chỉ vai trò.
- Quản trị: quản lý đơn vị, danh mục hệ thống, cấu hình nguyên tắc đánh số (tham số hoá thay vì
  hard-code), nhật ký hệ thống chi tiết hơn `AuditLog` hiện có, quản lý phiên đăng nhập (revoke
  token), sao lưu/phục hồi qua UI (bọc `scripts/backup.sh` hiện có bằng 1 nút bấm admin).

### Ngoài lộ trình kỹ thuật (phụ thuộc bên ngoài)
- Nhóm 12 (Tích hợp LGSP/NGSP/CSDL đất đai-dân cư/một cửa/cổng dịch vụ công): cần làm việc với đơn
  vị chủ quản hạ tầng tỉnh trước, chỉ chuẩn bị sẵn `API Gateway` nội bộ có auth theo API key khi
  cần expose (12.1, 12.10).
- Nhóm 8 web (Import Excel/SHP/GeoJSON/GDB liên phòng ban + đối soát): nên làm sau Phase 6 (khi đã
  có danh mục địa chỉ để đối soát vào), độ ưu tiên tuỳ theo phòng ban nào thực sự sẵn sàng cấp dữ
  liệu import trước.

## 6. Ước lượng độ lớn (tương đối, không phải deadline)

| Phase | Độ lớn so với Phase 0-5 (MVP) đã làm | Rủi ro chính |
|---|---|---|
| 6 — Danh mục địa chỉ | Trung bình-lớn | Migrate dữ liệu text hiện có, tránh gãy filter/GeoJSON/export đang chạy |
| 7 — Phương án đánh số | Lớn | Thuật toán sinh số + UI xem trước trên bản đồ là phần mới hoàn toàn |
| 8 — Biển số tài sản | Trung bình | Giữ tương thích ngược với `qrCode`/trang in tem hiện tại |
| 9 — Khảo sát có tổ chức | Trung bình-lớn | Đổi hành vi mobile đang chạy thật (SURVEYOR dùng hằng ngày) |
| 10 — Hồ sơ & báo cáo | Lớn | Là lớp quy trình bọc ngoài, dễ phình phạm vi nếu không giới hạn rõ |
| 11 — GIS nâng cao & quản trị | Trung bình | Phân quyền theo địa bàn ảnh hưởng mọi endpoint hiện có |

## 7. Khuyến nghị bước tiếp theo

Bắt đầu **Phase 6 (danh mục địa chỉ)** trước tiên vì mọi nhóm quan trọng khác (5, 6, 7, 9 cả hai
phân hệ) đều phụ thuộc vào nó, và vì đây là thay đổi schema có rủi ro migrate dữ liệu — làm sớm khi
dữ liệu thật còn ít (MVP mới chạy thí điểm) sẽ dễ hơn nhiều so với làm sau khi đã có nhiều nhà đã
nhập. Trước khi code, cần chốt quyết định #1 và #2 ở mục 4 với người phụ trách nghiệp vụ.
