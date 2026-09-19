# Tây Ninh GIS — Mobile (Khảo Sát Hiện Trường)

Ứng dụng **React Native CLI thuần** (bare workflow, không dùng Expo) cho cán bộ khảo sát
hiện trường (Phase 4 — VI. Ứng dụng khảo sát hiện trường): lấy GPS, chụp ảnh mặt tiền,
nhập thông tin số nhà, **lưu offline** khi mất mạng và **tự động đồng bộ** khi có mạng trở lại
lên cùng backend NestJS đã dùng cho web quản trị (Phase 1–3).

> **Lưu ý quan trọng:** App này được viết code hoàn chỉnh trên máy chủ dev (không có
> Android Studio/Xcode/dung lượng đĩa hạn chế), nên **chưa được build/chạy thử tại đây**.
> Bạn cần build trên máy có đầy đủ môi trường native theo hướng dẫn bên dưới.

## Vì sao KHÔNG nằm trong `npm install` ở gốc monorepo?

`apps/mobile` **cố ý không** nằm trong `workspaces` của `package.json` gốc — dependencies
của React Native (core + native modules) khá nặng (thường 400–800MB node_modules), trong khi
`npm install` ở gốc chỉ phục vụ web (`apps/web`) + backend (`apps/api`). Tách riêng để:
- `npm install` ở gốc không vô tình kéo theo toàn bộ dependencies RN.
- Máy chủ dev (đĩa hạn chế) không bị ảnh hưởng khi làm việc trên mobile.

`@tayninh/shared` vẫn dùng được nhờ khai báo `"file:../../packages/shared"` trong
`package.json` — npm sẽ tự tạo symlink dù `apps/mobile` không phải workspace của gốc.

## Yêu cầu môi trường (trên máy bạn dùng để build)

Theo [hướng dẫn chính thức React Native — "React Native CLI Quickstart"](https://reactnative.dev/docs/set-up-your-environment):
- Node.js ≥ 22.11 (khớp `engines` trong `package.json`)
- JDK 17
- Android Studio + Android SDK (API 34, build-tools mới nhất) — cho Android
- Xcode + CocoaPods — cho iOS (chỉ trên macOS)

## Cài đặt

```bash
cd apps/mobile
npm install

# iOS only (macOS):
cd ios && bundle install && bundle exec pod install && cd ..
```

## Cấu hình `API_URL`

Sửa `src/lib/api.ts`:

```ts
export const API_URL = 'http://10.0.2.2:3001'; // mặc định cho Android Emulator
```

- **Android Emulator**: giữ nguyên `10.0.2.2` (địa chỉ đặc biệt trỏ về `localhost` của máy host).
- **iOS Simulator**: đổi thành `http://localhost:3001`.
- **Điện thoại thật** (cùng mạng Wi-Fi với máy chạy backend): đổi thành IP LAN thật của máy
  chạy backend, ví dụ `http://192.168.1.10:3001`.
- **Backend chạy trên máy chủ dev từ xa**: đổi thành domain/IP public của máy chủ đó
  (nhớ mở port 3001 hoặc đặt sau reverse proxy HTTPS).

## Cấu hình Google Maps API key (bắt buộc trên Android)

Tab **Bản Đồ** dùng `react-native-maps`. Trên **iOS**, mặc định dùng Apple Maps
(`PROVIDER_DEFAULT`) — **không cần** API key. Trên **Android**, `react-native-maps`
luôn cần Google Maps SDK dù dùng provider nào, nên **bắt buộc** phải có key:

1. Tạo API key ở [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials),
   bật **"Maps SDK for Android"** cho project đó.
2. Tạo/sửa file `android/local.properties` (đã có sẵn trong `.gitignore`, KHÔNG commit —
   giống hệt `sdk.dir` mà Android Studio tự sinh), thêm dòng:
   ```properties
   MAPS_API_KEY=AIza...key_thật_của_bạn
   ```
3. Build lại (`npm run android`) — `android/app/build.gradle` tự đọc key này và
   inject vào `AndroidManifest.xml` qua `manifestPlaceholders` (xem 2 file đó nếu
   cần đổi cách nạp key, ví dụ CI dùng biến môi trường thay vì `local.properties`).

Thiếu key: bản đồ Android hiển thị lưới ô xám (không có tile) thay vì lỗi crash.

## Chạy thử

```bash
# Terminal 1 — Metro bundler
npm start

# Terminal 2 — Android
npm run android

# Terminal 2 — iOS (macOS)
npm run ios
```

Đăng nhập bằng tài khoản đã tạo ở Phase 1 (vd `admin` / mật khẩu seed) — dùng chung
hệ thống xác thực JWT với web quản trị.

## Cấu trúc code

```
src/
  lib/
    api.ts            Fetch wrapper (JWT qua AsyncStorage thay localStorage)
    AuthContext.tsx    Quản lý đăng nhập/đăng xuất, giống hệt web
    surveyStore.ts     Lưu hồ sơ khảo sát offline (AsyncStorage) + đồng bộ lên
                       API House đã có (POST /api/houses, .../photos)
    useAutoSync.ts     Tự động đồng bộ khi thiết bị có mạng trở lại (NetInfo)
  screens/
    LoginScreen.tsx
    MapScreen.tsx      Bản đồ số nhà (react-native-maps) — tìm kiếm/lọc trạng thái,
                       marker màu theo trạng thái, chi tiết hồ sơ, tra cứu theo tọa độ
    SurveyScreen.tsx   GPS + chụp/chọn ảnh + form + Lưu Tạm/Gửi Duyệt
    HistoryScreen.tsx  Danh sách đã khảo sát, trạng thái đồng bộ, đồng bộ thủ công
  navigation/
    RootNavigator.tsx  Stack: Login <-> Main (điều hướng theo trạng thái đăng nhập)
    MainTabs.tsx       Bottom tabs: Bản Đồ / Khảo Sát / Đã Lưu
```

## Tính năng Bản Đồ (`MapScreen.tsx`)

Tương đương chế độ "Bản đồ" trên web (`apps/web` — `/houses`, xem `HouseMap.tsx`),
điều chỉnh cho màn hình di động:

- **Marker theo trạng thái**: cùng bảng màu với web (xanh lá = Đã cấp biển, cam =
  Chờ duyệt, đỏ = Cần hiệu chỉnh), hiển thị số nhà trực tiếp trên marker.
- **Tìm kiếm & lọc**: ô tìm kiếm (debounce 400ms) + chip lọc trạng thái, gọi
  `GET /api/houses/geojson` — cùng endpoint web dùng cho lớp bản đồ.
- **Chi tiết hồ sơ**: bấm marker mở bottom sheet — địa chỉ, chủ sở hữu, loại công
  trình, mã QR, ảnh hiện trạng (`GET /api/houses/:id`).
- **Tra cứu theo tọa độ**: bấm chỗ trống trên bản đồ để tìm số nhà trong bán kính
  500m (`GET /api/houses/nearby`), giống thao tác click bản đồ trên web.
- **Định vị vị trí hiện tại**: nút 📍 dùng GPS (`@react-native-community/geolocation`,
  đã có sẵn quyền `ACCESS_FINE_LOCATION` từ Phase 4).

Không có chức năng thêm/sửa hồ sơ trực tiếp trên bản đồ mobile (khác với web) — mobile
đã có tab **Khảo Sát** riêng cho việc đó.

## Quyền đã khai báo sẵn (native config)

Đã chỉnh sẵn (chỉ chỉnh file cấu hình, chưa build/verify thật):
- **Android** (`android/app/src/main/AndroidManifest.xml`): `ACCESS_FINE_LOCATION`,
  `ACCESS_COARSE_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES` (Android 13+),
  `READ_EXTERNAL_STORAGE` (≤ Android 12).
- **iOS** (`ios/TayNinhGIS/Info.plist`): `NSLocationWhenInUseUsageDescription`,
  `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`.

Khi build lần đầu, nhớ kiểm tra lại các quyền này hoạt động đúng trên thiết bị thật.

## Vì sao dùng House API sẵn có thay vì bảng `survey_record` riêng?

Kế hoạch gốc (`KE_HOACH_MVP_PHASES.md`) dự tính Phase 4 có bảng `survey_record` riêng.
Thay vào đó, app này tạo thẳng **House** qua API đã kiểm thử kỹ ở Phase 2/3
(`POST /api/houses`, `POST /api/houses/:id/photos`) — tránh xây dựng lại một luồng
CRUD + upload ảnh song song không cần thiết. Hồ sơ khảo sát ngoài hiện trường
_chính là_ một hồ sơ số nhà, chỉ khác nguồn tạo (mobile thay vì web quản trị).
