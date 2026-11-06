# PWA Khảo sát thực địa (`/survey`)

Mục tiêu: bản web cài được lên iPhone/Android qua Add to Home Screen, chỉ gồm 2 tab **Nhiệm vụ** và **Khảo sát**, dùng đúng API hiện có, bản đầu chỉ online.

## Chốt phạm vi

- Route: `/survey` → `/survey/assignments`; tab Khảo sát: `/survey/field`.
- Chỉ tài khoản có `ASSIGNMENT_EXECUTE`; thiếu quyền hiện thông báo + link `/houses/dashboard`.
- Không service worker, không IndexedDB, không đồng bộ nền. Mất mạng giữ nguyên form và báo lỗi.
- Không sửa API/DB, không thêm dependency.
- `MAX_PHOTOS=5`, `MAX_REQUIRED_PHOTOS=2` (mỗi nhóm mặt tiền/biển số), cảnh báo lệch tuyến `200 m`.

## Checklist triển khai

- [x] 1. PWA assets: manifest, icon 180/192/512, metadata + `appleWebApp` cho `/survey`.
- [x] 2. `SurveyShell`: auth guard, kiểm tra quyền, header đăng xuất, nút cài PWA, 2 tab đáy.
- [x] 3. Lib: API nhiệm vụ/nhà/owner/nearby, session nhiệm vụ đang chọn, nén ảnh trước upload.
- [x] 4. Tab Nhiệm vụ: danh sách, bắt đầu/chọn/gửi duyệt, lịch sử, báo vấn đề, khảo sát lại.
- [x] 5. Tab Khảo sát: GPS, chọn bản đồ, form địa chỉ/chủ hộ/công trình, ảnh, lưu mới + sửa lại.
- [x] 6. Login hỗ trợ `?next=` an toàn để PWA quay lại đúng tab sau đăng nhập.
- [x] 7. Typecheck/build và kiểm tra route/manifest/icon.

## Đã kiểm tra

- `npx tsc --noEmit -p apps/web/tsconfig.json`: đạt.
- `npm run build --workspace @tayninh/web`: đạt, có route `/survey`, `/survey/assignments`, `/survey/field`.
- `next start` smoke test: 3 route + manifest + icon trả 200.

## Ghi chú kỹ thuật

- iOS bắt buộc HTTPS để dùng GPS/camera và Add to Home Screen.
- Manifest `start_url=/survey/assignments`, `scope=/survey/`.
- Icon nguồn: `apps/web/public/ams-mark.png` (340×340).
- Không cache offline: chỉ đăng ký manifest, không đăng ký service worker.
