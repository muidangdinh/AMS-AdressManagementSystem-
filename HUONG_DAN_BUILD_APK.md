# Hướng dẫn build APK release & cài lên Android qua ADB

Ứng dụng **AMS — Khảo sát số nhà Tây Ninh** (`apps/mobile`, React Native CLI thuần, không Expo).

> **Về độ tin cậy của tài liệu này:** các bước build (Mục 3) đã được **chạy thật** trên máy dev này
> ngày 21/09/2026 và kết quả (dung lượng, chữ ký, ABI) là số đo thực tế. Các bước cài qua ADB
> (Mục 6) và ký bằng keystore riêng (Mục 4) **chưa chạy thử được** vì lúc viết chưa có điện thoại
> nào cắm vào máy và chưa có keystore thật — những chỗ đó được đánh dấu **⚠️ chưa kiểm chứng**.

---

## 1. Tóm tắt nhanh

```bash
# 1) Build APK release (chỉ kiến trúc arm64 — hợp mọi điện thoại đời ~2017 trở lại)
cd /media/libra/data2/tayninh_GIS/apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

# 2) Cắm điện thoại (đã bật Gỡ lỗi USB), kiểm tra máy đã nhận
adb devices -l

# 3) Cài đè lên bản cũ (giữ dữ liệu app)
adb install -r app/build/outputs/apk/release/app-release.apk

# 4) Mở app
adb shell monkey -p com.tayninh.gis -c android.intent.category.LAUNCHER 1
```

File sinh ra: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

> ⚠️ **Bản build ở Mục 3 KHÔNG phải bản phát hành chính thức** — nó đang ký bằng `debug.keystore`
> (xem Mục 2 điểm 1). Đủ để cài thử/nghiệm thu nội bộ; muốn phát hành thật hãy làm thêm **Mục 4**.

---

## 2. Bốn điều cần biết trước khi build

Đây là những chỗ đã đọc trong mã nguồn và **dễ gây sự cố nhất**:

### 2.1 Release đang ký bằng `debug.keystore`
`apps/mobile/android/app/build.gradle` (khối `buildTypes.release`) ghi `signingConfig signingConfigs.debug`
kèm chú thích *"In production, you need to generate your own keystore"*. Đã xác nhận bằng
`apksigner`: chứng chỉ của APK vừa build là `CN=Android Debug`. Hệ quả:
- ✅ Cài thử được, và **cài đè lên bản debug cũ được** (cùng chứng chỉ).
- ❌ Chứng chỉ debug là **công khai** (mật khẩu `android`), ai cũng ký giả được — không dùng để phát hành.
- ⚠️ Khi chuyển sang keystore thật, máy nào đang cài bản cũ **phải gỡ ra cài lại** (khác chữ ký) —
  xem cảnh báo mất dữ liệu ở Mục 7.

### 2.2 `API_URL` được "đóng cứng" vào APK lúc build
Đọc ở `apps/mobile/src/lib/api.ts` — hiện là:
```ts
export const API_URL = 'https://rv.librasoft.vn';
```
Đổi giá trị này **sau khi build** không có tác dụng; phải build lại. **Kiểm tra dòng này trước mỗi lần build.**

### 2.3 Release chặn HTTP thường (không mã hoá)
Đã xác nhận trong manifest của APK release: `usesCleartextTraffic = false`
(RN gradle plugin: debug `true`, release `false`). Nên:
- `API_URL` dạng `https://…` → chạy bình thường.
- `API_URL` dạng `http://192.168.x.x:3001` → **app không gọi được API**, không báo lỗi rõ ràng.
- Muốn thử với backend nội bộ qua HTTP hoặc `adb reverse` → dùng **bản debug**
  (`./gradlew assembleDebug`), không dùng release.

### 2.4 Google Maps key
Tab **Bản Đồ** cần key Google Maps trên Android. Key được đọc từ `apps/mobile/android/local.properties`
(dòng `MAPS_API_KEY=…`, file này **không commit**). Trên máy này key **đã có giá trị**. Máy build
khác phải tự thêm dòng này, nếu thiếu app vẫn chạy nhưng bản đồ hiện lưới ô xám.

---

## 3. Build APK release

### 3.1 Điều kiện cần (đã kiểm tra trên máy này ✅)

| Thành phần | Yêu cầu của dự án | Trên máy này |
|---|---|---|
| JDK | 17 trở lên | OpenJDK 17.0.20 ✅ |
| Node.js | ≥ 22.11 (`package.json` → `engines`) | v24.16.0 ✅ |
| Android SDK | platform 36, build-tools 36.0.0 | `ANDROID_HOME=/home/libra/Android/Sdk`; có platform 34/35/36, build-tools 34/35/36 ✅ |
| NDK | 27.1.12297006 | 27.1.12297006 ✅ |
| CMake | 3.22.1 | 3.22.1 ✅ |
| Gradle | 9.3.1 (wrapper tự tải) | đã có trong `~/.gradle` ✅ |
| `node_modules` | đã `npm install` | `apps/mobile/node_modules` có sẵn ✅ |

Máy khác cần cài đủ các mục trên. `local.properties` **không cần** dòng `sdk.dir` nếu đã đặt biến
môi trường `ANDROID_HOME` (máy này đang làm vậy).

> Nếu `apps/mobile/node_modules` chưa có: `cd apps/mobile && npm install`
> (`apps/mobile` **không** nằm trong workspaces gốc, phải cài riêng — xem `apps/mobile/README.md`).

### 3.2 Lệnh build

```bash
cd /media/libra/data2/tayninh_GIS/apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Gradle tự đóng gói JS bằng Metro/Hermes — **không cần** chạy `npm start` hay bật Metro.

**Kết quả đo thực tế (21/09/2026):**

| | |
|---|---|
| Kết quả | `BUILD SUCCESSFUL in 53s` *(build tăng dần, cache đã ấm — lần đầu hoặc sau `clean` sẽ lâu hơn nhiều, chưa đo)* |
| File | `app/build/outputs/apk/release/app-release.apk` |
| Dung lượng | **28 MB** |
| Package / phiên bản | `com.tayninh.gis` · versionCode `1` · versionName `1.0` |
| Android hỗ trợ | minSdk 24 (Android 7.0) → targetSdk 36 |
| Kiến trúc | `arm64-v8a` |
| Chữ ký | `CN=Android Debug` (⚠️ xem Mục 2.1) |
| Cleartext HTTP | tắt |
| JS bundle | có sẵn trong APK (`assets/index.android.bundle`, ~1,8 MB) |

### 3.3 Chọn kiến trúc (ABI) — tránh APK quá nặng hoặc không cài được

Mặc định `gradle.properties` build **cả 4 ABI** (`armeabi-v7a, arm64-v8a, x86, x86_64`) — bản debug
4 ABI của dự án nặng **165 MB**. Nên chỉ build đúng loại máy cần:

| Thiết bị | Tham số |
|---|---|
| Điện thoại thật đời mới (khuyến nghị) | `-PreactNativeArchitectures=arm64-v8a` |
| Điện thoại đời cũ 32-bit | `-PreactNativeArchitectures=armeabi-v7a` |
| Cần cài cho cả hai loại điện thoại | `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` |
| Máy ảo Android (emulator trên PC) | `-PreactNativeArchitectures=x86_64` |

Kiểm tra ABI của điện thoại trước: `adb shell getprop ro.product.cpu.abi`
Nếu build sai ABI, khi cài sẽ báo `INSTALL_FAILED_NO_MATCHING_ABIS`.

### 3.4 Trước lần phát hành mới: tăng phiên bản
Sửa trong `apps/mobile/android/app/build.gradle`, khối `defaultConfig`:
```groovy
versionCode 1        // ← tăng 1 mỗi lần phát hành (số nguyên, bắt buộc tăng)
versionName "1.0"    // ← số hiển thị cho người dùng
```

### 3.5 Build sạch khi gặp lỗi lạ
```bash
cd apps/mobile/android
./gradlew clean
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

---

## 4. Ký bằng keystore riêng (dùng khi phát hành thật) — ⚠️ chưa kiểm chứng

> Đã kiểm chứng riêng lệnh `keytool` ở bước 4.1 (chạy được, sinh keystore hợp lệ). Đoạn cấu hình
> Gradle ở 4.2 là mẫu chuẩn theo tài liệu React Native nhưng **chưa chạy thử** trên dự án này.

### 4.1 Tạo keystore (làm **một lần duy nhất** cho cả vòng đời ứng dụng)
```bash
keytool -genkeypair -v \
  -keystore ~/tayninh-release.keystore \
  -alias tayninh-release \
  -keyalg RSA -keysize 2048 -validity 10000
```
Lệnh sẽ hỏi mật khẩu và thông tin tổ chức. **Ghi nhớ mật khẩu và sao lưu file `.keystore` ở ≥ 2 nơi
an toàn ngoài repo.**

> 🔴 **Mất keystore hoặc mật khẩu = không thể cập nhật app cho những máy đã cài** (chữ ký khác thì
> Android từ chối cài đè, buộc gỡ ra cài lại và mất dữ liệu nháp chưa đồng bộ). Không có cách khôi phục.

Để keystore **ngoài thư mục dự án** (ví dụ `~/tayninh-release.keystore`). Repo có `*.keystore` trong
`.gitignore` nhưng đừng dựa vào đó.

### 4.2 Khai báo mật khẩu ở nơi ngoài repo
Thêm vào `~/.gradle/gradle.properties` (file của **người dùng**, không nằm trong dự án):
```properties
TAYNINH_RELEASE_STORE_FILE=/home/libra/tayninh-release.keystore
TAYNINH_RELEASE_KEY_ALIAS=tayninh-release
TAYNINH_RELEASE_STORE_PASSWORD=<mật khẩu keystore>
TAYNINH_RELEASE_KEY_PASSWORD=<mật khẩu key>
```

Sửa `apps/mobile/android/app/build.gradle` — thêm `release` vào `signingConfigs` và trỏ `buildTypes.release` tới nó:
```groovy
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (project.hasProperty('TAYNINH_RELEASE_STORE_FILE')) {
            storeFile file(TAYNINH_RELEASE_STORE_FILE)
            storePassword TAYNINH_RELEASE_STORE_PASSWORD
            keyAlias TAYNINH_RELEASE_KEY_ALIAS
            keyPassword TAYNINH_RELEASE_KEY_PASSWORD
        }
    }
}
buildTypes {
    debug { signingConfig signingConfigs.debug }
    release {
        // Thiếu cấu hình keystore thì tự lùi về debug để build vẫn chạy được ở máy khác
        signingConfig project.hasProperty('TAYNINH_RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug
        minifyEnabled enableProguardInReleaseBuilds
        proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
}
```

### 4.3 Build lại và kiểm tra chữ ký
```bash
cd apps/mobile/android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

/home/libra/Android/Sdk/build-tools/36.0.0/apksigner verify --print-certs \
  app/build/outputs/apk/release/app-release.apk
```
Dòng `Signer #1 certificate DN` phải là tên tổ chức bạn nhập ở 4.1, **không còn** `CN=Android Debug`.

---

## 5. Chuẩn bị điện thoại Android

1. Vào **Cài đặt → Thông tin điện thoại** → bấm liên tiếp **7 lần** vào *Số hiệu bản dựng* (Build number)
   để mở **Tùy chọn nhà phát triển**.
2. Vào **Tùy chọn nhà phát triển** → bật **Gỡ lỗi USB** (USB debugging).
3. Cắm cáp USB (dùng cáp **có truyền dữ liệu**, không phải cáp chỉ sạc), chọn chế độ USB là
   **Truyền tệp / File transfer** nếu máy hỏi.
4. Khi hiện hộp thoại **"Cho phép gỡ lỗi USB?"** → tick *Luôn cho phép từ máy tính này* → **Cho phép**.

**Riêng máy Xiaomi/Redmi/POCO (MIUI/HyperOS):** bật thêm **Cài đặt qua USB** (*Install via USB*) và
**Gỡ lỗi USB (Cài đặt bảo mật)** trong Tùy chọn nhà phát triển, nếu không sẽ gặp
`INSTALL_FAILED_USER_RESTRICTED`. Máy Oppo/Realme/Vivo có thể có mục tương tự.

---

## 6. Cài APK lên máy qua ADB — ⚠️ chưa kiểm chứng trên thiết bị thật

`adb` trên máy này ở `/usr/bin/adb` (bản 1.0.41).

### 6.1 Xác nhận máy đã kết nối
```bash
adb devices -l
```
Kết quả đúng:
```
List of devices attached
R58M12ABCDE            device usb:1-2 product:… model:SM_A525F device:… transport_id:1
```

| Cột trạng thái | Nghĩa | Xử lý |
|---|---|---|
| `device` | ✅ sẵn sàng | Tiếp tục |
| `unauthorized` | Chưa bấm *Cho phép* trên điện thoại | Rút cáp, cắm lại, bấm **Cho phép** ở hộp thoại; hoặc *Thu hồi ủy quyền gỡ lỗi USB* rồi cắm lại |
| `offline` | Kết nối treo | `adb kill-server && adb start-server`, rút/cắm lại cáp |
| *(danh sách trống)* | Máy không nhận | Xem Mục 8 |

### 6.2 (Khuyến nghị) Kiểm tra máy có tương thích không
```bash
adb shell getprop ro.product.cpu.abi          # phải khớp ABI đã build (vd arm64-v8a)
adb shell getprop ro.build.version.sdk        # phải ≥ 24 (Android 7.0)
adb shell getprop ro.build.version.release    # phiên bản Android hiển thị
```

### 6.3 Cài APK
```bash
cd /media/libra/data2/tayninh_GIS/apps/mobile/android
adb install -r app/build/outputs/apk/release/app-release.apk
```
Thành công in `Performing Streamed Install` rồi `Success`.

| Cờ | Tác dụng |
|---|---|
| `-r` | Cài đè bản đã có, **giữ nguyên dữ liệu app** (bao gồm hồ sơ nháp chưa đồng bộ) |
| `-d` | Cho phép hạ phiên bản (chỉ hiệu quả trên một số máy/bản build) |
| `-g` | Tự cấp sẵn mọi quyền runtime (GPS, máy ảnh…) — tiện khi thử nhiều lần |

### 6.4 Có nhiều thiết bị cùng cắm
```bash
adb devices                        # lấy số serial ở cột đầu
adb -s R58M12ABCDE install -r app/build/outputs/apk/release/app-release.apk
```
Không có `-s` khi có ≥ 2 máy sẽ báo `error: more than one device/emulator`.

### 6.5 Mở app và xem log
```bash
# Mở app
adb shell monkey -p com.tayninh.gis -c android.intent.category.LAUNCHER 1

# Xem log của riêng app (Ctrl+C để thoát)
adb logcat --pid=$(adb shell pidof com.tayninh.gis)

# Chỉ xem lỗi
adb logcat --pid=$(adb shell pidof com.tayninh.gis) *:E
```
Nếu `pidof` trả rỗng nghĩa là app chưa chạy hoặc vừa sập — mở app rồi chạy lại lệnh.

### 6.6 Gỡ cài đặt (chỉ khi cần)
```bash
adb uninstall com.tayninh.gis
```
⚠️ **Gỡ app xoá toàn bộ dữ liệu cục bộ**, gồm các hồ sơ khảo sát đang ở trạng thái *Chờ đồng bộ* /
*Lỗi đồng bộ* — xem Mục 7.

### 6.7 Kết nối không dây (Android 11+, không cần cáp) — tuỳ chọn
Trên điện thoại: *Tùy chọn nhà phát triển → Gỡ lỗi không dây → Ghép nối thiết bị bằng mã*. Rồi:
```bash
adb pair <IP>:<cổng-ghép-nối>      # nhập mã 6 số hiện trên điện thoại
adb connect <IP>:<cổng-kết-nối>    # cổng ở màn hình chính Gỡ lỗi không dây (khác cổng ghép nối)
adb devices
```
Máy tính và điện thoại phải cùng mạng Wi-Fi.

---

## 7. ⚠️ Mất dữ liệu nháp khi gỡ / cài lại — đọc trước khi triển khai cho cán bộ

App lưu hồ sơ khảo sát ngoại tuyến trong bộ nhớ cục bộ của máy (AsyncStorage), tự đồng bộ khi có mạng.
Hồ sơ **chưa đồng bộ chỉ tồn tại trên điện thoại đó**. Vì vậy:

- Luôn dùng **`adb install -r`** (cài đè) để cập nhật — **không** gỡ trước.
- Trước khi buộc phải gỡ (ví dụ đổi từ keystore debug sang keystore thật): mở app → tab **Tổng Quan**
  → kiểm tra mục *Đồng bộ dữ liệu* hiện **"Đã đồng bộ hết"**; nếu còn *"N hồ sơ chờ đồng bộ"* thì bấm
  **Đồng bộ ngay** khi có mạng, chờ xong mới gỡ.
- Sau khi đã có keystore thật và phát hành, **giữ nguyên keystore đó mãi mãi** để mọi lần sau đều
  cài đè được.

---

## 8. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `adb devices` **không liệt kê máy nào** | Cáp chỉ sạc / chưa bật Gỡ lỗi USB / thiếu quyền trên Linux | Đổi cáp; bật lại Gỡ lỗi USB; kiểm tra `lsusb` có thấy máy không |
| `no permissions (missing udev rules?)` *(Linux)* | Thiếu quy tắc udev cho hãng điện thoại | Cài `android-sdk-platform-tools-common` (Ubuntu: `sudo apt install android-sdk-platform-tools-common`) rồi `sudo adb kill-server`, rút/cắm cáp |
| `unauthorized` | Chưa cho phép trên điện thoại | Xem bảng ở 6.1 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Bản đang cài **ký bằng chứng chỉ khác** | Phải `adb uninstall com.tayninh.gis` rồi cài lại — **mất dữ liệu nháp**, xem Mục 7 |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | APK không có kiến trúc CPU khớp máy | Build lại đúng ABI theo Mục 3.3 |
| `INSTALL_FAILED_OLDER_SDK` | Máy dưới Android 7.0 | Không hỗ trợ (minSdk 24) |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | `versionCode` thấp hơn bản đang cài | Tăng `versionCode` (Mục 3.4) hoặc thêm `-d` |
| `INSTALL_FAILED_USER_RESTRICTED` | Máy chặn cài qua USB (Xiaomi/Oppo…) | Bật *Cài đặt qua USB* (Mục 5) |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` | Hết bộ nhớ | Giải phóng bộ nhớ máy |
| Cài được nhưng **đăng nhập báo lỗi mạng** | `API_URL` sai, hoặc dùng `http://` với bản release | Xem Mục 2.2, 2.3; dùng `https://` hoặc build debug |
| Cài được nhưng tab **Bản Đồ hiện ô xám** | Thiếu / sai `MAPS_API_KEY` | Xem Mục 2.4; kiểm tra key đã bật *Maps SDK for Android* |
| Play Protect hỏi *"Ứng dụng không xác định"* | APK ký bằng keystore lạ, chưa lên Play Store | Bình thường với bản cài thủ công — chọn **Vẫn cài** |
| Build lỗi `SDK location not found` | Không có `ANDROID_HOME` lẫn `sdk.dir` | `export ANDROID_HOME=$HOME/Android/Sdk` hoặc thêm `sdk.dir=…` vào `android/local.properties` |
| Build lỗi CMake `add_subdirectory … jni/ which is not an existing directory` | Đổi `newArchEnabled` trong `gradle.properties` | Phải để `newArchEnabled=true` — có chú thích giải thích ngay trong file |
| Build hết RAM / bị kill | Gradle daemon thiếu bộ nhớ | `org.gradle.jvmargs=-Xmx2048m` đã đặt sẵn; máy yếu có thể phải tăng hoặc build 1 ABI |

---

## 9. Kiểm tra nhanh sau khi cài (smoke test)

Làm theo thứ tự trên máy thật:

1. Mở app → thấy màn đăng nhập **"AMS — Tỉnh Tây Ninh"** *(cần có mạng lần đầu để tải tên; mất mạng sẽ hiện giá trị dự phòng)*.
2. Đăng nhập → vào **Tổng Quan**, thấy lời chào có chức vụ/đơn vị (nếu tài khoản đã có).
3. Tab **Khảo Sát** → bấm lấy GPS → hệ thống hỏi quyền vị trí → **Cho phép**.
4. Bấm chụp ảnh → hệ thống hỏi quyền máy ảnh → **Cho phép**.
5. Tab **Bản Đồ** → hiện nền bản đồ thật (không phải ô xám).
6. Tắt Wi-Fi/dữ liệu di động → tạo 1 hồ sơ → **Lưu tạm** → bật mạng lại → hồ sơ tự đồng bộ.

---

## 10. Bảng tra cứu nhanh

| Việc | Lệnh |
|---|---|
| Build release (arm64) | `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` |
| Build debug (cho thử HTTP / `adb reverse`) | `./gradlew assembleDebug` |
| Dọn build | `./gradlew clean` |
| Đường dẫn APK release | `android/app/build/outputs/apk/release/app-release.apk` |
| Xem thông tin APK | `$ANDROID_HOME/build-tools/36.0.0/aapt dump badging <apk>` |
| Xem chữ ký APK | `$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs <apk>` |
| Liệt kê thiết bị | `adb devices -l` |
| Cài đè | `adb install -r <apk>` |
| Mở app | `adb shell monkey -p com.tayninh.gis -c android.intent.category.LAUNCHER 1` |
| Xem log app | `adb logcat --pid=$(adb shell pidof com.tayninh.gis)` |
| Gỡ app | `adb uninstall com.tayninh.gis` |
| Copy APK ra máy khác | `cp android/app/build/outputs/apk/release/app-release.apk ~/AMS-1.0.apk` |

> Tài liệu liên quan: `apps/mobile/README.md` (cài đặt môi trường lần đầu, cấu hình Maps key) ·
> `BACKLOG.md` (các thay đổi mobile đợt góp ý 11/09/2026).
