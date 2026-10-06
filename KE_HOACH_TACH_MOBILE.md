# Kế hoạch: Tách phân hệ Khảo sát / Thi công trên mobile app

> Phương án đã chốt: **1 app (1 APK), 2 phân hệ** — vào đúng phân hệ theo quyền, người có cả 2 quyền chuyển qua lại được.

## 1. Bối cảnh / hiện trạng
- `apps/mobile/src/navigation/MainTabs.tsx`: 1 bottom-tab chung 7 tab — Tổng Quan, Bản Đồ, Nhiệm Vụ, Khảo Sát, Thi Công (chỉ hiện khi có `install:execute`), Tra Cứu, Đã Lưu.
- Cán bộ thi công thấy cả các tab khảo sát (không dùng được, gây rối); cán bộ khảo sát không cần Thi Công.
- Quyền đã có sẵn trong `user.permissions` (`lib/AuthContext.tsx`), mã quyền ở `@tayninh/shared` → `PERMISSIONS`.

## 2. Mục tiêu
- Mỗi cán bộ vào thẳng **phân hệ của mình**; giao diện gọn, ít tab.
- Người có cả 2 quyền (cán bộ kiêm nhiệm, admin) **chuyển phân hệ** được, app nhớ lựa chọn lần trước.
- 1 APK, 1 lần build/phát hành; không đổi API.

## 3. Xác định phân hệ theo quyền
| Phân hệ | Điều kiện quyền |
|---|---|
| Khảo sát | `assignment:execute` hoặc `house:create` hoặc `house:resurvey` |
| Thi công | `install:execute` |

- Chỉ có 1 phân hệ → vào thẳng, không hiện nút chuyển.
- Có cả 2 → mặc định phân hệ đã chọn lần trước (AsyncStorage); lần đầu hiện màn chọn phân hệ.
- Không có quyền nào → màn "Tài khoản chưa được cấp quyền dùng app" + nút Đăng xuất.

## 4. Bộ tab mỗi phân hệ
**Khảo sát:** Tổng Quan · Bản Đồ · Nhiệm Vụ · Khảo Sát · Tra Cứu · Đã Lưu (giữ như hiện tại, bỏ Thi Công).

**Thi công:** Nhiệm vụ thi công (`InstallScreen`, tab đầu) · Bản Đồ · Tra Cứu.
- Lý do: cán bộ thi công cần bản đồ để tìm nhà và tra cứu biển/QR khi gắn; Tổng Quan hiện là thống kê khảo sát, Đã Lưu là hàng đợi khảo sát offline → không phù hợp.

## 5. Thiết kế kỹ thuật
- **`lib/appMode.ts`** (mới): kiểu `AppMode = 'survey' | 'install'`, `availableModes(permissions)`, `getSavedMode()` / `saveMode()` (AsyncStorage, theo userId).
- **`lib/AuthContext.tsx`**: thêm `mode`, `setMode`, `availableModes` vào context; tính lại sau đăng nhập/khôi phục phiên; xoá mode khi đăng xuất.
- **`navigation/SurveyTabs.tsx`** và **`navigation/InstallTabs.tsx`** (tách từ `MainTabs.tsx`); `MainTabs` chỉ chọn render 1 trong 2 theo `mode` (giữ route name `Main` nên `NotificationsScreen`, `NotificationBell`, `UserProfileMenu` không phải đổi).
- **`screens/ModePickerScreen.tsx`** (mới): 2 thẻ lớn "Khảo sát" / "Thi công" — hiện khi có cả 2 quyền mà chưa chọn.
- **Nút chuyển phân hệ**: thêm mục "Chuyển sang phân hệ Thi công / Khảo sát" vào dropdown `components/UserProfileMenu.tsx` (chỉ hiện khi có cả 2 quyền); header hiện nhãn nhỏ tên phân hệ hiện tại.
- **Thông báo** (`screens/NotificationsScreen.tsx`): bấm thông báo `INSTALL_ASSIGNMENT` khi đang ở phân hệ khảo sát → tự chuyển sang thi công rồi mở tab Thi Công; ngược lại với `SURVEY_ASSIGNMENT`.
- **Đồng bộ nền** (`lib/useAutoSync`): vẫn chạy ở cả 2 phân hệ để hàng đợi khảo sát offline không bị kẹt khi người kiêm nhiệm đang ở phân hệ thi công.
- **Màu nhận diện**: khảo sát giữ xanh dương `#2563eb`; thi công dùng cam `#ea580c` cho `tabBarActiveTintColor`/header để dễ phân biệt.
- **Điều hướng chéo cần rà**: `DashboardScreen` → Map/Assignments/Plates, `PlatesScreen` → Map, `AssignmentsScreen` → Survey. `MapScreen`/`PlatesScreen` dùng chung 2 phân hệ nên route `Map`, `Plates` phải có ở cả 2 bộ tab.

## 6. Các giai đoạn
1. **GĐ1 – Nền tảng:** `appMode.ts`, mở rộng `AuthContext`, tách `SurveyTabs` / `InstallTabs`, màn "chưa có quyền".
2. **GĐ2 – Chuyển phân hệ:** `ModePickerScreen`, mục chuyển trong `UserProfileMenu`, nhãn phân hệ trên header, điều hướng từ thông báo.
3. **GĐ3 – Hoàn thiện:** màu nhận diện, rà điều hướng chéo, kiểm thử trên máy thật với 3 loại tài khoản.

## 7. Kiểm thử
- `npx tsc --noEmit` trong `apps/mobile`.
- `thienkhaosat` (chỉ khảo sát): vào thẳng 6 tab khảo sát, không có Thi Công, không có nút chuyển.
- `thienthicong` (chỉ thi công): vào thẳng 3 tab thi công, tab đầu là nhiệm vụ thi công.
- Tài khoản có cả 2 quyền (admin hoặc vai trò kiêm nhiệm): lần đầu hiện màn chọn; chuyển qua lại bằng menu hồ sơ; tắt/mở app nhớ phân hệ cuối; bấm thông báo thi công khi đang ở khảo sát → tự chuyển.
- Tài khoản không có quyền nào: thấy màn chưa cấp quyền.
- Khảo sát offline khi đang ở phân hệ thi công vẫn đồng bộ khi có mạng.

## 8. Ngoài phạm vi
- Tách 2 APK / build flavor.
- Đổi API hay quyền phía server.
- Dashboard thống kê riêng cho thi công (có thể làm sau).

## 9. Breakdown task

> Ghi chú: `user.permissions` trên mobile là ảnh chụp lúc đăng nhập → đổi vai trò trên web thì app không biết đến khi đăng nhập lại; T1.3 xử lý việc này.

Ước lượng: S ≈ ≤ 0.5 ngày · M ≈ 1 ngày · L ≈ 2 ngày. Tổng ≈ 6–7 ngày công.

### GĐ1 — Nền tảng
| ID | Task | File | Cỡ | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|---|
| T1.1 | Tạo `appMode.ts`: kiểu `AppMode`, `availableModes(permissions)` theo bảng mục 3, `getSavedMode(userId)` / `saveMode(userId, mode)` / `clearSavedMode()` | `lib/appMode.ts` (mới) | S | — | Hàm trả đúng `[]`, `['survey']`, `['install']`, `['survey','install']` cho 4 bộ quyền mẫu |
| T1.2 | Mở rộng `AuthContext`: thêm `mode`, `setMode`, `availableModes`; tính mode sau login/khôi phục phiên (1 phân hệ → tự chọn; 2 → lấy mode đã lưu hoặc `null`); xoá mode khi logout | `lib/AuthContext.tsx` | M | T1.1 | `useAuth()` trả `mode` đúng cho 3 loại tài khoản; logout rồi login tài khoản khác không dính mode cũ |
| T1.3 | Làm mới quyền khi mở app: gọi `GET /api/auth/me`, cập nhật `user.permissions` + storage (lỗi mạng thì giữ bản cũ). Kiểm tra `/auth/me` có trả `permissions`, thiếu thì bổ sung phía API | `lib/AuthContext.tsx`, (nếu cần) `api/src/auth/*` | S | T1.2 | Đổi vai trò trên web → mở lại app thấy đúng phân hệ, không cần đăng nhập lại |
| T1.4 | Tách `SurveyTabs.tsx` (6 tab khảo sát, bỏ Thi Công) | `navigation/SurveyTabs.tsx` (mới), `navigation/MainTabs.tsx` | S | — | Giao diện khảo sát y như cũ, không có tab Thi Công |
| T1.5 | Tạo `InstallTabs.tsx`: Thi Công (tab đầu) · Bản Đồ · Tra Cứu; dùng chung header (chuông + hồ sơ) | `navigation/InstallTabs.tsx` (mới) | S | — | 3 tab hiển thị, tab đầu là `InstallScreen` |
| T1.6 | `MainTabs` chỉ chọn render `SurveyTabs` / `InstallTabs` theo `mode`; giữ route `Main`. Gộp kiểu `ParamList` để `navigate('Map')`, `navigate('Plates')` hợp lệ ở cả 2 bộ tab | `navigation/MainTabs.tsx` | S | T1.2, T1.4, T1.5 | `tsc` sạch; đổi `mode` → bộ tab đổi theo |
| T1.7 | Màn "Tài khoản chưa được cấp quyền dùng app" + nút Đăng xuất | `screens/NoAccessScreen.tsx` (mới), `navigation/RootNavigator.tsx` | S | T1.2 | Tài khoản không có quyền khảo sát/thi công thấy màn này |

### GĐ2 — Chuyển phân hệ
| ID | Task | File | Cỡ | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|---|
| T2.1 | `ModePickerScreen`: 2 thẻ lớn Khảo sát / Thi công (icon, mô tả ngắn); chọn → `setMode` + lưu | `screens/ModePickerScreen.tsx` (mới), `navigation/RootNavigator.tsx` | M | T1.2 | Tài khoản có 2 quyền, lần đầu đăng nhập thấy màn chọn; lần sau vào thẳng |
| T2.2 | Mục "Chuyển sang phân hệ …" trong dropdown hồ sơ (chỉ khi có 2 quyền) | `components/UserProfileMenu.tsx` | S | T1.2 | Bấm → đổi bộ tab ngay, lần mở app sau nhớ |
| T2.3 | Nhãn phân hệ hiện tại trên header (vd chip "Khảo sát" / "Thi công") | `navigation/SurveyTabs.tsx`, `InstallTabs.tsx` | S | T1.4, T1.5 | Luôn biết đang ở phân hệ nào |
| T2.4 | Điều hướng từ thông báo: `INSTALL_ASSIGNMENT` khi đang ở khảo sát → `setMode('install')` rồi mở tab Thi Công; `SURVEY_ASSIGNMENT` ngược lại; không có quyền phân hệ đích → chỉ đánh dấu đã đọc | `screens/NotificationsScreen.tsx` | S | T1.6 | Bấm thông báo thi công khi đang ở khảo sát → vào đúng tab Thi Công |
| T2.5 | `useAutoSync` + `syncAllPending` chạy độc lập mode (đã gắn ở `RootNavigator`, chỉ cần kiểm tra không bị unmount khi đổi mode) | `navigation/RootNavigator.tsx`, `lib/useAutoSync.ts` | S | T1.6 | Hồ sơ khảo sát offline vẫn đồng bộ khi đang ở phân hệ thi công |

### GĐ3 — Hoàn thiện & kiểm thử
| ID | Task | File | Cỡ | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|---|
| T3.1 | Màu nhận diện: thi công cam `#ea580c` (tab active, chip header), khảo sát giữ `#2563eb` | `InstallTabs.tsx`, `SurveyTabs.tsx` | S | T2.3 | Nhìn là phân biệt được 2 phân hệ |
| T3.2 | Rà điều hướng chéo: `DashboardScreen` (Map/Assignments/Plates), `PlatesScreen` → Map, `AssignmentsScreen` → Survey, `SurveyScreen` → Assignments — không còn `navigate` tới tab không tồn tại ở phân hệ hiện tại | các màn liên quan | S | T1.6 | Không có lỗi "The action 'NAVIGATE' … was not handled" |
| T3.3 | Kiểm thử máy thật theo mục 7 với `thienkhaosat`, `thienthicong`, admin (2 quyền), tài khoản không quyền | — | M | tất cả | Toàn bộ checklist mục 7 đạt |
| T3.4 | Cập nhật tài liệu: hướng dẫn sử dụng 2 phân hệ, ghi chú phát hành (bump `versionCode`) | `KE_HOACH_TACH_MOBILE.md`, `android/app/build.gradle` | S | T3.3 | Có ghi chú phát hành; build APK mới |

### Thứ tự làm đề xuất
T1.1 → T1.2 → (T1.4 ‖ T1.5) → T1.6 → T1.7 → T1.3 → T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T3.1 → T3.2 → T3.3 → T3.4

### Trạng thái triển khai
- Đã code xong T1.1–T1.7, T2.1–T2.5, T3.1–T3.2 (`tsc --noEmit` mobile sạch).
- Còn lại: T3.3 kiểm thử máy thật, T3.4 ghi chú phát hành / tăng `versionCode` (làm tay khi build).

### Điều chỉnh (sau khi triển khai)
- **Có cả 2 quyền (admin, kiêm nhiệm) → thấy đủ 7 tab, không có màn chọn phân hệ và không có nút chuyển.** Đã gỡ `ModePickerScreen`, mục "Chuyển sang…" trong menu hồ sơ và logic chuyển phân hệ khi bấm thông báo.
- Còn 3 trường hợp: chỉ khảo sát → 6 tab; chỉ thi công → 3 tab; không quyền nào → màn "chưa được cấp quyền".
- Các task T2.1, T2.2, T2.4 (màn chọn, nút chuyển, chuyển khi bấm thông báo) không còn áp dụng; thay bằng `AllTabs` (7 tab).
