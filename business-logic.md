# TÀI LIỆU NGHIỆP VỤ
## Hệ thống GIS Đánh số & Gắn biển số nhà — tỉnh Tây Ninh

| | |
|---|---|
| **Mã tài liệu** | BL-TNGIS-001 |
| **Phiên bản** | 1.1 |
| **Ngày lập** | 18/09/2026 |
| **Người lập** | Business Analyst |
| **Trạng thái** | Baseline — mô tả hệ thống **đang có trong mã nguồn** (Phase 0–10) |
| **Nguồn đối chiếu** | Mã nguồn `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`; `nghiệp vụ/GIS_SONHA_FEATURE_LIST.docx`; `KE_HOACH_NANG_CAP.md` |

> **Nguyên tắc biên soạn:** tài liệu này mô tả **nghiệp vụ như hệ thống đang thực thi**, không phải
> nghiệp vụ mong muốn. Mọi quy tắc đều truy vết được tới mã nguồn. Phần chênh lệch giữa hệ thống
> hiện tại và danh sách nghiệp vụ mục tiêu được tách riêng ở **Mục 11 — Phân tích khoảng trống**.

---

## MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Bối cảnh và mục tiêu nghiệp vụ](#2-bối-cảnh-và-mục-tiêu-nghiệp-vụ)
3. [Tác nhân và ma trận phân quyền](#3-tác-nhân-và-ma-trận-phân-quyền)
4. [Mô hình đối tượng nghiệp vụ](#4-mô-hình-đối-tượng-nghiệp-vụ)
5. [Bản đồ quy trình tổng thể](#5-bản-đồ-quy-trình-tổng-thể)
6. [Chi tiết các quy trình nghiệp vụ](#6-chi-tiết-các-quy-trình-nghiệp-vụ)
7. [Quy tắc nghiệp vụ](#7-quy-tắc-nghiệp-vụ-business-rules)
8. [Từ điển dữ liệu và danh mục giá trị](#8-từ-điển-dữ-liệu-và-danh-mục-giá-trị)
9. [Ma trận chuyển trạng thái](#9-ma-trận-chuyển-trạng-thái)
10. [Yêu cầu phi chức năng](#10-yêu-cầu-phi-chức-năng)
11. [Phân tích khoảng trống](#11-phân-tích-khoảng-trống-gap-analysis)
12. [Phụ lục](#12-phụ-lục)

---

## 1. GIỚI THIỆU

### 1.1 Mục đích tài liệu

Cung cấp mô tả đầy đủ, nhất quán về **logic nghiệp vụ** của hệ thống cho: cán bộ nghiệp vụ nghiệm
thu, đội phát triển bảo trì/mở rộng, đội kiểm thử xây dựng test case, và đơn vị tiếp nhận vận hành.

### 1.2 Phạm vi

**Trong phạm vi:** quản lý cơ sở dữ liệu số nhà; danh mục địa chỉ hành chính; tổ chức và thực hiện
khảo sát thực địa; lập – thẩm định – phê duyệt phương án đánh số; cấp, gắn, thu hồi biển số nhà;
theo dõi hồ sơ hành chính của công dân; tra cứu công khai qua mã QR; báo cáo – thống kê; quản trị
người dùng và nhật ký hệ thống.

**Ngoài phạm vi (hiện tại):** tích hợp liên thông LGSP/NGSP/CSDL đất đai – dân cư; quản lý kho và
sản xuất biển số vật lý; nhập liệu hàng loạt từ Excel/SHP/GeoJSON; thanh toán phí, lệ phí.

### 1.3 Đối tượng sử dụng hệ thống

Hai phân hệ dùng **chung một cơ sở dữ liệu và một cơ chế xác thực**:

- **Phân hệ Web quản trị** — cán bộ tại trụ sở: quản lý danh mục, lập phương án, phê duyệt, cấp
  biển, theo dõi hồ sơ, báo cáo.
- **Phân hệ Mobile khảo sát** — cán bộ đi hiện trường: nhận nhiệm vụ, khảo sát, chụp ảnh, xác nhận
  gắn biển; **làm việc được khi mất kết nối**.

### 1.4 Thuật ngữ và từ viết tắt

| Thuật ngữ | Định nghĩa nghiệp vụ |
|---|---|
| **Hồ sơ số nhà** (*House*) | Bản ghi gốc về một căn nhà/công trình: địa chỉ, chủ sở hữu, toạ độ GPS, hiện trạng, ảnh. Là đối tượng trung tâm của toàn hệ thống. |
| **Danh mục địa chỉ** | Bộ dữ liệu chuẩn hoá 5 cấp: Quận/Huyện → Xã/Phường → Thôn/Ấp và Xã/Phường → Đường/Phố → Hẻm/Ngõ. |
| **Phương án đánh số** (*NumberingScheme*) | Đề án đánh số cho **một tuyến đường**, gồm danh sách nhà kèm số đề xuất; phải được phê duyệt trước khi số có hiệu lực. |
| **Biển số nhà** (*HousePlate*) | Biển vật lý đã cấp cho một căn nhà, có vòng đời riêng (cấp → gắn → thu hồi), tách khỏi mã QR định danh của hồ sơ. |
| **Đợt khảo sát** (*SurveyCampaign*) | Chiến dịch khảo sát có thời hạn, chia thành phân vùng theo xã/phường. |
| **Nhiệm vụ khảo sát** (*SurveyAssignment*) | Việc giao một phân vùng cho một cán bộ khảo sát cụ thể. |
| **Hồ sơ hành chính** (*HouseCase*) | Yêu cầu của công dân (cấp mới / đổi số / cấp lại), có số hồ sơ `HS-<năm>-<số thứ tự>`. |
| **Giai đoạn phân loại** (*reviewStage*) | Nhãn 5 bước phục vụ thống kê, **độc lập** với trạng thái phê duyệt của hồ sơ số nhà. |
| ADMIN / CADASTRAL / SURVEYOR | Quản trị viên / Cán bộ địa chính / Cán bộ khảo sát. |
| PII | Thông tin định danh cá nhân (họ tên, số điện thoại, CCCD/CMND chủ hộ). |

---

## 2. BỐI CẢNH VÀ MỤC TIÊU NGHIỆP VỤ

### 2.1 Vấn đề nghiệp vụ

Công tác đánh số và gắn biển số nhà tại địa phương trước đây quản lý phân tán trên giấy tờ và bảng
tính, dẫn tới: số nhà trùng/nhảy cóc/thiếu trên cùng tuyến đường; không có toạ độ nên không tra cứu
được trên bản đồ; không truy được ai đã cấp số nào, khi nào; số liệu báo cáo phải tổng hợp thủ công;
cán bộ khảo sát ghi phiếu giấy rồi nhập lại, phát sinh sai lệch.

### 2.2 Mục tiêu hệ thống

| # | Mục tiêu nghiệp vụ | Cách hệ thống đáp ứng |
|---|---|---|
| MT-1 | Số hoá toàn bộ hồ sơ số nhà kèm toạ độ | Mỗi hồ sơ bắt buộc có vĩ độ/kinh độ; lưu điểm không gian PostGIS, hiển thị trên bản đồ |
| MT-2 | Chuẩn hoá địa chỉ, chống viết tự do mỗi nơi một kiểu | Danh mục địa chỉ 5 cấp dùng chung, chống trùng tên trong cùng cấp cha |
| MT-3 | Đánh số theo quy trình có thẩm định, phê duyệt | Phương án đánh số theo tuyến với vòng đời 4 trạng thái và chốt quyền phê duyệt ở ADMIN |
| MT-4 | Quản lý biển số như tài sản có lịch sử | Mỗi lần cấp/đổi/thu hồi là một bản ghi riêng, không ghi đè |
| MT-5 | Tổ chức khảo sát có kế hoạch, đo được tiến độ | Đợt → phân vùng → nhiệm vụ, tiến độ tính theo số hồ sơ đã tạo trong nhiệm vụ |
| MT-6 | Làm việc được ở nơi không có sóng | Mobile lưu nháp cục bộ, tự đồng bộ khi có mạng trở lại |
| MT-7 | Minh bạch với người dân | Quét QR trên biển tra cứu được thông tin cơ bản, không cần đăng nhập, không lộ PII |
| MT-8 | Truy vết trách nhiệm | Nhật ký thao tác toàn hệ thống + lịch sử thay đổi chi tiết từng hồ sơ |

---

## 3. TÁC NHÂN VÀ MA TRẬN PHÂN QUYỀN

### 3.1 Danh sách tác nhân

| Tác nhân | Mã vai trò | Mô tả trách nhiệm nghiệp vụ |
|---|---|---|
| **Quản trị viên** | `ADMIN` | Quản lý tài khoản; quản lý danh mục địa chỉ; **phê duyệt/từ chối phương án đánh số** (quyền độc nhất); toàn quyền trên dữ liệu nghiệp vụ |
| **Cán bộ địa chính** | `CADASTRAL` | Quản lý hồ sơ số nhà; lập phương án đánh số và trình duyệt; cấp/thu hồi biển; tổ chức đợt khảo sát, giao và nghiệm thu nhiệm vụ; xử lý hồ sơ hành chính |
| **Cán bộ khảo sát** | `SURVEYOR` | Nhận và thực hiện nhiệm vụ khảo sát; **tạo mới** hồ sơ số nhà và tải ảnh từ hiện trường; xác nhận đã gắn biển hoặc ghi lý do chưa gắn |
| **Người dân / khách** | *(không đăng nhập)* | Quét mã QR trên biển số để tra cứu thông tin cơ bản của căn nhà |

### 3.2 Ma trận phân quyền

Ký hiệu: **✔** được phép · **✘** bị từ chối (HTTP 403) · **—** không áp dụng.

| Chức năng nghiệp vụ | ADMIN | CADASTRAL | SURVEYOR | Khách |
|---|:---:|:---:|:---:|:---:|
| Đăng nhập, xem thông tin tài khoản mình | ✔ | ✔ | ✔ | ✘ |
| Quản lý tài khoản người dùng | ✔ | ✘ | ✘ | ✘ |
| Xem danh mục địa chỉ | ✔ | ✔ | ✔ | ✘ |
| Thêm/sửa/xoá danh mục địa chỉ | ✔ | ✘ | ✘ | ✘ |
| Xem danh sách & chi tiết hồ sơ số nhà | ✔ | ✔ | ✔ | ✘ |
| **Tạo mới** hồ sơ số nhà | ✔ | ✔ | **✔** | ✘ |
| **Sửa** hồ sơ số nhà | ✔ | ✔ | **✘** | ✘ |
| Sửa lại nhà **bị yêu cầu khảo sát lại** *(Phase 11 Đợt 2b, BR-85)* | ✘ *(dùng Sửa)* | ✘ *(dùng Sửa)* | **✔** *(chỉ nhà bị đánh dấu, nhiệm vụ của mình)* | ✘ |
| Tải ảnh lên hồ sơ | ✔ | ✔ | **✔** | ✘ |
| Xoá ảnh của hồ sơ | ✔ | ✔ | ✘ | ✘ |
| Xem bản đồ, tra cứu theo bán kính | ✔ | ✔ | ✔ | ✘ |
| Xuất Excel danh sách số nhà | ✔ | ✔ | ✔ | ✘ |
| Lập/sửa phương án đánh số, sinh số, trình duyệt | ✔ | ✔ | ✘ | ✘ |
| **Phê duyệt / từ chối phương án đánh số** | **✔** | **✘** | ✘ | ✘ |
| Cấp biển số (mới/đổi/lại) | ✔ | ✔ | ✘ | ✘ |
| Xác nhận đã gắn biển / ghi lý do chưa gắn | ✔ | ✔ | **✔** | ✘ |
| Thu hồi biển số | ✔ | ✔ | ✘ | ✘ |
| Tạo đợt khảo sát, phân vùng, giao nhiệm vụ | ✔ | ✔ | ✘ | ✘ |
| Bắt đầu / gửi duyệt nhiệm vụ khảo sát | ✘ | ✘ | **✔** *(chỉ nhiệm vụ của chính mình)* | ✘ |
| Nghiệm thu / yêu cầu khảo sát lại | ✔ | ✔ | ✘ | ✘ |
| Tiếp nhận & xử lý hồ sơ hành chính | ✔ | ✔ | ✘ | ✘ |
| Xem dashboard tổng quan | ✔ | ✔ | ✔ | ✘ |
| Tra cứu công khai qua QR | ✔ | ✔ | ✔ | **✔** |

**Nguyên tắc nền:** mọi chức năng không khai báo vai trò cụ thể ⇒ **chỉ cần đăng nhập hợp lệ**
(`RolesGuard`). Ba điểm truy cập công khai duy nhất được liệt kê tại BR-53.

### 3.3 Ba quy tắc phân quyền mang tính nghiệp vụ cần lưu ý

1. **SURVEYOR tạo được nhưng không sửa được hồ sơ.** Cán bộ khảo sát nhập hồ sơ tại hiện trường,
   nhưng mọi chỉnh sửa sau đó phải do cán bộ địa chính thực hiện — bảo đảm dữ liệu hiện trường
   không bị sửa hồi tố bởi chính người thu thập. *Hệ quả vận hành:* sai sót phát hiện sau khi đồng
   bộ phải báo lên cán bộ địa chính xử lý.
2. **Chỉ ADMIN phê duyệt phương án đánh số.** Người lập phương án (CADASTRAL) không tự duyệt được —
   tách bạch soạn thảo và phê duyệt.
3. **Chỉ người được giao mới vận hành nhiệm vụ của mình.** ADMIN/CADASTRAL không "bắt đầu" hay "gửi
   duyệt" hộ; ngược lại SURVEYOR không tự nghiệm thu nhiệm vụ của mình.

---

## 4. MÔ HÌNH ĐỐI TƯỢNG NGHIỆP VỤ

### 4.1 Sơ đồ quan hệ

```
                    ┌──────────────────── DANH MỤC ĐỊA CHỈ ────────────────────┐
                    │  Quận/Huyện ──< Xã/Phường ──< Thôn/Ấp                     │
                    │                     └──────< Đường/Phố ──< Hẻm/Ngõ        │
                    └────────────────────────┬─────────────────────────────────┘
                                             │ (tham chiếu, tuỳ chọn)
                                             v
   Đợt khảo sát ──< Phân vùng ──< Nhiệm vụ ──────>  ┌───────────────┐  >──── Ảnh hiện trạng
                                  (tuỳ chọn)        │  HỒ SƠ SỐ NHÀ │  >──── Lịch sử thay đổi
                                                    │    (House)    │
   Hồ sơ hành chính ──> (liên kết tuỳ chọn) ───────>└───┬───────┬───┘
        └──< Dòng thời gian xử lý                      │       │
                                                       │       └──< Biển số nhà (0..n)
                                  Phương án đánh số ──<┘
                                         (Mục phương án)
```

### 4.2 Các thực thể nghiệp vụ

| Thực thể | Vai trò nghiệp vụ | Đặc điểm cần lưu ý |
|---|---|---|
| **Hồ sơ số nhà** | Đối tượng trung tâm | Mang **hai trục trạng thái độc lập** (xem 4.3); mỗi hồ sơ có một mã QR định danh duy nhất sinh tự động |
| **Ảnh hiện trạng** | Bằng chứng khảo sát | 3 loại: mặt tiền, hiện trạng khác, ảnh biển số |
| **Lịch sử thay đổi** | Truy vết nghiệp vụ | Ghi từng trường thay đổi kèm giá trị cũ/mới và người thực hiện |
| **Danh mục địa chỉ** | Nền chuẩn hoá | Phạm vi **một tỉnh Tây Ninh**, không mô hình đa tỉnh |
| **Phương án đánh số** | Đề án theo tuyến đường | Đã duyệt được coi là **khoá vĩnh viễn**, không sửa lại |
| **Mục phương án** | Một nhà trong phương án | Có bên đường (chẵn/lẻ) và thứ tự dọc tuyến do cán bộ sắp |
| **Biển số nhà** | Tài sản vật lý có vòng đời | Một nhà có nhiều biển **theo thời gian**; tại một thời điểm chỉ một biển còn hiệu lực |
| **Đợt / Phân vùng / Nhiệm vụ** | Tổ chức khảo sát | Phân vùng gán theo **Xã/Phường có sẵn**, không vẽ ranh giới riêng |
| **Hồ sơ hành chính** | Theo dõi yêu cầu công dân | Lớp bọc ngoài **mỏng**, không lặp lại nghiệp vụ của các phân hệ con |
| **Nhật ký thao tác** | Tuân thủ, an toàn thông tin | Ghi mọi thao tác thay đổi dữ liệu trên toàn hệ thống |

### 4.3 Hai trục trạng thái của hồ sơ số nhà — điểm dễ nhầm lẫn nhất

Hồ sơ số nhà mang **đồng thời hai nhãn trạng thái phục vụ hai mục đích khác nhau**:

| | **Trạng thái phê duyệt** (`status`) | **Giai đoạn phân loại** (`reviewStage`) |
|---|---|---|
| **Giá trị** | Chờ duyệt · Đã cấp biển & QR · Cần hiệu chỉnh | Đề xuất · Đã kiểm tra · Đã duyệt · Đã ký duyệt · Từ chối |
| **Mục đích** | Điều khiển nghiệp vụ thật: màu chấm trên bản đồ, đếm "nhà chưa có số", điều kiện lọc | **Chỉ phục vụ khối thống kê "Phân loại số nhà"** trên dashboard |
| **Cách thay đổi** | Cán bộ đặt tay khi sửa hồ sơ; **hoặc hệ thống tự đặt** thành "Đã cấp biển & QR" khi xác nhận gắn biển | Chỉ cán bộ chuyển tay từ web |
| **Mặc định khi tạo** | Chờ duyệt | Đề xuất |

> **Khuyến nghị nghiệp vụ:** cần thống nhất bằng văn bản hướng dẫn nội bộ ai chuyển `reviewStage`
> và khi nào, nếu không con số trên dashboard sẽ trôi khỏi thực tế. Đây là trục **không được hệ
> thống ràng buộc**, hoàn toàn phụ thuộc kỷ luật vận hành.

---

## 5. BẢN ĐỒ QUY TRÌNH TỔNG THỂ

```
   [QT-01] Thiết lập danh mục địa chỉ          ← nền tảng, làm trước tất cả
                    │
                    v
   [QT-02] Tổ chức khảo sát  ──────────────────────────────┐
     Đợt → Phân vùng → Giao nhiệm vụ → Khảo sát hiện trường │  sinh ra
                    │                                       v
                    │                          ╔════════════════════════╗
                    │                          ║   HỒ SƠ SỐ NHÀ         ║
                    │                          ╚═══╤═══════════════╤════╝
                    v                              │               │
   [QT-03] Lập phương án đánh số ───ghi số vào─────┘               │
     Soạn → Sinh số → Kiểm tra → Trình → ADMIN duyệt               │
                    │                                              │
                    v                                              │
   [QT-04] Cấp & gắn biển số ──────tự chuyển trạng thái────────────┘
     Cấp → (hiện trường) Gắn / Chưa gắn → Thu hồi khi cần
                    │
                    v
   [QT-06] Tra cứu công khai qua QR               [QT-05] Hồ sơ hành chính
                                                    (bọc ngoài, theo dõi song song)
                    │
                    v
   [QT-07] Báo cáo – thống kê     [QT-08] Quản trị người dùng & nhật ký
```

**Thứ tự triển khai bắt buộc:** QT-01 phải hoàn tất trước QT-03, vì phương án đánh số lập **theo
tuyến đường trong danh mục**, không lập theo tên đường tự do.

---

## 6. CHI TIẾT CÁC QUY TRÌNH NGHIỆP VỤ

### QT-01 — Quản lý danh mục địa chỉ chuẩn hoá

**Mục đích:** tạo bộ dữ liệu địa chỉ dùng chung, làm nền cho việc gán địa chỉ hồ sơ và lập phương án
đánh số theo tuyến.
**Tác nhân chính:** ADMIN (duy nhất có quyền ghi).
**Tần suất:** thiết lập một lần khi khai trương, sau đó bổ sung theo phát sinh địa giới.

**Cấu trúc 5 cấp:**

```
Quận/Huyện ──< Xã/Phường ──< Thôn/Ấp / Tổ dân phố
                    └───────< Đường/Phố ──< Hẻm/Ngõ
```

**Các bước:**

| Bước | Người thực hiện | Hành động | Ràng buộc |
|---|---|---|---|
| 1 | ADMIN | Khai báo Quận/Huyện | Tên và mã không trùng trên toàn hệ thống |
| 2 | ADMIN | Khai báo Xã/Phường | Tên không trùng **trong cùng Quận/Huyện**; có thể không gán Quận/Huyện |
| 3 | ADMIN | Khai báo Thôn/Ấp | **Bắt buộc** thuộc một Xã/Phường; tên không trùng trong cùng Xã/Phường |
| 4 | ADMIN | Khai báo Đường/Phố | Tên không trùng trong cùng Xã/Phường; **được phép để trống Xã/Phường** (đường đi qua nhiều xã) |
| 5 | ADMIN | Khai báo Hẻm/Ngõ | **Bắt buộc** thuộc một Đường/Phố; tên không trùng trong cùng đường |

**Quy tắc đặc thù của Tây Ninh:** tỉnh hiện tổ chức **một cấp** (tỉnh → xã/phường trực tiếp, không
còn cấp huyện thật). Bảng Quận/Huyện được giữ lại **chỉ để tương thích địa chỉ cũ/lịch sử**, nên
việc gán Quận/Huyện cho Xã/Phường là **không bắt buộc**.

**Xử lý khi xoá:** xoá Xã/Phường ⇒ **xoá theo** toàn bộ Thôn/Ấp của xã đó; xoá Đường/Phố ⇒ **xoá
theo** toàn bộ Hẻm/Ngõ. Các hồ sơ số nhà đang trỏ tới mục bị xoá **không bị xoá** — chỉ bị gỡ liên
kết, phần địa chỉ dạng chữ vẫn còn nguyên. Đây là hành vi có chủ đích để không bao giờ mất hồ sơ nhà
vì thao tác danh mục.

> **Ghi chú chuyển tiếp quan trọng:** hồ sơ số nhà hiện lưu **song song** địa chỉ dạng chữ tự do
> (đường, phường, huyện) và liên kết tới danh mục. Liên kết danh mục **chưa bắt buộc**. Mọi bộ lọc,
> báo cáo theo địa bàn, xuất Excel và phát hiện trùng đều đang chạy trên **chữ tự do**, không chạy
> trên danh mục. Hệ quả: hai cách viết khác nhau của cùng một tên đường sẽ bị thống kê thành hai
> tuyến khác nhau. Xem GAP-02.

---

### QT-02 — Tổ chức và thực hiện khảo sát thực địa

**Mục đích:** biến khảo sát từ hoạt động tự phát thành công việc có kế hoạch, có người chịu trách
nhiệm và đo được tiến độ.

#### 6.2.1 Giai đoạn chuẩn bị (tại trụ sở — ADMIN/CADASTRAL)

| Bước | Hành động | Quy tắc |
|---|---|---|
| 1 | Tạo **đợt khảo sát**: tên, mô tả, ngày bắt đầu – kết thúc | Khởi tạo ở trạng thái *Nháp*; chuyển *Đang triển khai* / *Đã hoàn tất* bằng thao tác tay |
| 2 | Chia **phân vùng** trong đợt, mỗi phân vùng gắn với **một Xã/Phường** trong danh mục | Không vẽ ranh giới bản đồ riêng — dùng lại địa giới hành chính đã có |
| 3 | **Giao nhiệm vụ**: chọn phân vùng + cán bộ + hạn hoàn thành + ghi chú hướng dẫn | Người được giao **bắt buộc có vai trò SURVEYOR** và **đang hoạt động** — giao cho ADMIN/CADASTRAL hoặc tài khoản đã khoá đều bị từ chối |

**Ràng buộc xoá:** không xoá được đợt khi còn phân vùng; không xoá được phân vùng khi còn nhiệm vụ;
không sửa/xoá được nhiệm vụ sau khi cán bộ đã bấm bắt đầu.

#### 6.2.2 Giai đoạn hiện trường (mobile — SURVEYOR)

```
  ASSIGNED ──[cán bộ bấm "Bắt đầu"]──> IN_PROGRESS ──[bấm "Gửi duyệt"]──> SUBMITTED
                      ^                                                        │
                      │                                          ┌─────────────┴─────────────┐
                      │                                          v                           v
                      └────────────────────────────────── NEEDS_REVISIT               COMPLETED
                                  (khảo sát lại)          (kèm lý do bắt buộc)        (nghiệm thu)
```

| Bước | Hành động | Quy tắc nghiệp vụ |
|---|---|---|
| 1 | Cán bộ mở tab **Nhiệm Vụ**, chọn nhiệm vụ, bấm **Bắt đầu** | Chỉ chính người được giao mới bấm được; nhiệm vụ phải ở *Đã giao* hoặc *Cần khảo sát lại* |
| 2 | Chọn nhiệm vụ làm **nhiệm vụ đang khảo sát** (hiển thị banner ở tab Khảo Sát) | Hồ sơ tạo mới sau đó sẽ **tự gắn** vào nhiệm vụ này |
| 3 | Với mỗi căn nhà: lấy toạ độ GPS, chụp **ảnh mặt tiền** và **ảnh biển số**, nhập thông tin, lưu nháp | Xem QT-02b bên dưới |
| 4 | Bấm **Gửi duyệt** khi xong phân vùng | Chỉ từ trạng thái *Đang khảo sát* |
| 5 | Cán bộ trụ sở **Nghiệm thu** hoặc **Yêu cầu khảo sát lại** (kèm lý do) | Chỉ từ trạng thái *Chờ duyệt* |

**Đo tiến độ:** tiến độ một nhiệm vụ = **số hồ sơ số nhà đã tạo và gắn vào nhiệm vụ đó**. Hệ thống
**không** theo dõi vị trí GPS thời gian thực của cán bộ — quyết định có chủ đích.

#### 6.2.3 QT-02b — Khảo sát một căn nhà và cơ chế ngoại tuyến

Đây là quy trình **quan trọng nhất về mặt vận hành** vì diễn ra ở nơi thường mất sóng.

```
   [Hiện trường]                          [Máy cán bộ]                    [Máy chủ]
   Lấy GPS ─┐
   Chụp ảnh ─┼──> Lưu nháp cục bộ ──> Chờ đồng bộ ──(có mạng)──> Tạo hồ sơ số nhà
   Nhập form ┘     (pending_sync)      tự động thử lại            + tải từng ảnh lên
                                             │                            │
                                       (lỗi) │                            v
                                             └──> sync_error ──> thử lại ở lần có mạng sau
```

| Bước | Hành động | Quy tắc |
|---|---|---|
| 1 | Hệ thống lấy toạ độ GPS hiện tại; cán bộ có thể chỉnh tay bằng cách chọn điểm trên bản đồ | Toạ độ là **bắt buộc**, không có hồ sơ nào không có toạ độ |
| 2 | Chụp/chọn **ảnh mặt tiền** và **ảnh biển số** (hai ô riêng), tối đa 5 ảnh hiện trạng khác | Thiếu ảnh chỉ **cảnh báo mềm**, không chặn gửi |
| 3 | Nhập: số nhà, đường, xã/phường, thôn/ấp, chủ sở hữu, điện thoại, CCCD, loại công trình, số tầng, diện tích, số tờ/số thửa, hiện trạng sử dụng, nhu cầu gắn biển, phía đường, ghi chú | Trường bắt buộc: số nhà, đường, xã/phường, tên chủ sở hữu, loại công trình, toạ độ |
| 4 | Lưu nháp **trên máy** — dùng được hoàn toàn khi mất mạng | Nháp tồn tại độc lập với máy chủ |
| 5 | Khi thiết bị có mạng trở lại, hệ thống **tự động** gửi toàn bộ nháp đang chờ | Trạng thái nháp: *Chờ đồng bộ → Đang đồng bộ → Đã đồng bộ* hoặc *Lỗi đồng bộ* |
| 6 | Hồ sơ được tạo trên máy chủ với trạng thái *Chờ duyệt*, giai đoạn *Đề xuất*, ảnh tải lên lần lượt | Nếu nhiệm vụ đang chọn **không thuộc chính cán bộ đó**, liên kết nhiệm vụ bị **bỏ qua âm thầm** — việc tạo hồ sơ vẫn thành công |

> **Quyết định thiết kế cần biết:** hệ thống **không bắt buộc** phải có nhiệm vụ mới được tạo hồ sơ.
> Cán bộ vẫn khảo sát tự do được như trước; nhiệm vụ chỉ là lớp theo dõi tiến độ. Lựa chọn này giữ
> cho luồng đang chạy thật không bị gián đoạn.

> **Rủi ro vận hành đã nhận diện (RR-03):** cơ chế đồng bộ chỉ có *thử lại*, **chưa có phát hiện
> trùng hai chiều**. Nếu yêu cầu tạo hồ sơ đã tới máy chủ thành công nhưng phản hồi bị mất giữa
> đường, lần thử lại sau sẽ tạo **hồ sơ thứ hai cho cùng một căn nhà**. Cần quy trình đối soát thủ
> công định kỳ cho tới khi có cơ chế khử trùng.

---

### QT-03 — Lập, thẩm định và phê duyệt phương án đánh số

**Mục đích:** đánh số cả một tuyến đường theo nguyên tắc thống nhất, có thẩm định trước khi số có
hiệu lực — thay cho việc sửa số từng nhà rời rạc.
**Tác nhân:** CADASTRAL soạn thảo · **ADMIN phê duyệt**.

```
   ┌────────┐  trình duyệt   ┌───────────┐   ADMIN duyệt   ┌──────────┐
   │ NHÁP   │ ─────────────> │ CHỜ DUYỆT │ ──────────────> │ ĐÃ DUYỆT │ ⇒ KHOÁ VĨNH VIỄN
   └────┬───┘                └─────┬─────┘                 └──────────┘
        ^                          │ ADMIN từ chối (kèm lý do)
        │                          v
        │   sửa lại           ┌──────────┐
        └─────────────────────│ TỪ CHỐI  │
                              └──────────┘
```

**Các bước chi tiết:**

| Bước | Hành động | Quy tắc nghiệp vụ |
|---|---|---|
| 1 | **Tạo phương án** cho một tuyến đường: tên phương án, mô tả phạm vi/điểm đầu–cuối/hướng đánh số | Đường **phải có trong danh mục**; xã/phường tự chép từ đường |
| 2 | Chọn **nguyên tắc đánh số**: tách chẵn/lẻ hai bên đường (mặc định) **hoặc** đánh liên tục | Bước nhảy mặc định: 2 nếu tách chẵn/lẻ, 1 nếu liên tục; số bắt đầu mặc định 1 |
| 3 | **Thêm các nhà** vào phương án, gán **bên đường** (lẻ/chẵn/không phân biệt) và **thứ tự dọc tuyến** | Mỗi nhà chỉ xuất hiện **một lần** trong một phương án; bỏ trống thứ tự ⇒ tự xếp cuối cùng theo bên |
| 4 | Bấm **Sinh số tự động** | Xem BR-20, BR-21 — **ghi đè toàn bộ** số đề xuất cũ, kể cả số đã sửa tay |
| 5 | Sửa tay số đề xuất của từng nhà nếu cần (số lẻ đặc thù, số phụ) | Chỉ sửa được khi phương án ở *Nháp* hoặc *Bị từ chối* |
| 6 | Bấm **Kiểm tra** — hệ thống rà 4 nhóm lỗi | Xem bảng bên dưới |
| 7 | **Trình duyệt** | Bị chặn nếu: chưa có nhà nào · còn số trùng · còn nhà chưa có số |
| 8 | **ADMIN phê duyệt** | Số đề xuất được **ghi đè vào số nhà thật của tất cả các nhà**, mỗi lần ghi đều lưu lịch sử thay đổi |
| 9 | Hoặc **ADMIN từ chối** kèm lý do | Phương án quay về *Bị từ chối*; khi cán bộ sửa lại, tự động trở về *Nháp* và xoá lý do cũ |

**Bốn nhóm phát hiện của chức năng Kiểm tra:**

| Nhóm phát hiện | Ý nghĩa nghiệp vụ | Có chặn trình duyệt? |
|---|---|---|
| **Số trùng** | Hai nhà trở lên cùng một số đề xuất | **CÓ — chặn** |
| **Chưa có số** | Nhà trong phương án chưa được sinh/nhập số | **CÓ — chặn** |
| **Trùng thứ tự** | Hai nhà cùng bên đường có cùng số thứ tự | Không — chỉ cảnh báo |
| **Sai tuyến** | Nhà trong phương án lại thuộc đường khác trong danh mục | Không — chỉ cảnh báo |

> **Điểm cần quyết định nghiệp vụ:** hiện "trùng thứ tự" và "sai tuyến" **không chặn** trình duyệt.
> Về nghiệp vụ, một căn nhà thuộc đường khác lọt vào phương án của tuyến này là sai lệch đáng kể.
> Đề nghị cán bộ nghiệp vụ xác nhận: nâng hai nhóm này thành điều kiện chặn, hay giữ ở mức cảnh báo
> do còn nhiều hồ sơ cũ chưa gán danh mục đường (xem GAP-02)?

**Tính bất biến sau phê duyệt:** phương án *Đã duyệt* **không sửa, không xoá, không trình lại**.
Muốn đổi số phải lập phương án mới hoặc sửa từng hồ sơ riêng lẻ. Chỉ phương án ở trạng thái *Nháp*
mới xoá được.

---

### QT-04 — Cấp, gắn và thu hồi biển số nhà

**Mục đích:** quản lý biển số như **tài sản vật lý có lịch sử**, không phải một thuộc tính của hồ sơ.

```
                 ┌─────────────────────────────────────────────────┐
   Cấp mới ─────>│  ĐÃ CẤP  │──[xác nhận gắn tại hiện trường]──>│ ĐÃ GẮN │
                 └────┬─────┘                                   └───┬────┘
                      │  ghi "chưa gắn" + lý do                     │
                      │  (vẫn ở ĐÃ CẤP, chỉ là ghi chú)             │
                      v                                             v
                 ┌──────────────────────── ĐÃ THU HỒI ──────────────────┐
                 │  do cấp đổi / cấp lại (tự động) hoặc thu hồi thủ công │
                 └──────────────────────────────────────────────────────┘
```

**Ba lý do cấp biển:**

| Lý do | Tình huống nghiệp vụ | Hành vi hệ thống |
|---|---|---|
| **Cấp mới** | Nhà chưa từng có biển | **Bị từ chối** nếu nhà đang có biển còn hiệu lực — buộc dùng cấp đổi/cấp lại |
| **Cấp đổi** | Thay biển đang dùng bằng biển mới (đổi số, biển sai) | Biển cũ **tự động thu hồi** trong cùng thao tác, kèm ghi chú lý do |
| **Cấp lại** | Biển cũ mất hoặc hỏng | Như trên |

**Quy tắc "một biển hiệu lực":** tại mọi thời điểm, một căn nhà chỉ có **tối đa một** biển ở trạng
thái *Đã cấp* hoặc *Đã gắn*. Các biển còn lại đều đã thu hồi. Lịch sử cấp/thu hồi được giữ nguyên
vẹn, không xoá.

**Luồng hiện trường (mobile — tab Gắn Biển):**

| Bước | Hành động | Quy tắc |
|---|---|---|
| 1 | Cán bộ mở danh sách **biển chờ gắn** | Chọn từ danh sách — **chưa có chức năng quét QR bằng camera** |
| 2 | **Xác nhận đã gắn**: chụp ảnh hiện trường làm bằng chứng | Chỉ xác nhận được biển đang ở *Đã cấp*. **Tác dụng phụ quan trọng:** hồ sơ số nhà **tự chuyển sang "Đã cấp biển & QR"** và ghi một dòng lịch sử thay đổi |
| 3 | Hoặc **ghi nhận chưa gắn** kèm lý do (chủ nhà vắng, mặt tiền đang sửa…) | Biển **vẫn ở *Đã cấp***, chỉ lưu thời điểm và lý do — không phải trạng thái mới |
| 4 | **Thu hồi** khi cần | Không thu hồi lại biển đã thu hồi |

> **Đây là cầu nối nghiệp vụ duy nhất tự động đổi trạng thái hồ sơ số nhà.** Cán bộ cần hiểu rõ:
> xác nhận gắn biển trên điện thoại sẽ làm hồ sơ chuyển sang "Đã cấp biển & QR" ngay lập tức, kể cả
> khi trước đó hồ sơ đang là "Cần hiệu chỉnh".

**Hai loại mã QR trong hệ thống — không được nhầm:**

| | **Mã QR của hồ sơ** | **Mã QR của biển số** |
|---|---|---|
| Định dạng | `TN-XXXXXXXX` | `TN-P-XXXXXXXX` |
| Sinh khi | Tạo hồ sơ số nhà | Mỗi lần cấp biển |
| Số lượng | Một và chỉ một cho mỗi hồ sơ, không đổi | Mỗi lần cấp một mã mới |
| Dùng để | In tem, tra cứu công khai | In lên biển vật lý |

---

### QT-05 — Quản lý hồ sơ hành chính của công dân

**Mục đích:** theo dõi yêu cầu của người dân từ lúc tiếp nhận tới lúc trả kết quả, **bọc ngoài** các
quy trình chuyên môn đã có.
**Tác nhân:** ADMIN, CADASTRAL.

```
TIẾP NHẬN → PHÂN CÔNG → THẨM ĐỊNH → KHẢO SÁT → LẬP PHƯƠNG ÁN → ĐÃ DUYỆT → ĐÃ CẤP BIỂN → TRẢ KẾT QUẢ
     │                                                                                          
     └──────────────────────── TỪ CHỐI (kèm lý do) ──── mở lại ───> quay về TIẾP NHẬN
```

| Bước | Hành động | Quy tắc |
|---|---|---|
| 1 | **Tiếp nhận**: nhập tên người nộp, điện thoại, loại yêu cầu (cấp mới / đổi số / cấp lại), mô tả | Hệ thống sinh **số hồ sơ** dạng `HS-<năm>-<6 chữ số>` và ghi sự kiện đầu tiên |
| 2 | **Phân công** cho cán bộ xử lý | Chỉ chọn được ADMIN/CADASTRAL đang hoạt động. Nếu hồ sơ đang ở *Tiếp nhận* thì tự chuyển sang *Đã phân công*; đang ở bước khác thì giữ nguyên bước |
| 3 | **Liên kết hồ sơ số nhà** khi đã xác định được căn nhà cụ thể | Liên kết là **tuỳ chọn** — hồ sơ có thể xử lý xong mà chưa gắn nhà nào |
| 4 | **Tiến bước** theo trình tự tuyến tính | Mỗi lần chỉ tiến **đúng một bước**; không nhảy cóc, **không lùi**; không tiến được khi đã *Trả kết quả* hoặc *Bị từ chối* |
| 5 | **Ghi chú** bất kỳ lúc nào | Lưu vào dòng thời gian, không đổi trạng thái |
| 6 | **Từ chối** kèm lý do | Được phép từ mọi bước, trừ hồ sơ đã trả kết quả hoặc đã bị từ chối |
| 7 | **Mở lại** hồ sơ bị từ chối | Quay về *Tiếp nhận*, xoá lý do từ chối cũ |

**Dòng thời gian xử lý:** mọi thao tác (tiếp nhận, phân công, đổi bước, liên kết nhà, từ chối, mở
lại, ghi chú) đều sinh một mục có người thực hiện và thời điểm, không sửa, không xoá.

> **Bản chất "lớp mỏng":** tiến bước ở đây là **thao tác thủ công của cán bộ**, hệ thống **không**
> kiểm tra xem phương án đánh số đã duyệt chưa hay biển đã cấp chưa. Lý do: các phân hệ con đã tự
> kiểm soát chặt chẽ rồi, không kiểm tra hai lần. *Hệ quả:* trạng thái hồ sơ hành chính là **thông
> tin do cán bộ khai báo**, cần đối chiếu với thực tế khi báo cáo.

> **Rủi ro đã nhận diện (RR-01):** số hồ sơ sinh bằng cách **đếm số hồ sơ đã có trong năm rồi cộng
> một**. Nếu hai cán bộ tiếp nhận cùng lúc, hoặc có hồ sơ bị xoá, số có thể trùng hoặc nhảy. Ràng
> buộc duy nhất ở cơ sở dữ liệu sẽ chặn việc lưu, nhưng cán bộ sẽ thấy lỗi. Khuyến nghị chuyển sang
> bộ đếm chuyên dụng trước khi lượng hồ sơ tăng.

---

### QT-06 — Tra cứu thông tin cho người dân

**Tác nhân:** người dân, không cần tài khoản.

| Bước | Hành động | Quy tắc |
|---|---|---|
| 1 | Người dân quét mã QR trên biển số nhà | Hiện tại mã chứa **chuỗi định danh thô**, chưa phải địa chỉ web ⇒ máy quét thường chỉ hiện chữ, **không tự mở trang tra cứu** (xem GAP-05) |
| 2 | Truy cập trang tra cứu công khai của căn nhà | Trang hiển thị: số nhà, đường, xã/phường, quận/huyện, loại công trình, trạng thái, mã QR |
| 3 | — | **Tuyệt đối không hiển thị**: họ tên chủ hộ, số điện thoại, số CCCD/CMND, toạ độ chính xác, ảnh hiện trạng, lịch sử thay đổi |

**Nguyên tắc bảo vệ dữ liệu cá nhân:** mọi thông tin chủ sở hữu **chỉ truy cập được sau khi đăng
nhập**. Ảnh đã tải lên được phục vụ công khai theo đường dẫn tệp — đây là quyết định có chủ đích,
coi ảnh mặt tiền nhà tương đương ảnh đường phố công cộng. Xem RR-02.

---

### QT-07 — Báo cáo và thống kê

**Tác nhân:** mọi vai trò đã đăng nhập.

#### 6.7.1 Dashboard tổng quan (web)

| Nhóm chỉ tiêu | Nội dung | Cách tính |
|---|---|---|
| **Hồ sơ số nhà** | Tổng · Đã cấp biển · Chờ duyệt · Cần hiệu chỉnh · **Chưa có số** | *Chưa có số* = Chờ duyệt + Cần hiệu chỉnh |
| **Biển số** | Tổng · Đã cấp · Đã gắn · Đã thu hồi · **% tiến độ gắn** | % = Đã gắn ÷ Tổng biển |
| **Hồ sơ hành chính** | Tổng · **Đang xử lý** · Đã trả kết quả · Bị từ chối | *Đang xử lý* = Tổng − Trả kết quả − Từ chối |
| **Khảo sát** | Số đợt đang triển khai · nhiệm vụ theo 5 trạng thái · **% hoàn thành** | % = Đã hoàn tất ÷ Tổng nhiệm vụ |
| **Phương án đánh số** | Tổng · Nháp · Chờ duyệt · Đã duyệt · Bị từ chối · **% đã duyệt** | % = Đã duyệt ÷ Tổng phương án |
| **Theo địa bàn** | **5 xã/phường** nhiều nhà nhất | Nhóm theo tên xã/phường **dạng chữ** |
| **Theo tuyến đường** | **5 tuyến đường** nhiều nhà nhất | Nhóm theo tên đường **dạng chữ** |
| **Số nhà trùng** | Tổng số nhóm trùng + **20 nhóm trùng nhiều nhất** | Trùng = cùng *xã/phường + đường + số nhà*, từ 2 nhà trở lên |
| **Phân loại số nhà** | 5 giai đoạn kèm số lượng và tỷ lệ % | Theo `reviewStage` — xem cảnh báo tại 4.3 |

> **Báo cáo theo ấp trên mobile — mới từ 18/09/2026.** Dashboard mobile gọi cùng điểm truy
> cập kèm tham số tuỳ chọn `wardId` (xã đang xem, chọn qua bộ chọn ở đầu màn hình hoặc suy ra
> từ nhiệm vụ khảo sát đang chọn): **có** `wardId` trả về đủ **ấp** và đủ **đường** của xã đó
> (kể cả mục 0 nhà, mỗi mục 2 chỉ số *đã cấp số / chưa–chờ cấp số*); **không có** trả về đủ
> **xã/phường** toàn tỉnh theo cùng cách tính, thay cho "Theo địa bàn" top-5 ở trên. Hồ sơ chưa
> gán ấp/xã gom vào nhóm **"Chưa xác định"**. Bảng "Theo địa bàn"/"Theo tuyến đường" phía trên
> vẫn giữ nguyên hành vi cũ cho **web**.

#### 6.7.2 Báo cáo nhanh cá nhân (mobile)

Cán bộ khảo sát xem được: số nhà **do chính mình tạo** (tổng / đã có số / chưa có số / cần hiệu
chỉnh); nhiệm vụ của mình theo trạng thái; số biển đang chờ gắn; phân loại theo 5 giai đoạn.

> **Lưu ý đọc số liệu:** chỉ tiêu "biển đang chờ gắn" trên mobile là **của toàn hệ thống**, không
> phải riêng của cán bộ đó. Ngoài ra mọi con số chỉ tính trên dữ liệu **đã đồng bộ lên máy chủ** —
> nháp còn nằm trên máy không được tính.

#### 6.7.3 Xuất Excel

Xuất danh sách số nhà theo **đúng bộ lọc đang xem**, 21 cột (địa chỉ, chủ sở hữu, CCCD, loại công
trình, toạ độ, số tờ/thửa, hiện trạng, nhu cầu gắn biển, phía đường, giai đoạn duyệt, ngày tạo), nhãn
tiếng Việt. Tối đa **5.000 dòng** mỗi lần xuất — vượt ngưỡng cần lọc hẹp lại.

> **Cảnh báo tuân thủ:** tệp Excel xuất ra **có chứa số CCCD/CMND và số điện thoại chủ hộ**. Cần
> quy định nội bộ về lưu trữ và chia sẻ tệp này.

---

### QT-08 — Quản trị người dùng và nhật ký hệ thống

**Tác nhân:** ADMIN.

| Chức năng | Quy tắc nghiệp vụ |
|---|---|
| Tạo tài khoản | Tên đăng nhập **không trùng**; mật khẩu lưu dạng băm, không bao giờ trả về qua giao diện |
| Sửa tài khoản | Đổi họ tên, vai trò, đơn vị, **chức vụ** *(mới — 18/09/2026, hiển thị trong lời chào trên mobile)*, trạng thái hoạt động; đổi mật khẩu là tuỳ chọn |
| **Vô hiệu hoá** tài khoản | **Không xoá cứng** — giữ toàn vẹn liên kết nhật ký và lịch sử. Nút "xoá" trên giao diện thực chất là vô hiệu hoá |
| Hiệu lực của việc khoá | Tài khoản bị khoá **bị chặn ngay ở thao tác tiếp theo**, kể cả khi phiên đăng nhập chưa hết hạn |
| Phiên đăng nhập | Hiệu lực **8 giờ**, hết hạn phải đăng nhập lại. Không có chức năng thu hồi phiên từ xa (xem GAP-07) |
| Chống dò tài khoản | Sai tên đăng nhập và sai mật khẩu trả về **cùng một thông báo** |
| **Nhật ký thao tác** | Ghi **mọi** thao tác thay đổi dữ liệu trên toàn hệ thống: ai, khi nào, chức năng nào, địa chỉ IP, nội dung gửi lên |
| Che dữ liệu nhạy cảm trong nhật ký | Mật khẩu, mã phiên và **số CCCD/CMND** luôn bị thay bằng `***` |

### QT-09 — Thông báo và nhắc nhở giao việc *(mới — Phase 11, Đợt 1)*

**Mục đích:** người được giao việc biết ngay khi có việc mới, sắp đến hạn hoặc quá hạn; người giao biết tiến độ
mà không phải mở từng màn hình. Kênh **thông báo trong ứng dụng** (chuông trên web, chuông + màn *Thông Báo*
trên mobile, lấy bằng truy vấn định kỳ mỗi 60 giây). **Chưa có** thông báo đẩy khi ứng dụng đóng, email hay SMS.

**Áp dụng cho:** nhiệm vụ khảo sát (QT-02) và hồ sơ hành chính (QT-05).

| Sự kiện | Người nhận | Thời điểm |
|---|---|---|
| **Được giao** | Cán bộ được giao nhiệm vụ khảo sát / được phân công hồ sơ | Ngay khi giao |
| **Đổi trạng thái** | Người giao: khi cán bộ *bắt đầu* hoặc *gửi duyệt*. Cán bộ khảo sát: khi được *nghiệm thu* hoặc bị *yêu cầu khảo sát lại* (kèm lý do) | Ngay khi thao tác |
| **Sắp đến hạn** | Người nhận việc | Một lần khi còn ≤ 24 giờ (tham số `REMINDER_DUE_SOON_HOURS`) |
| **Quá hạn** | Người nhận việc: mỗi ngày một lần. Người giao: một lần duy nhất | Job quét mỗi 10 phút |
| **Nhắc thủ công** | Người nhận việc | Khi ADMIN/CADASTRAL bấm nút **Nhắc** |
| **Báo vấn đề / cần hỗ trợ** *(Đợt 2)* | Người giao việc (nếu không còn người giao thì toàn bộ ADMIN/CADASTRAL đang hoạt động) | Khi cán bộ khảo sát gửi từ mobile |

**Hạn xử lý:** là một *ngày*; hạn thực tế là **23:59 giờ Việt Nam** của ngày đó. Hồ sơ hành chính có thêm ô
*Hạn xử lý* (tuỳ chọn). Việc đã hoàn tất / bị từ chối không còn bị nhắc hạn. **Đổi hạn thì chu kỳ nhắc tính lại.**


**Nâng cấp nhiệm vụ khảo sát *(Phase 11 Đợt 2)*:**

- **Chỉ tiêu và tiến độ %:** khi giao nhiệm vụ có thể đặt *Chỉ tiêu (số nhà)*. Tiến độ = số nhà đã khảo sát
  và gắn vào nhiệm vụ ÷ chỉ tiêu (hiện thanh % trên web và mobile). Không đặt chỉ tiêu thì chỉ hiện số nhà đã khảo sát.
- **Nhật ký nhiệm vụ:** mọi thao tác (giao, bắt đầu, gửi duyệt, nghiệm thu, yêu cầu khảo sát lại, báo vấn đề, xin hỗ trợ)
  được ghi thành một dòng có người thực hiện, thời điểm và ghi chú; xem trên web (nút *Nhật ký*) và mobile (biểu tượng đồng hồ).
  Nhiệm vụ tạo trước đợt này được điền sẵn các mốc *giao / gửi duyệt / duyệt* từ dữ liệu cũ; **không có mốc *bắt đầu*** vì
  hệ thống trước đây không lưu.
- **Báo vấn đề / cần hỗ trợ:** cán bộ khảo sát bấm biểu tượng cờ trên nhiệm vụ của mình, chọn loại và nhập nội dung. Người
  giao nhận thông báo ngay; **trạng thái nhiệm vụ không đổi**.


**Khảo sát lại đúng nhà bị lỗi *(Phase 11 Đợt 2b)*:**

Trước đây, khi người duyệt bấm *Yêu cầu khảo sát lại*, cán bộ khảo sát **không có cách sửa nhà đã gửi** (chỉ tạo được nhà mới,
theo BR-14), nên điền lại sẽ sinh ra **nhà trùng** và làm tiến độ tăng sai. Nay:

1. Khi bấm *Yêu cầu khảo sát lại* trên web, người duyệt **tick từng nhà có lỗi** kèm lý do riêng (bỏ trống = dùng lý do chung).
   Không tick nhà nào = **khảo sát lại chung**: cán bộ thêm nhà còn thiếu như trước.
2. Nhà được tick bị đánh dấu "cần khảo sát lại" (không đổi trạng thái duyệt của nhà). Cán bộ nhận thông báo kèm số nhà; thẻ nhiệm vụ trên mobile
   hiện **"Khảo sát lại (N nhà)"**.
3. Cán bộ bấm *Bắt đầu khảo sát lại*, bấm thẻ **Khảo sát lại** → chọn nhà → tab *Khảo Sát* mở ở **chế độ sửa lại**: form điền sẵn thông tin nhà,
   cán bộ sửa, chụp/chọn thêm ảnh, bấm **Lưu & Gửi (sửa lại)**. Chức năng này **cần có mạng** (không lưu nháp offline).
4. Sửa xong: cờ được xoá, lịch sử nhà ghi rõ trường nào đổi, nhật ký nhiệm vụ ghi "Đã khảo sát lại nhà …". **Số nhà đã khảo sát của nhiệm vụ
   không đổi** (không tạo nhà mới). Còn nhà chưa sửa thì **chưa gửi duyệt lại được**.

---

## 7. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)

Ký hiệu cột **Mức**: 🔴 *Hệ thống cưỡng chế* (vi phạm bị chặn) · 🟡 *Hệ thống cảnh báo* (vẫn làm
được) · ⚪ *Quy ước vận hành* (hệ thống không kiểm soát, phụ thuộc kỷ luật của người dùng).

### 7.1 Hồ sơ số nhà

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-01 | Mỗi hồ sơ số nhà **bắt buộc** có: số nhà, tên đường, xã/phường, tên chủ sở hữu, loại công trình, vĩ độ, kinh độ | 🔴 |
| BR-02 | Số CCCD/CMND nếu nhập phải gồm **đúng 9 chữ số** (CMND cũ) hoặc **12 chữ số** (CCCD mới) | 🔴 |
| BR-03 | Vĩ độ/kinh độ phải là toạ độ địa lý hợp lệ | 🔴 |
| BR-04 | Số tầng và diện tích nếu nhập phải **không âm** | 🔴 |
| BR-05 | Mỗi hồ sơ được cấp **một mã QR định danh duy nhất**, sinh tự động, **không đổi trong suốt vòng đời** | 🔴 |
| BR-06 | Trạng thái mặc định khi tạo là *Chờ duyệt*; giai đoạn phân loại mặc định là *Đề xuất* | 🔴 |
| BR-07 | Hệ thống **không chặn** việc tạo hai hồ sơ cùng *xã/phường + đường + số nhà*. Trùng lặp chỉ được **phát hiện sau** qua báo cáo trên dashboard | 🟡 |
| BR-08 | Mọi thay đổi hồ sơ đều ghi lịch sử theo từng trường (giá trị cũ → giá trị mới, ai, khi nào). Thêm/xoá ảnh cũng được ghi | 🔴 |
| BR-09 | Chỉ 20 mục lịch sử gần nhất được hiển thị | ⚪ |
| BR-10 | Ảnh tải lên phải là **tệp ảnh**, dung lượng **tối đa 5 MB** mỗi tệp | 🔴 |
| BR-11 | Xoá ảnh sẽ xoá cả tệp vật lý trên máy chủ — **không khôi phục được** | 🔴 |
| BR-12 | Toạ độ không gian dùng cho bản đồ được hệ thống **tự đồng bộ** từ vĩ độ/kinh độ mỗi khi thêm hoặc sửa, không cần thao tác của người dùng | 🔴 |
| BR-13 | Tìm kiếm hồ sơ quét trên: số nhà, tên đường, tên chủ sở hữu, số điện thoại, **số CCCD/CMND**, mã QR | ⚪ |
| BR-14 | Cán bộ khảo sát tạo được hồ sơ nhưng **không sửa được** hồ sơ sau khi đã tạo | 🔴 |

### 7.2 Danh mục địa chỉ

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-15 | Tên Quận/Huyện là duy nhất toàn hệ thống; mã (nếu có) cũng duy nhất | 🔴 |
| BR-16 | Tên Xã/Phường duy nhất **trong cùng Quận/Huyện**; Thôn/Ấp duy nhất trong cùng Xã/Phường; Đường/Phố duy nhất trong cùng Xã/Phường; Hẻm/Ngõ duy nhất trong cùng Đường/Phố | 🔴 |
| BR-17 | Thôn/Ấp **bắt buộc** thuộc một Xã/Phường; Hẻm/Ngõ **bắt buộc** thuộc một Đường/Phố | 🔴 |
| BR-18 | Xã/Phường **được phép** không gán Quận/Huyện; Đường/Phố **được phép** không gán Xã/Phường | 🔴 |
| BR-19 | Xoá Xã/Phường kéo theo xoá Thôn/Ấp trực thuộc; xoá Đường/Phố kéo theo xoá Hẻm/Ngõ. Hồ sơ số nhà **không bị xoá**, chỉ mất liên kết | 🔴 |

### 7.3 Phương án đánh số

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-20 | Khi **tách chẵn/lẻ**: bên lẻ bắt đầu từ số lẻ đầu tiên ≥ số bắt đầu, bên chẵn từ số chẵn đầu tiên ≥ số bắt đầu; mỗi bên tăng dần theo bước nhảy, xếp theo thứ tự dọc tuyến | 🔴 |
| BR-21 | Khi **đánh liên tục**: đánh số tăng dần theo thứ tự dọc tuyến, không phân biệt bên đường | 🔴 |
| BR-22 | Nhà chưa gán bên đường **không được sinh số** khi phương án tách chẵn/lẻ — chức năng kiểm tra sẽ báo "chưa có số" | 🔴 |
| BR-23 | "Sinh số tự động" **ghi đè toàn bộ** số đề xuất hiện có, kể cả số cán bộ đã sửa tay | 🔴 |
| BR-24 | Một căn nhà chỉ xuất hiện **một lần** trong một phương án | 🔴 |
| BR-25 | Chỉ sửa được phương án ở trạng thái *Nháp* hoặc *Bị từ chối* | 🔴 |
| BR-26 | Chỉ **xoá** được phương án ở trạng thái *Nháp* | 🔴 |
| BR-27 | Sửa một phương án *Bị từ chối* sẽ **tự đưa về *Nháp*** và xoá lý do từ chối cũ | 🔴 |
| BR-28 | Điều kiện trình duyệt: có ít nhất một nhà **VÀ** không còn số trùng **VÀ** không còn nhà thiếu số | 🔴 |
| BR-29 | "Trùng thứ tự" và "sai tuyến" **không chặn** trình duyệt — chỉ cảnh báo | 🟡 |
| BR-30 | Chỉ **ADMIN** phê duyệt hoặc từ chối; chỉ phê duyệt được phương án đang *Chờ duyệt* | 🔴 |
| BR-31 | Khi phê duyệt: số đề xuất được ghi đè vào **số nhà thật** của từng căn nhà; mỗi lần ghi sinh một mục lịch sử. Nhà có số đề xuất trùng với số hiện tại thì bỏ qua | 🔴 |
| BR-32 | Toàn bộ việc ghi số hàng loạt diễn ra **trọn gói**: hoặc tất cả thành công, hoặc không nhà nào bị đổi | 🔴 |
| BR-33 | Phương án *Đã duyệt* là **bất biến** — không sửa, không xoá, không trình lại | 🔴 |
| BR-34 | Phê duyệt phương án **không** làm thay đổi trạng thái phê duyệt của các hồ sơ số nhà liên quan | ⚪ |

### 7.4 Biển số nhà

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-35 | Mỗi lần cấp biển sinh **mã biển mới, duy nhất**, dải mã khác với mã QR của hồ sơ | 🔴 |
| BR-36 | Tại một thời điểm, một căn nhà có **tối đa một** biển ở trạng thái *Đã cấp* hoặc *Đã gắn* | 🔴 |
| BR-37 | **Cấp mới** bị từ chối nếu nhà đang có biển hiệu lực | 🔴 |
| BR-38 | **Cấp đổi / cấp lại** tự động thu hồi biển đang hiệu lực, trong cùng một thao tác trọn gói | 🔴 |
| BR-39 | Chỉ xác nhận gắn được biển đang ở trạng thái *Đã cấp* | 🔴 |
| BR-40 | Xác nhận gắn biển **tự chuyển hồ sơ số nhà sang trạng thái *Đã cấp biển & QR*** (nếu chưa ở trạng thái đó) và ghi một mục lịch sử | 🔴 |
| BR-41 | Ghi nhận "chưa gắn" **không đổi trạng thái biển** — biển vẫn ở *Đã cấp*, chỉ lưu thời điểm và lý do | 🔴 |
| BR-42 | Không thu hồi lại biển đã thu hồi | 🔴 |
| BR-43 | Lịch sử cấp/thu hồi biển được giữ **vĩnh viễn**, không xoá | 🔴 |

### 7.5 Khảo sát

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-44 | Người được giao nhiệm vụ **bắt buộc có vai trò SURVEYOR và đang hoạt động** | 🔴 |
| BR-45 | Chỉ **chính người được giao** mới bắt đầu và gửi duyệt được nhiệm vụ của mình | 🔴 |
| BR-46 | Chỉ sửa/xoá được nhiệm vụ khi còn ở trạng thái *Đã giao* (chưa bắt đầu) | 🔴 |
| BR-47 | Chỉ nghiệm thu hoặc yêu cầu khảo sát lại với nhiệm vụ đang *Chờ duyệt*; yêu cầu khảo sát lại **bắt buộc có lý do** | 🔴 |
| BR-48 | Không xoá được đợt khảo sát còn phân vùng; không xoá được phân vùng còn nhiệm vụ | 🔴 |
| BR-49 | **Không bắt buộc** phải có nhiệm vụ mới tạo được hồ sơ số nhà — nhiệm vụ chỉ là lớp theo dõi tiến độ | 🔴 |
| BR-50 | Hồ sơ chỉ gắn được vào nhiệm vụ **của chính người tạo**; nhiệm vụ không hợp lệ bị **bỏ qua âm thầm**, việc tạo hồ sơ **vẫn thành công** | 🔴 |
| BR-51 | Tiến độ nhiệm vụ = số hồ sơ số nhà đã tạo và gắn vào nhiệm vụ đó | ⚪ |
| BR-52 | Nháp khảo sát lưu trên máy cán bộ, tự động gửi lên khi có mạng; lỗi gửi sẽ được thử lại ở lần có mạng kế tiếp | 🔴 |

### 7.6 Bảo mật, truy cập và nhật ký

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-53 | Chỉ **ba** điểm truy cập không cần đăng nhập: kiểm tra tình trạng hệ thống, **ảnh mã QR của hồ sơ**, **thông tin tra cứu công khai của hồ sơ** | 🔴 |
| BR-54 | Thông tin tra cứu công khai **không chứa** tên chủ hộ, điện thoại, CCCD, toạ độ, ảnh, lịch sử | 🔴 |
| BR-55 | Phiên đăng nhập hiệu lực **8 giờ**; hết hạn phải đăng nhập lại | 🔴 |
| BR-56 | Tài khoản bị vô hiệu hoá bị chặn **ngay ở thao tác kế tiếp**, không chờ hết phiên | 🔴 |
| BR-57 | Không xoá cứng tài khoản — chỉ vô hiệu hoá, để giữ toàn vẹn nhật ký | 🔴 |
| BR-58 | Mọi thao tác thêm/sửa/xoá trên toàn hệ thống đều được ghi nhật ký kèm người thực hiện, thời điểm, chức năng, IP | 🔴 |
| BR-59 | Nhật ký **che** mật khẩu, mã phiên và số CCCD/CMND bằng `***` | 🔴 |
| BR-60 | Ghi nhật ký thất bại **không được** làm hỏng thao tác nghiệp vụ của người dùng | 🔴 |
| BR-61 | **Ảnh đã tải lên truy cập được không cần đăng nhập** (theo đường dẫn tệp) — quyết định có chủ đích, coi ảnh mặt tiền tương đương ảnh đường phố | ⚪ |

### 7.6b Thông báo và nhắc nhở *(mới — Phase 11)*

| Mã | Quy tắc | Mức |
|---|---|---|
| BR-74 | Hạn xử lý là một ngày; hạn thực tế là 23:59 giờ Việt Nam của ngày đó (áp dụng cho nhiệm vụ khảo sát và hồ sơ hành chính) | 🔴 |
| BR-75 | Nhắc "sắp đến hạn" đúng 1 lần khi còn ≤ 24 giờ; nhắc "quá hạn" cho người nhận 1 lần/ngày, báo người giao 1 lần duy nhất; đổi hạn thì tính lại. Chạy lại job không sinh thông báo trùng | 🔴 |
| BR-76 | Nhắc thủ công chỉ ADMIN/CADASTRAL; cùng một việc chỉ nhắc tối đa 1 lần / 15 phút (lần thứ hai trong 15 phút bị từ chối); hồ sơ chưa phân công cho ai thì không nhắc được | 🔴 |
| BR-77 | Không gửi thông báo cho chính người vừa thực hiện thao tác | 🔴 |
| BR-78 | Cán bộ được giao báo vấn đề / xin hỗ trợ trên nhiệm vụ của mình (mọi trạng thái trừ *Đã hoàn tất*); nội dung 1–1000 ký tự; chỉ ghi nhật ký và báo người giao, **không đổi trạng thái nhiệm vụ** | 🔴 |
| BR-79 | Mỗi người chỉ đọc và đánh dấu đã đọc thông báo **của mình**; thông báo đã đọc được giữ 90 ngày rồi tự xoá | 🔴 |
| BR-80 | Gửi thông báo thất bại không làm hỏng thao tác nghiệp vụ đã thành công (giao việc, gửi duyệt…) | 🔴 |
| BR-81 | Thao tác "đánh dấu đã đọc" không ghi vào nhật ký hệ thống (không có giá trị truy vết, tránh rác) | ⚪ |
| BR-82 | Chỉ tiêu nhiệm vụ là số nguyên từ 1 đến 100.000, tuỳ chọn; chỉ đặt/sửa/bỏ được khi nhiệm vụ còn *Đã giao* (theo BR-46). Tiến độ % = số nhà đã tạo trong nhiệm vụ ÷ chỉ tiêu, **có thể vượt 100%** nếu khảo sát nhiều hơn chỉ tiêu | 🔴 |
| BR-83 | Mỗi chuyển trạng thái của nhiệm vụ khảo sát ghi 1 dòng nhật ký **cùng lúc** với việc đổi trạng thái (không có trường hợp đổi trạng thái mà thiếu nhật ký) | 🔴 |
| BR-84 | Nhiệm vụ còn nhà mang cờ "cần khảo sát lại" chưa sửa thì **không gửi duyệt được** (trả lỗi nêu số nhà còn lại) | 🔴 |
| BR-85 | Cán bộ khảo sát chỉ sửa được nhà khi: nhà đang có cờ khảo sát lại **và** thuộc nhiệm vụ của chính mình **và** nhiệm vụ đang *Đang khảo sát* (đã bấm *Bắt đầu khảo sát lại*); chỉ sửa được thông tin và thêm ảnh, **không** đổi được trạng thái duyệt / giai đoạn phân loại / nhiệm vụ. Đây là ngoại lệ có kiểm soát của BR-14; *sửa nhà nói chung* vẫn chỉ ADMIN/CADASTRAL | 🔴 |
| BR-86 | Yêu cầu khảo sát lại: mọi nhà được chọn phải thuộc đúng nhiệm vụ đó (sai ⇒ từ chối); không chọn nhà nào = khảo sát lại chung; việc đánh dấu nhà và đổi trạng thái nhiệm vụ diễn ra trọn gói | 🔴 |

### 7.7 Ngưỡng và giới hạn hệ thống

| Mã | Giới hạn | Giá trị | Hệ quả khi chạm ngưỡng |
|---|---|---|---|
| BR-62 | Số điểm hiển thị trên bản đồ mỗi lần | **2.000** | Dữ liệu bị cắt bớt, hệ thống báo và ghi cảnh báo — cần lọc hẹp hơn |
| BR-63 | Số dòng xuất Excel mỗi lần | **5.000** | Cắt bớt âm thầm với người dùng — **cần lọc trước khi xuất** |
| BR-64 | Số bản ghi mỗi trang danh sách | mặc định 20, **tối đa 100** | — |
| BR-65 | Bán kính tra cứu quanh một điểm | mặc định 500 m, từ **10 m đến 20 km** | — |
| BR-66 | Số kết quả tra cứu theo bán kính | mặc định 20, **tối đa 100** | — |
| BR-67 | Số nhóm số nhà trùng hiển thị trên dashboard | **20 nhóm** nhiều nhất (tổng số nhóm vẫn hiển thị đầy đủ) | — |
| BR-68 | Số ảnh hiện trạng khác mỗi lần khảo sát trên mobile | **5 ảnh** (ngoài ảnh mặt tiền và ảnh biển) | — |

---

## 8. TỪ ĐIỂN DỮ LIỆU VÀ DANH MỤC GIÁ TRỊ

### 8.1 Hồ sơ số nhà — các trường nghiệp vụ

| Trường | Bắt buộc | Kiểu/Miền giá trị | Ghi chú nghiệp vụ |
|---|:---:|---|---|
| Số nhà | ✔ | Chữ và số, ví dụ `18A` | Không kiểm tra định dạng; có thể bị phương án đánh số ghi đè |
| Đường/phố (chữ) | ✔ | Văn bản | Nguồn cho bộ lọc và báo cáo hiện tại |
| Xã/phường (chữ) | ✔ | Văn bản | Như trên |
| Quận/huyện (chữ) | — | Văn bản | Đã **bỏ khỏi form nhập liệu** trên mobile từ 18/09/2026 (Tây Ninh là tỉnh một cấp) — cột vẫn còn cho dữ liệu lịch sử |
| Ấp/Thôn | — | Tham chiếu danh mục (`hamletId`) | Chỉ có liên kết danh mục, **không có cột chữ tự do song song** như đường/xã. Thu thập trên cả web và mobile từ 18/09/2026 |
| Liên kết danh mục (5 cấp) | — | Tham chiếu danh mục | Chưa bắt buộc — xem GAP-02 |
| Tên chủ sở hữu | ✔ | Văn bản | **PII** |
| Điện thoại chủ sở hữu | — | Văn bản | **PII**, không kiểm tra định dạng |
| Số CCCD/CMND | — | **9 hoặc 12 chữ số** | **PII nhạy cảm** — bị che trong nhật ký, không lộ ra tra cứu công khai |
| Loại công trình | ✔ | 6 giá trị (8.2) | |
| Số tầng | — | Số nguyên ≥ 0 | |
| Diện tích | — | Số ≥ 0, đơn vị m² | |
| Trạng thái phê duyệt | ✔ | 3 giá trị (8.3) | Mặc định *Chờ duyệt* |
| Giai đoạn phân loại | ✔ | 5 giá trị (8.4) | Mặc định *Đề xuất*, chỉ phục vụ thống kê |
| Mã QR | ✔ | Sinh tự động `TN-xxxxxxxx` | Duy nhất, không đổi |
| Vĩ độ / Kinh độ | ✔ | Toạ độ địa lý | |
| Số tờ bản đồ / Số thửa đất | — | Văn bản | Nhập tự do, **chưa liên kết CSDL đất đai** |
| Hiện trạng sử dụng | — | 4 giá trị (8.5) | Ghi nhận **tại thời điểm khảo sát** |
| Nhu cầu gắn biển | — | 3 giá trị (8.6) | Ý định của chủ hộ **lúc khảo sát**, khác với việc cấp biển thật |
| Phía đường | ✔ | Lẻ / Chẵn / Không phân biệt | Mặc định *Không phân biệt* |
| Ghi chú khảo sát | — | Văn bản | |
| Nhiệm vụ khảo sát | — | Tham chiếu nhiệm vụ | Tuỳ chọn, chỉ để tính tiến độ |

### 8.2 Loại công trình

| Mã | Nhãn hiển thị |
|---|---|
| `SINGLE_HOUSE` | Nhà ở riêng lẻ |
| `SHOP` | Cửa hàng kinh doanh |
| `OFFICE_BUILDING` | Tòa nhà văn phòng |
| `APARTMENT` | Nhà chung cư *(đổi tên từ "Chung cư đô thị" — 18/09/2026)* |
| `COMPANY_FACTORY` | Công ty/Nhà máy *(mới — 18/09/2026)* |
| `RESIDENTIAL_AREA` | Khu dân cư *(mới — 18/09/2026)* |

### 8.3 Trạng thái phê duyệt hồ sơ số nhà

| Mã | Nhãn | Ý nghĩa nghiệp vụ |
|---|---|---|
| `PENDING` | Chờ duyệt | Mới khảo sát, chưa có số chính thức |
| `APPROVED` | Đã cấp biển & QR | Đã hoàn tất — **hệ thống tự đặt khi xác nhận gắn biển** |
| `NEEDS_ADJUST` | Cần hiệu chỉnh | Phát hiện sai sót, cần khảo sát/sửa lại |

### 8.4 Giai đoạn phân loại (chỉ dùng thống kê)

`PROPOSED` Đề xuất → `CHECKED` Đã kiểm tra → `APPROVED` Đã duyệt → `SIGNED` Đã ký duyệt ·
`REJECTED` Từ chối

### 8.5 Hiện trạng sử dụng nhà

| Mã | Nhãn |
|---|---|
| `RESIDENTIAL` | Nhà ở |
| `VACANT` | Bỏ trống |
| `UNDER_CONSTRUCTION` | Đang xây dựng |
| `BUSINESS` | Kinh doanh / cho thuê |

### 8.6 Nhu cầu gắn biển của chủ hộ

`NEEDED` Có nhu cầu · `NOT_NEEDED` Không có nhu cầu · `ALREADY_HAS` Đã có biển

### 8.7 Loại ảnh đính kèm

`FACADE` Ảnh mặt tiền · `CONDITION` Ảnh hiện trạng khác · `PLATE` Ảnh biển số nhà *(chụp lúc khảo
sát — khác với ảnh xác nhận gắn biển thuộc hồ sơ biển số)*

### 8.8 Loại yêu cầu của hồ sơ hành chính

`NEW` Cấp số nhà mới · `CHANGE` Điều chỉnh/đổi số · `REISSUE` Cấp lại

---

## 9. MA TRẬN CHUYỂN TRẠNG THÁI

### 9.1 Phương án đánh số

| Từ \ Đến | Nháp | Chờ duyệt | Đã duyệt | Bị từ chối |
|---|:---:|:---:|:---:|:---:|
| **Nháp** | — | Trình duyệt *(CADASTRAL/ADMIN, đủ điều kiện BR-28)* | ✘ | ✘ |
| **Chờ duyệt** | ✘ | — | Phê duyệt *(**chỉ ADMIN**)* | Từ chối *(**chỉ ADMIN**, kèm lý do)* |
| **Đã duyệt** | ✘ | ✘ | — | ✘ |
| **Bị từ chối** | Sửa lại *(tự động)* | Trình duyệt lại | ✘ | — |

### 9.2 Biển số nhà

| Từ \ Đến | Đã cấp | Đã gắn | Đã thu hồi |
|---|:---:|:---:|:---:|
| *(chưa có)* | Cấp mới / cấp đổi / cấp lại | ✘ | ✘ |
| **Đã cấp** | *(ghi "chưa gắn" — giữ nguyên trạng thái)* | Xác nhận gắn tại hiện trường | Thu hồi thủ công **hoặc** tự động khi cấp đổi/cấp lại |
| **Đã gắn** | ✘ | — | Thu hồi thủ công / tự động |
| **Đã thu hồi** | ✘ | ✘ | — *(trạng thái cuối)* |

### 9.3 Nhiệm vụ khảo sát

| Từ \ Đến | Đã giao | Đang khảo sát | Chờ duyệt | Đã hoàn tất | Cần khảo sát lại |
|---|:---:|:---:|:---:|:---:|:---:|
| **Đã giao** | — | Bắt đầu *(SURVEYOR được giao)* | ✘ | ✘ | ✘ |
| **Đang khảo sát** | ✘ | — | Gửi duyệt *(SURVEYOR được giao)* | ✘ | ✘ |
| **Chờ duyệt** | ✘ | ✘ | — | Nghiệm thu *(ADMIN/CADASTRAL)* | Yêu cầu khảo sát lại *(kèm lý do)* |
| **Đã hoàn tất** | ✘ | ✘ | ✘ | — *(trạng thái cuối)* | ✘ |
| **Cần khảo sát lại** | ✘ | Bắt đầu lại | ✘ | ✘ | — |

### 9.4 Hồ sơ hành chính

Tiến **một bước một** theo trình tự: Tiếp nhận → Đã phân công → Đang thẩm định → Đang khảo sát →
Đang lập phương án → Đã duyệt/cấp số → Đã cấp biển → Đã trả kết quả.

| Chuyển đổi đặc biệt | Điều kiện |
|---|---|
| *bất kỳ* → **Bị từ chối** | Trừ hồ sơ đã *Trả kết quả* hoặc đã *Bị từ chối*; **bắt buộc có lý do** |
| **Bị từ chối** → **Tiếp nhận** | Thao tác "Mở lại"; xoá lý do từ chối cũ |
| **Tiếp nhận** → **Đã phân công** | Xảy ra **tự động** khi phân công cán bộ xử lý |
| Lùi bước | **Không hỗ trợ** |

### 9.5 Trạng thái nháp khảo sát trên máy cán bộ

| Từ \ Đến | Chờ đồng bộ | Đang đồng bộ | Đã đồng bộ | Lỗi đồng bộ |
|---|:---:|:---:|:---:|:---:|
| *(mới tạo)* | ✔ | ✘ | ✘ | ✘ |
| **Chờ đồng bộ** | — | Bắt đầu gửi *(tự động khi có mạng, hoặc bấm tay)* | ✘ | ✘ |
| **Đang đồng bộ** | ✘ | — | Gửi thành công | Gửi thất bại |
| **Đã đồng bộ** | ✘ | ✘ | — *(trạng thái cuối)* | ✘ |
| **Lỗi đồng bộ** | ✘ | Thử lại | ✘ | — |

---

## 10. YÊU CẦU PHI CHỨC NĂNG

### 10.1 An toàn thông tin và dữ liệu cá nhân

| Khía cạnh | Hiện trạng |
|---|---|
| Xác thực | Tài khoản + mật khẩu, mật khẩu lưu dạng băm. Phiên 8 giờ |
| Phân quyền | Theo vai trò trên từng chức năng. **Chưa phân quyền theo địa bàn** — mọi cán bộ thấy dữ liệu toàn tỉnh (GAP-06) |
| Dữ liệu cá nhân | CCCD/CMND được che trong nhật ký và không bao giờ xuất hiện ở kênh công khai; **nhưng** xuất hiện trong tệp Excel xuất ra và trong kết quả tìm kiếm |
| Ảnh đính kèm | **Truy cập được không cần đăng nhập** theo đường dẫn tệp (BR-61) |
| Truy vết | Nhật ký toàn hệ thống + lịch sử thay đổi từng hồ sơ; tài khoản không xoá cứng |

### 10.2 Tính sẵn sàng và vận hành ngoại tuyến

Phân hệ mobile **phải dùng được hoàn toàn khi mất kết nối**: nhập liệu, chụp ảnh, lưu nháp. Đồng bộ
tự động khi có mạng trở lại. Đây là yêu cầu nghiệp vụ cốt lõi, không phải tính năng tiện ích.

### 10.3 Hiệu năng và quy mô

Thiết kế cho quy mô **một tỉnh**. Các ngưỡng bảo vệ (BR-62 đến BR-68) nhằm tránh tải toàn bộ cơ sở
dữ liệu khi người dùng không đặt bộ lọc. Truy vấn theo bán kính dùng chỉ mục không gian chuyên dụng.

### 10.4 Sao lưu

Có kịch bản sao lưu cơ sở dữ liệu và thư mục ảnh, **chạy thủ công**. **Chưa được lập lịch tự động** —
xem GAP-04, đây là rủi ro vận hành cần xử lý **trước khi chạy thật tại đơn vị thí điểm**.

### 10.5 Ngôn ngữ và bản địa hoá

Toàn bộ giao diện, nhãn dữ liệu và thông báo lỗi bằng **tiếng Việt**. Định dạng ngày giờ theo chuẩn
Việt Nam trong tệp xuất Excel.

---

## 11. PHÂN TÍCH KHOẢNG TRỐNG (GAP ANALYSIS)

So sánh hệ thống hiện tại với danh sách nghiệp vụ mục tiêu (`GIS_SONHA_FEATURE_LIST.docx`).

### 11.1 Khoảng trống chức năng

| Mã | Khoảng trống | Ảnh hưởng nghiệp vụ | Mức độ |
|---|---|---|---|
| **GAP-01** | **Không có nhập liệu hàng loạt** (Excel/SHP/GeoJSON) và không có đối soát dữ liệu liên phòng ban | Dữ liệu sẵn có ở các phòng ban phải nhập tay từng hồ sơ | 🔴 Cao |
| **GAP-02** | Danh mục địa chỉ **chưa bắt buộc**; báo cáo, bộ lọc và phát hiện trùng vẫn chạy trên địa chỉ dạng chữ *(từ 18/09/2026: riêng báo cáo dashboard mobile theo xã/ấp đã chuyển sang dùng danh mục — xem 6.7.1; các báo cáo/bộ lọc còn lại trên web vẫn dùng chữ tự do)* | Cùng một tuyến đường viết khác nhau sẽ bị thống kê thành nhiều tuyến; kiểm tra "sai tuyến" trong phương án đánh số kém tin cậy | 🟠 Trung bình–Cao |
| **GAP-03** | **Không chặn trùng số nhà khi tạo/sửa** (BR-07) | Trùng chỉ phát hiện sau qua báo cáo; cần quy trình đối soát thủ công | 🔴 Cao |
| **GAP-04** | **Sao lưu chưa tự động** | Nguy cơ mất dữ liệu nếu sự cố xảy ra giữa hai lần sao lưu thủ công | 🔴 Cao |
| **GAP-05** | Mã QR trên biển chứa **chuỗi định danh thô**, không phải địa chỉ web | Người dân quét bằng camera điện thoại **không tự mở được** trang tra cứu — mục tiêu MT-7 chưa đạt trọn vẹn. *Điều kiện tiên quyết:* chốt tên miền công khai chính thức trước khi đổi, vì biển đã in ra không sửa được | 🟠 Trung bình–Cao |
| **GAP-06** | **Chưa phân quyền theo địa bàn** | Cán bộ một xã xem và sửa được dữ liệu toàn tỉnh | 🟠 Trung bình |
| **GAP-07** | Chưa có quản lý đơn vị công tác, danh mục hệ thống, tham số hoá nguyên tắc đánh số, quản lý phiên đăng nhập, sao lưu/phục hồi qua giao diện | Phụ thuộc thao tác kỹ thuật thủ công | 🟠 Trung bình |
| **GAP-08** | GIS mới ở mức bản đồ điểm: **chưa** bật/tắt lớp, chưa quản lý địa giới/tuyến đường/thửa đất như đối tượng bản đồ, chưa đo khoảng cách/diện tích, chưa bản đồ chuyên đề, chưa in/xuất bản đồ | Nhóm nghiệp vụ "Quản lý bản đồ GIS" mới đáp ứng một phần | 🟠 Trung bình |
| **GAP-09** | Báo cáo chưa xuất PDF, chưa có biểu đồ theo thời gian, chưa in bản đồ chuyên đề | Báo cáo trình lãnh đạo phải xử lý thêm ngoài hệ thống | 🟡 Thấp–Trung bình |
| **GAP-10** | **Chưa quản lý kho, mẫu và sản xuất biển** | Bỏ qua **có chủ đích**: biển luôn cấp thẳng cho một nhà cụ thể, không qua kho vô danh | 🟡 Thấp *(đã chấp nhận)* |
| **GAP-11** | Chưa tích hợp LGSP/NGSP, CSDL đất đai – dân cư, hệ thống một cửa | Phụ thuộc thủ tục kết nối với đơn vị chủ quản hạ tầng tỉnh, **không giải quyết được bằng phát triển phần mềm đơn thuần** | 🟡 Ngoài phạm vi |
| **GAP-12** | Chưa quản lý **địa chỉ cũ/mới** có lịch sử (chỉ có một trường quận/huyện đơn) | Không tra được lịch sử đổi địa chỉ của một căn nhà | 🟠 Trung bình |
| **GAP-13** | Chưa đính kèm **tài liệu ngoài ảnh** (giấy tờ, quyết định) vào hồ sơ | Hồ sơ pháp lý vẫn lưu ngoài hệ thống | 🟡 Thấp–Trung bình |

### 11.2 Khoảng trống riêng của phân hệ mobile

| Mã | Khoảng trống | Ảnh hưởng |
|---|---|---|
| **GAP-14** | **Chưa quét mã QR bằng camera** — cán bộ phải chọn biển từ danh sách | Chậm và dễ chọn nhầm khi gắn biển hàng loạt |
| **GAP-15** | Chưa có màn hình phương án đánh số trên mobile | Cán bộ hiện trường không xem/không góp ý được phương án tại chỗ |
| **GAP-16** | Chưa kiểm tra trùng/sai ngay tại hiện trường | Sai sót chỉ phát hiện sau khi về trụ sở |
| **GAP-17** | Chưa tải trước dữ liệu khu vực trước khi ra hiện trường | Mất mạng thì không tra cứu được nhà đã có |
| **GAP-18** | Chưa gắn toạ độ vào tệp ảnh (EXIF) | Ảnh tách khỏi hệ thống mất giá trị chứng minh vị trí |
| **GAP-19** | Chưa phát hiện xung đột đồng bộ hai chiều — xem RR-03 | Nguy cơ tạo hồ sơ trùng khi mạng chập chờn |

### 11.3 Rủi ro vận hành đã nhận diện

| Mã | Rủi ro | Nguyên nhân | Khuyến nghị |
|---|---|---|---|
| **RR-01** | Số hồ sơ hành chính có thể trùng hoặc nhảy số | Sinh bằng cách đếm hồ sơ trong năm rồi cộng một, không dùng bộ đếm chuyên dụng | Chuyển sang bộ đếm chuyên dụng ở cơ sở dữ liệu trước khi lượng hồ sơ tăng |
| **RR-02** | Ảnh hiện trạng truy cập được không cần đăng nhập | Quyết định có chủ đích của thiết kế | Xác nhận lại với bộ phận pháp chế; nếu không chấp nhận, cần bổ sung kiểm soát truy cập cho thư mục ảnh |
| **RR-03** | Đồng bộ mobile có thể tạo hồ sơ trùng | Chỉ có cơ chế thử lại, chưa khử trùng theo mã nháp | Bổ sung mã nháp duy nhất để máy chủ nhận diện lần gửi lặp; trước mắt đối soát thủ công định kỳ |
| **RR-04** | Xuất Excel bị cắt ở 5.000 dòng mà người dùng **không được cảnh báo rõ** | Chỉ ghi cảnh báo phía máy chủ | Hiển thị cảnh báo trên giao diện khi kết quả chạm ngưỡng |
| **RR-05** | Con số "Phân loại số nhà" trên dashboard có thể không phản ánh thực tế | `reviewStage` không bị hệ thống ràng buộc, phụ thuộc kỷ luật nhập liệu | Ban hành hướng dẫn nội bộ ai chuyển giai đoạn, khi nào; hoặc gắn tự động theo mốc nghiệp vụ |
| **RR-06** | Cán bộ khảo sát không tự sửa được sai sót của mình | Quy tắc phân quyền BR-14 | Quy định rõ kênh báo sai sót về cán bộ địa chính, kèm thời hạn xử lý |

### 11.4 Thứ tự ưu tiên khuyến nghị

| Ưu tiên | Hạng mục | Lý do |
|---|---|---|
| **1** | GAP-04 — lập lịch sao lưu tự động | Rủi ro mất dữ liệu, chi phí xử lý gần như bằng không |
| **2** | GAP-02 — bắt buộc danh mục địa chỉ + chuyển báo cáo sang dùng danh mục | Là nền của GAP-03, GAP-12 và độ tin cậy của toàn bộ báo cáo. Làm sớm khi dữ liệu còn ít |
| **3** | GAP-03 — cảnh báo trùng số nhà **ngay lúc nhập** | Chặn lỗi tại nguồn thay vì sửa sau |
| **4** | GAP-05 — mã QR chứa địa chỉ web | Cần chốt tên miền trước; đổi **một lần duy nhất** vì biển đã in không sửa được |
| **5** | GAP-01 — nhập liệu hàng loạt | Quyết định tốc độ phủ dữ liệu toàn tỉnh |
| **6** | GAP-06 — phân quyền theo địa bàn | Ảnh hưởng mọi chức năng, nên làm sau khi ba hạng mục trên đã ổn định |

---

## 12. PHỤ LỤC

### 12.1 Bản đồ chức năng ↔ giao diện

| Nhóm nghiệp vụ | Web quản trị | Mobile khảo sát |
|---|---|---|
| Tổng quan, báo cáo | Trang *Tổng quan* | Tab *Tổng Quan* |
| Hồ sơ số nhà (danh sách, bản đồ, chi tiết, biển số) | Trang *Hồ sơ nhà* | Tab *Bản Đồ* (chỉ xem) |
| Khảo sát hiện trường | Trang *Khảo sát* (tổ chức, nghiệm thu) | Tab *Nhiệm Vụ* + *Khảo Sát* + *Đã Lưu* |
| Phương án đánh số | Trang *Đánh số* | *(chưa có — GAP-15)* |
| Hồ sơ hành chính | Trang *Hồ sơ* | *(không áp dụng)* |
| Danh mục địa chỉ | Trang *Địa chỉ* *(chỉ ADMIN)* | *(chỉ dùng để chọn khi khảo sát)* |
| Gắn biển hiện trường | *(qua chi tiết hồ sơ)* | Tab *Gắn Biển* |
| In tem QR | Trang in tem riêng | *(không áp dụng)* |
| Tra cứu công khai | Trang tra cứu công khai | *(không áp dụng)* |

### 12.2 Danh mục điểm truy cập nghiệp vụ

Tiền tố chung `/api`. Cột **Quyền**: `*` = mọi vai trò đã đăng nhập · `PUB` = công khai.

| Nhóm | Điểm truy cập | Quyền | Chức năng nghiệp vụ |
|---|---|---|---|
| Hệ thống | `GET /health` | PUB | Kiểm tra tình trạng hệ thống và cơ sở dữ liệu |
| Xác thực | `POST /auth/login` · `GET /auth/me` | PUB · `*` | Đăng nhập · Thông tin tài khoản hiện tại |
| Người dùng | `GET` · `POST` · `PATCH` · `DELETE /users` | ADMIN | Quản lý tài khoản *(xoá = vô hiệu hoá)* |
| Danh mục | `/districts` `/wards` `/hamlets` `/streets` `/alleys` | Đọc `*` · Ghi ADMIN | Danh mục địa chỉ 5 cấp |
| Hồ sơ số nhà | `GET /houses` | `*` | Danh sách có lọc và phân trang |
| | `GET /houses/geojson` | `*` | Lớp dữ liệu bản đồ |
| | `GET /houses/nearby` | `*` | Tra cứu theo toạ độ và bán kính |
| | `GET /houses/stats` | `*` | Thống kê nhanh theo trạng thái |
| | `GET /houses/export.xlsx` | `*` | Xuất Excel theo bộ lọc |
| | `GET /houses/:id` · `/history` | `*` | Chi tiết · Lịch sử thay đổi |
| | `GET /houses/:id/qrcode.png` | **PUB** | Ảnh mã QR để in tem |
| | `GET /houses/:id/public` | **PUB** | Thông tin tra cứu công khai |
| | `POST /houses` | ADMIN, CADASTRAL, **SURVEYOR** | Tạo hồ sơ *(điểm mobile đồng bộ nháp)* |
| | `PATCH /houses/:id` | ADMIN, CADASTRAL | Sửa hồ sơ |
| | `POST /houses/:id/resurvey` | **SURVEYOR** | Sửa lại đúng nhà bị yêu cầu khảo sát lại (BR-85) — Phase 11 Đợt 2b |
| | `POST /houses/:id/photos` | ADMIN, CADASTRAL, **SURVEYOR** | Tải ảnh lên |
| | `DELETE /houses/:id/photos/:photoId` | ADMIN, CADASTRAL | Xoá ảnh |
| Phương án đánh số | `GET /numbering-schemes` · `/:id` · `/:id/validate` | `*` | Danh sách · Chi tiết · Kiểm tra |
| | `POST` · `PATCH` · `DELETE` phương án và mục | ADMIN, CADASTRAL | Soạn thảo |
| | `POST /:id/generate` · `/:id/submit` | ADMIN, CADASTRAL | Sinh số tự động · Trình duyệt |
| | `POST /:id/approve` · `/:id/reject` | **ADMIN** | Phê duyệt · Từ chối |
| Biển số | `GET /house-plates` · `/:id` · `/:id/qrcode.png` | `*` | Tra cứu biển |
| | `POST /house-plates` | ADMIN, CADASTRAL | Cấp mới / cấp đổi / cấp lại |
| | `POST /:id/install` · `/:id/not-installed` | ADMIN, CADASTRAL, **SURVEYOR** | Xác nhận gắn · Ghi lý do chưa gắn |
| | `POST /:id/revoke` | ADMIN, CADASTRAL | Thu hồi |
| Khảo sát | `/survey-campaigns` · `/survey-zones` | Đọc `*` · Ghi ADMIN, CADASTRAL | Đợt · Phân vùng |
| | `GET /survey-assignments` · `/surveyors` | `*` · ADMIN, CADASTRAL | Nhiệm vụ · Danh sách cán bộ khảo sát |
| | `POST` · `PATCH` · `DELETE /survey-assignments` | ADMIN, CADASTRAL | Giao, sửa, huỷ nhiệm vụ |
| | `POST /:id/start` · `/:id/submit` | **SURVEYOR** | Bắt đầu · Gửi duyệt *(chỉ nhiệm vụ của mình)* |
| | `POST /:id/issues` | **SURVEYOR** | Báo vấn đề / xin hỗ trợ *(chỉ nhiệm vụ của mình, không đổi trạng thái)* — Phase 11 Đợt 2 |
| | `GET /:id/houses[?revisit=true]` | `*` *(SURVEYOR: chỉ nhiệm vụ của mình)* | Nhà của nhiệm vụ / nhà còn cờ khảo sát lại — Đợt 2b |
| | `POST /:id/request-revisit` | ADMIN, CADASTRAL | Nay nhận thêm `houses[{houseId, reason?}]` để đánh dấu từng nhà — Đợt 2b |
| | `POST /:id/complete` · `/:id/request-revisit` | ADMIN, CADASTRAL | Nghiệm thu · Yêu cầu khảo sát lại |
| Hồ sơ hành chính | `GET /house-cases` · `/staff` · `/:id` | ADMIN, CADASTRAL | Danh sách · Cán bộ xử lý · Chi tiết |
| | `POST` · `PATCH /:id` | ADMIN, CADASTRAL | Tiếp nhận · Cập nhật |
| | `POST /:id/assign` `/link-house` `/advance` `/reject` `/reopen` `/notes` | ADMIN, CADASTRAL | Phân công · Liên kết nhà · Tiến bước · Từ chối · Mở lại · Ghi chú |
| Báo cáo | `GET /dashboard/summary` · `/dashboard/mine` | `*` | Tổng quan hệ thống · Báo cáo nhanh cá nhân |
| Thông báo | `GET /notifications` · `/unread-count` | `*` | Thông báo của chính mình *(Phase 11)* |
| | `POST /notifications/:id/read` · `/read-all` | `*` | Đánh dấu đã đọc |
| | `POST /notifications/remind` | ADMIN, CADASTRAL | Nhắc thủ công người nhận việc |
| | `POST /notifications/run-reminders` | ADMIN | Chạy quét nhắc hạn ngay (kiểm thử/vận hành) |

### 12.3 Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| `nghiệp vụ/GIS_SONHA_FEATURE_LIST.docx` | Danh sách nghiệp vụ mục tiêu — 13 nhóm web, 10 nhóm mobile |
| `nghiệp vụ/BRD_GIS_SoNha (1).docx` | Tài liệu yêu cầu nghiệp vụ gốc |
| `KE_HOACH_NANG_CAP.md` | Đối chiếu hiện trạng với mục tiêu, lộ trình nâng cấp và các quyết định kiến trúc |
| `KE_HOACH_MVP_PHASES.md` · `KE_HOACH_TRIEN_KHAI.md` | Phân chia giai đoạn và kế hoạch triển khai |
| `HUONG_DAN_SU_DUNG.md` | Hướng dẫn sử dụng cho cán bộ |
| `Góp ý phần mềm.docx` · `BACKLOG.md` | Góp ý khách hàng 11/09/2026 và backlog xử lý — nguồn của các thay đổi phiên bản 1.1 |
| `README.md` · `apps/mobile/README.md` | Hướng dẫn cài đặt, vận hành hai phân hệ |

### 12.4 Lịch sử phiên bản tài liệu

| Phiên bản | Ngày | Người lập | Nội dung |
|---|---|---|---|
| 1.0 | 18/09/2026 | Business Analyst | Baseline — mô tả nghiệp vụ hệ thống sau Phase 10, kèm phân tích khoảng trống và rủi ro vận hành |
| 1.1 | 18/09/2026 | Business Analyst | Cập nhật theo đợt xử lý góp ý khách hàng 11/09/2026 (`BACKLOG.md`): loại công trình 6 giá trị, trường Ấp/Thôn thu thập trên cả web và mobile, chức vụ tài khoản, báo cáo dashboard hai mức xã→ấp (mobile), ngữ cảnh "xã đang làm việc" thay cho giả định một xã cố định |
| 1.2 | 26/09/2026 | Business Analyst | Phase 11 Đợt 1: thông báo và nhắc nhở giao việc (QT-09, BR-74 đến BR-81), hạn xử lý cho hồ sơ hành chính, endpoint `/notifications` |
| 1.3 | 26/09/2026 | Business Analyst | Phase 11 Đợt 2: chỉ tiêu và tiến độ %, nhật ký nhiệm vụ khảo sát, báo vấn đề / xin hỗ trợ (BR-78, BR-82, BR-83) |
| 1.4 | 26/09/2026 | Business Analyst | Phase 11 Đợt 2b: khảo sát lại theo từng nhà thay vì tạo nhà mới trùng (BR-84, BR-85, BR-86; điều chỉnh BR-14) |

---

> **Các điểm cần cán bộ nghiệp vụ xác nhận trước khi chốt baseline:**
> 1. Hai trục trạng thái của hồ sơ số nhà (Mục 4.3) — ai chịu trách nhiệm chuyển *giai đoạn phân loại* và tại mốc nào?
> 2. "Trùng thứ tự" và "sai tuyến" trong phương án đánh số (BR-29) — nâng thành điều kiện chặn hay giữ mức cảnh báo?
> 3. Ảnh hiện trạng truy cập không cần đăng nhập (BR-61, RR-02) — có được chấp nhận về mặt pháp lý không?
> 4. Tệp Excel xuất ra chứa CCCD và số điện thoại chủ hộ — quy định lưu trữ, chia sẻ như thế nào?
> 5. Tên miền công khai chính thức của hệ thống — cần chốt trước khi đổi nội dung mã QR (GAP-05).
