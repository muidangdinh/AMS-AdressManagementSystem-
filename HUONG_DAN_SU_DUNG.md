# Hướng Dẫn Sử Dụng — Hệ Thống GIS Đánh Số & Gắn Biển Số Nhà (Tây Ninh)

> Dành cho **cán bộ địa chính**, **quản trị viên** và **cán bộ khảo sát** dùng phần mềm.
> Phiên bản MVP — thí điểm 1 phường/xã.

---

## 1. Đăng nhập

Mở trình duyệt vào địa chỉ hệ thống (vd `http://<địa-chỉ-server>:3000`), nhập **tên đăng nhập**
và **mật khẩu** được cấp. Sau khi đăng nhập, hệ thống tự chuyển vào trang quản lý số nhà.

Có 3 vai trò:

| Vai trò | Được làm gì |
|---------|-------------|
| **Quản trị viên (ADMIN)** | Toàn quyền: quản lý số nhà, quản lý người dùng, xem thống kê, xuất Excel, in tem |
| **Cán bộ địa chính (CADASTRAL)** | Thêm/sửa hồ sơ số nhà, upload ảnh, xem bản đồ, xuất Excel, in tem — **không** quản lý người dùng |
| **Cán bộ khảo sát (SURVEYOR)** | Xem/tra cứu số nhà, xuất Excel, in tem — **không** thêm/sửa hồ sơ trên web (dùng app khảo sát di động để tạo hồ sơ mới) |

---

## 2. Thanh thống kê tổng quan

Ngay dưới thanh tiêu đề luôn hiển thị 4 chỉ số cập nhật theo thời gian thực:
- 🔵 **Tổng số nhà**
- 🟢 **Đã cấp biển/QR**
- 🟡 **Chờ duyệt**
- 🔴 **Cần hiệu chỉnh**

---

## 3. Xem danh sách & tra cứu

- Dùng ô **Tìm kiếm** để tra theo **số nhà, tên chủ sở hữu hoặc mã QR**.
- Lọc thêm theo **Đường**, **Phường/Xã**, **Trạng thái**.
- Bấm vào 1 dòng trong bảng để mở **hồ sơ chi tiết** (ảnh, chủ sở hữu, tọa độ, mã QR, lịch sử thay đổi).

---

## 4. Xem trên bản đồ

Bấm nút **"Bản đồ"** ở góc trên để chuyển sang chế độ bản đồ:
- Mỗi số nhà là 1 chấm tròn màu (xanh lá = đã cấp, vàng = chờ duyệt, đỏ = cần hiệu chỉnh).
- Bấm vào chấm tròn hoặc vào danh sách bên trái để xem chi tiết + bay tới vị trí.
- Nút **"Giao thông" / "Vệ tinh"** ở góc bản đồ để đổi nền bản đồ.
- **Bấm vào 1 điểm trống trên bản đồ** để tra cứu các số nhà trong bán kính 500m quanh
  điểm đó — kết quả hiện ở danh sách bên trái kèm khoảng cách. Bấm **"Xóa"** để quay lại
  danh sách đầy đủ.

---

## 5. Thêm số nhà mới (Quản trị viên / Cán bộ địa chính)

1. Bấm **"+ Thêm số nhà"**.
2. Điền các trường bắt buộc (*): Số nhà, Đường/Phố, Phường/Xã, Chủ sở hữu, Vĩ độ, Kinh độ.
3. Các trường khác (loại công trình, số tầng, diện tích, số tờ/thửa...) điền nếu có.
4. Bấm **"Lưu"** — hệ thống tự sinh **mã QR định danh** cho hồ sơ.
5. Sau khi lưu, hồ sơ chi tiết tự mở — bấm **"+ Tải ảnh lên"** để đính ảnh mặt tiền/hiện trạng.

## 6. Sửa hồ sơ số nhà

Mở hồ sơ chi tiết → bấm **"Cập Nhật Thông Tin"** → sửa → **"Lưu"**.
Mọi thay đổi được ghi lại ở mục **"Lịch sử thay đổi"** trong hồ sơ (ai sửa, khi nào, đổi trường gì).

---

## 7. In tem QR số nhà

Mở hồ sơ chi tiết → bấm **"In Tem QR"** → mở tab mới hiển thị tem gồm: số nhà, tên đường,
phường/xã, và mã QR để dán lên biển số nhà thực tế. Bấm **"In ngay"** để in trực tiếp
(chọn khổ giấy/tem phù hợp trên hộp thoại in của trình duyệt/máy in).

> Mã QR chỉ chứa 1 chuỗi định danh công khai (không có thông tin cá nhân) — ai quét cũng
> được, không cần đăng nhập.

---

## 8. Xuất Excel

Bấm nút **"Xuất Excel"** ở thanh công cụ — hệ thống xuất file `.xlsx` **theo đúng bộ lọc
đang áp dụng** (nếu đang lọc theo đường/phường/trạng thái/tìm kiếm thì chỉ xuất kết quả đó;
nếu không lọc gì thì xuất toàn bộ, tối đa 5000 dòng).

---

## 9. Quản lý người dùng (chỉ Quản trị viên)

Hiện tại quản lý người dùng thực hiện qua API (`/api/users`) — giao diện quản lý người dùng
trên web sẽ bổ sung ở phiên bản sau. Liên hệ đội kỹ thuật để tạo/khóa tài khoản.

---

## 10. Ứng dụng khảo sát hiện trường (di động)

Cán bộ khảo sát dùng app di động riêng (xem `apps/mobile/README.md`) để:
- Lấy tọa độ GPS tại hiện trường.
- Chụp ảnh mặt tiền căn nhà.
- Nhập thông tin và **lưu offline** nếu không có mạng.
- Tự động đồng bộ lên hệ thống khi có mạng trở lại (hoặc bấm đồng bộ thủ công ở tab "Đã Lưu").

---

## Câu hỏi thường gặp

**Vì sao tôi không thấy nút "+ Thêm số nhà"?**
Tài khoản của bạn là vai trò Cán bộ khảo sát — chỉ được xem/tra cứu trên web, việc tạo hồ
sơ mới thực hiện qua app di động ngoài hiện trường.

**Mã QR quét ra gì?**
Một chuỗi định danh dạng `TN-XXXXXXXX`. Hệ thống tra cứu công khai theo mã này sẽ được bổ
sung ở phiên bản sau (Dịch vụ công trực tuyến).

**Tôi lỡ đăng nhập sai máy/quên đăng xuất, có nguy hiểm không?**
Phiên đăng nhập (JWT) tự hết hạn sau 8 giờ. Nếu tài khoản bị khóa bởi Quản trị viên, phiên
đang đăng nhập sẽ bị từ chối ngay ở lần thao tác tiếp theo.
