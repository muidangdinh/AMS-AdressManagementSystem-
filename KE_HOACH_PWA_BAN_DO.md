# Kế hoạch & tiến độ: Tab Bản đồ trong PWA Khảo sát

Mục tiêu: thêm tab **Bản đồ** vào `/survey`, thứ tự **Bản đồ – Nhiệm vụ – Khảo sát**, tái sử dụng `HouseMap`, không đổi API/DB, không thêm dependency.

## Checklist

- [x] Khảo sát pattern `SurveyShell`, `HouseMap`, `HouseMapGoong`, trang `/houses`, API geojson/nearby/detail/location
- [x] Tạo route `/survey/map`
- [x] Tạo `SurveyMap.tsx`: tải nhà theo khung nhìn, tìm kiếm debounce, chip trạng thái
- [x] Bộ lọc Xã → Ấp/Thôn → Đường
- [x] Tra cứu nhà trong bán kính 500m khi chạm nền bản đồ
- [x] Định vị hiện tại + bay tới vị trí
- [x] Bottom sheet chi tiết nhà: địa chỉ, QR, GPS, chủ hộ, công trình, ảnh
- [x] Lightbox ảnh + link chỉ đường Google Maps
- [x] Điều chỉnh vị trí GPS theo quyền `house:location:update`
- [x] Thêm tab Bản đồ đầu tiên trong `SurveyShell` + layout full-height
- [x] Gom Giao thông/Vệ tinh thành icon `Layers` nổi bên phải, trên cụm GPS/thu phóng
- [x] Dời thanh tìm kiếm + chip trạng thái sát mép trên bản đồ
- [x] `HouseMap` nhận `layer` / `onLayerChange` / `showLayerToggle` cho cả Goong, Google, Leaflet
- [x] `npx tsc --noEmit -p apps/web/tsconfig.json`
- [x] `npm run build --workspace @tayninh/web`
- [x] Smoke test: `/survey/map` 200; geojson/detail/nearby/QR API 200; build lại sau thay đổi icon lớp

## Mobile app — nút lớp bản đồ

- [x] `lib/goong.ts`: thêm `GoongLayer`, style `goong_satellite.json`, cache style theo từng lớp
- [x] `GoongMap` nhận prop `layer`, tải style tương ứng và giữ bản đồ khi đổi lớp
- [x] `MapScreen`: icon `layers` nổi trên nút GPS, popup chọn Giao thông/Vệ tinh
- [x] `npx tsc --noEmit -p apps/mobile/tsconfig.json`
- [x] Xác nhận style Goong `goong_map_web.json` và `goong_satellite.json` trả `200`
- [ ] Kiểm tra máy thật/emulator: đổi lớp giữ camera/marker, popup không đè nút GPS/panel nearby

## Sửa số nhà trong 48 giờ

- [x] Thêm quyền `house:number:update` (`HOUSE_NUMBER_UPDATE`) vào API + mirror `packages/shared`
- [x] Gán quyền mặc định cho `admin`, `cadastral`, `surveyor` (RBAC tự đồng bộ khi API khởi động)
- [x] Endpoint `PATCH /api/houses/:id/number` (chỉ sửa số nhà, dùng lại lịch sử cập nhật)
- [x] Chặn non-admin sửa số nhà quá 48 giờ kể từ `House.createdAt`, admin được bỏ qua
- [x] Chặn cả đường bypass qua `PATCH /api/houses/:id` khi non-admin đổi `houseNumber`
- [x] Backend yêu cầu quyền `house:number:update` khi đổi số nhà qua `PATCH /api/houses/:id`
- [x] Modal "Cập Nhật Thông Tin" (`/houses`): khóa ô số nhà + hiện cảnh báo 48h cho non-admin; chặn submit trước khi gọi API
- [x] Mobile `MapScreen`: nút + modal "Sửa số nhà" trong chi tiết hồ sơ
- [x] Web `SurveyMap`: khối "Sửa số nhà (trong 48 giờ)" trong bottom sheet chi tiết
- [x] `npx tsc --noEmit` pass cho API, web, mobile
- [ ] Kiểm tra thủ công: cadastral trong hạn (OK) / quá hạn (403), surveyor qua endpoint mới, admin quá hạn (OK), luồng khảo sát lại vẫn sửa được

## Ghi chú

- Không làm: thêm nhà trên bản đồ, vẽ vùng, offline, deep-link focus, push notification.
- Map provider lấy theo `NEXT_PUBLIC_MAP_PROVIDER` (hiện là `goong`).
- GPS/PWA cần HTTPS hoặc localhost.
- Chưa test bản đồ trên thiết bị thật: cần xác nhận Goong key không chặn domain/IP và cấp quyền GPS.
- Lint mobile còn 3 lỗi cũ ở `DashboardScreen`/`LoginScreen`, không liên quan thay đổi lớp bản đồ.
