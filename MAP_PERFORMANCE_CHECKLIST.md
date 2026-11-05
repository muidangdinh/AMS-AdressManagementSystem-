# Checklist tối ưu hiệu năng bản đồ

Phạm vi: web. Goong dùng clustering native; Leaflet/Google chỉ lazy-load theo khung nhìn.

## Backend

- [x] Thêm `west/south/east/north` vào `GeoJsonQueryDto` và validate
- [x] `findAllGeoJson` lọc theo bbox, giữ nguyên scope và filter hiện có
- [x] Trả `400` khi bbox thiếu một phần hoặc không hợp lệ
- [x] Thêm index `(latitude, longitude)` vào Prisma schema
- [x] Thêm migration index bbox

## Web

- [x] Thêm `MapBounds` và `onBoundsChange` vào `map-types.ts`
- [x] Goong phát bounds khi load/moveend
- [x] Leaflet phát bounds khi load/moveend
- [x] Google phát bounds khi idle
- [x] Goong bật clustering, hiển thị số lượng và zoom khi click cluster
- [x] Trang nhà fetch GeoJSON theo bbox, abort request cũ
- [x] Danh sách bản đồ dùng dữ liệu trong khung nhìn
- [x] Khi chỉnh GPS: ẩn toàn bộ nhà/cluster, chỉ còn marker đang kéo
- [x] Khi chỉnh GPS: dừng fetch lazy-load
- [x] Hủy/Lưu chỉnh GPS: khôi phục cluster và danh sách theo khung nhìn
- [x] Chuyển bảng/bản đồ xoá bounds cũ

## Kiểm tra

- [x] Typecheck web
- [x] Build web
- [x] Typecheck API
- [x] Build API
- [ ] Kiểm tra API bbox hợp lệ/thiếu/sai trên môi trường chạy thật (chưa chạy API/DB)
- [x] Cập nhật checklist này

## Ghi chú

- Bbox dùng index btree `(latitude, longitude)` để tái sử dụng `buildWhere` + `houseScopeWhere`; nếu dữ liệu vượt vài trăm nghìn điểm thì chuyển sang `geom && ST_MakeEnvelope` (GiST đã có).
- Migration cần được áp dụng bằng `prisma migrate deploy` khi triển khai.
