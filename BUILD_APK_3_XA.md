# Build APK 3 xã — Thạnh Hóa / Mỹ An / Tân An

Tài liệu này là nguồn chính thức cho bản mobile 3 xã (từ `versionCode 17`, `versionName 1.16`).
Tài liệu cũ `HUONG_DAN_BUILD_APK.md` chỉ còn dùng tham khảo phần ký/ADB/troubleshooting.

## 1. Trạng thái công việc

- [x] `apps/mobile/variants.json` — nguồn cấu hình duy nhất cho 3 xã
- [x] `android/app/build.gradle` — product flavors: applicationId + tên app riêng
- [x] `android/app/src/main/res/values/strings.xml` — bỏ `app_name` cố định
- [x] `android/gradle.properties` — build cả `arm64-v8a` + `armeabi-v7a`
- [x] `scripts/generate-variant.mjs` — sinh `src/lib/appVariant.ts`
- [x] `src/lib/appVariant.ts` — mặc định Thạnh Hóa (được sinh tự động)
- [x] `src/lib/api.ts` — `API_URL` lấy theo flavor
- [x] `MapScreen.tsx` / `InstallScreen.tsx` — tâm bản đồ lấy theo xã
- [x] `scripts/build-apk.mjs` + `package.json` — lệnh `apk:thanhhoa|myan|tanan|all`
- [x] `npx tsc --noEmit` — pass
- [x] Gradle config — `BUILD SUCCESSFUL`, có `assembleThanhhoaRelease`,
      `createBundleThanhhoaReleaseJsAndAssets`; đã bỏ hook tự sinh `appVariant.ts`
- [x] Sửa lỗi build chéo flavor (nguyên nhân cả 3 APK dùng API Tân An)
- [x] Dry-run xác nhận không còn task `generateAppVariant*`; chỉ còn bundle của flavor đang build
- [x] Cập nhật `HUONG_DAN_BUILD_APK.md` + `apps/mobile/README.md`
- [ ] Build lại 6 APK sau khi sửa hook (chạy `npm run apk:all`)
      — APK cũ trong `dist/` (build 14:57–15:02) đều trỏ Tân An, **không dùng**
- [ ] Kiểm tra `aapt dump badging`: package / label / versionCode 17 / versionName 1.16
- [ ] Kiểm tra `lib/arm64-v8a` và `lib/armeabi-v7a` trong từng APK
- [ ] Kiểm tra bundle mỗi APK chứa đúng API URL của xã đó
- [ ] Cài 2 xã cạnh nhau; cài đè bản cũ cùng xã
- [ ] Đăng nhập + mở bản đồ đúng tâm từng xã

Ghi chú test: `jest` pass 4/5 suite; `App.test.tsx` fail do thiếu native module
`RNGestureHandlerModule` trong môi trường jest (lỗi có sẵn, không liên quan thay đổi này).

## 2. Cấu hình từng xã

Sửa `apps/mobile/variants.json`:

| Flavor | Tên hiển thị | applicationId | API | Tâm bản đồ `[lng, lat]` |
|---|---|---|---|---|
| `thanhhoa` | AMS-ThanhHoa | `com.tayninh.gis.thanhhoa` | `https://ams.librasoft.vn` | `[106.18222, 10.65528]` |
| `myan` | AMS-MyAn | `com.tayninh.gis.myan` | `https://myan.amstn.vn` | `[106.341, 10.5762]` |
| `tanan` | AMS-TanAn | `com.tayninh.gis.tanan` | `https://tanan.amstn.vn` | `[106.442222, 10.529167]` |

Không sửa tay `src/lib/api.ts`, `applicationId`, `app_name`, hay tâm bản đồ trong code.

- Build release: `npm run apk:<flavor>` — sinh `appVariant.ts` từ `variants.json` ngay trước khi Gradle chạy.
- Debug localhost: `npm run dev:<flavor>` — dùng `http://localhost:4002`, không sửa `variants.json`.

## 3. Build

Yêu cầu: Node >= 22, JDK 17, Android SDK (xem `apps/mobile/README.md`).

```powershell
cd apps/mobile

# Cả 3 xã, mỗi xã 2 APK (64-bit + 32-bit) — chạy tuần tự
npm run apk:all

# Hoặc từng xã
npm run apk:thanhhoa
npm run apk:myan
npm run apk:tanan
```

Lần đầu build thêm `armeabi-v7a` sẽ lâu hơn (phải build native libs cho 32-bit).
Không chạy 3 flavor song song vì chúng dùng chung file sinh `appVariant.ts`.

### 3.1. Debug với API localhost

```powershell
cd apps/mobile
npm run dev:thanhhoa          # sinh appVariant.ts -> http://localhost:4002

# Terminal khác
npx react-native start --reset-cache
npx react-native run-android --mode=thanhhoaDebug --appId com.tayninh.gis.thanhhoa
```

- API local phải chạy cổng **4002** (sửa port trong script `dev:*` nếu khác).
- Điện thoại thật: `adb reverse tcp:4002 tcp:4002`.
- Debug dùng chung Metro: đổi xã/URL phải chạy lại `dev:*` + restart Metro `--reset-cache`.
- Test xong: `npm run variant:thanhhoa` để trả URL production từ `variants.json`.

## 4. Kết quả

```
apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-arm64-v8a.apk
apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-armeabi-v7a.apk
apps/mobile/dist/myan/AMS-MyAn-v1.16-arm64-v8a.apk
apps/mobile/dist/myan/AMS-MyAn-v1.16-armeabi-v7a.apk
apps/mobile/dist/tanan/AMS-TanAn-v1.16-arm64-v8a.apk
apps/mobile/dist/tanan/AMS-TanAn-v1.16-armeabi-v7a.apk
```

## 5. Cài lên điện thoại

```powershell
# Kiểm tra điện thoại dùng kiến trúc nào
adb shell getprop ro.product.cpu.abi

# Cài đúng file ABI tương ứng (ví dụ Thạnh Hóa, máy 64-bit)
adb install -r apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-arm64-v8a.apk

# Mở app (đổi package theo xã)
adb shell monkey -p com.tayninh.gis.thanhhoa -c android.intent.category.LAUNCHER 1
```

Máy 32-bit cài file `...-armeabi-v7a.apk`. Ba xã có package khác nhau nên cài song song được.

## 6. Kiểm tra APK

```powershell
$bt = "$env:ANDROID_HOME\build-tools\36.0.0"
& "$bt\aapt.exe" dump badging apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-arm64-v8a.apk |
  Select-String "package:|application-label|sdkVersion|targetSdkVersion"

# Kiểm tra đúng kiến trúc
tar -tf apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-arm64-v8a.apk | Select-String "lib/"

# Kiểm tra bundle nhúng đúng API URL (chạy cho cả 3 xã)
tar -xOf apps/mobile/dist/thanhhoa/AMS-ThanhHoa-v1.16-arm64-v8a.apk assets/index.android.bundle |
  Select-String "amstn|ams\.librasoft|localhost"
```

Kỳ vọng: package `com.tayninh.gis.thanhhoa`, label `AMS-ThanhHoa`, versionCode `17`,
versionName `1.16`, chỉ có `lib/arm64-v8a/` trong file arm64, và bundle chỉ chứa
`https://ams.librasoft.vn` (không chứa URL xã khác).

## 7. Thêm xã mới

1. Thêm một key vào `apps/mobile/variants.json` (appName, applicationId, apiUrl, mapCenter).
2. Build:
   ```powershell
   cd apps/mobile
   node scripts/build-apk.mjs <key>
   ```
3. (Tuỳ chọn) Thêm script `apk:<key>` trong `apps/mobile/package.json`.

Gradle tự tạo flavor từ file JSON, không cần sửa `build.gradle`.

## 8. Tăng version

Sửa trong `apps/mobile/android/app/build.gradle` (`defaultConfig`):

```groovy
versionCode 18
versionName "1.17"
```

Tăng `versionCode` mỗi lần phát hành. Dùng chung cho cả 3 xã; mỗi package chỉ cần
`versionCode` lớn hơn bản đang cài trên máy.

## 9. Troubleshooting

| Lỗi | Cách xử lý |
|---|---|
| `INSTALL_FAILED_VERSION_DOWNGRADE` | Tăng `versionCode` trong `build.gradle`, build lại |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Khác keystore (bản cũ ký keystore khác) → gỡ app rồi cài lại |
| App gọi sai API | Kiểm tra `apps/mobile/src/lib/appVariant.ts`; chạy `npm run variant:<flavor>` (hoặc `dev:<flavor>`) rồi restart Metro `--reset-cache` |
| Cả 3 APK dùng chung API một xã | Đã bỏ hook gây lỗi; build lại bằng `npm run apk:all` và kiểm tra bundle từng APK |
| APK 32-bit thiếu lib | Kiểm tra `reactNativeArchitectures=arm64-v8a,armeabi-v7a` trong `gradle.properties`; `./gradlew clean` rồi build lại |
| Tên app sai / lỗi trùng `app_name` | `strings.xml` phải rỗng; tên do flavor `resValue` cấp |
| Build bằng Android Studio ra sai API | Chạy `npm run variant:<flavor>` trước khi build |

## 10. Ghi chú kỹ thuật

- Chỉ script ghi `appVariant.ts`: `build-apk.mjs` (release) và `generate-variant.mjs` (debug/production).
  Gradle **không** tự sinh, để tránh nhiều flavor ghi đè nhau.
- Build release luôn qua `npm run apk:*`. Nếu build bằng Android Studio, chạy
  `npm run variant:<flavor>` trước.
- `build-apk.mjs` khôi phục `appVariant.ts` về Thạnh Hóa sau khi build xong (kể cả khi lỗi).
- File `appVariant.ts` được track để `tsc`/jest/IDE chạy được ngay sau khi clone.
- Debug localhost dùng `npm run dev:<flavor>`; nhớ restart Metro `--reset-cache`.
- Icon dùng chung cho cả 3 xã; logo trong app vẫn lấy theo `appLogoUrl` từ server từng xã.
