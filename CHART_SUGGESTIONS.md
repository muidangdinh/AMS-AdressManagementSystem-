# Gợi ý nâng cấp biểu đồ trang Tổng quan — theo phong cách Cyber-Tech / Geospatial hiện tại

> Tài liệu đề xuất, chưa triển khai. Mục tiêu: biểu đồ đồng bộ với giao diện đã đổi (nền tối navy, card kính mờ, màu trạng thái phát sáng, đổi theme sáng/tối) mà **không đổi thư viện** (giữ Chart.js + react-chartjs-2) và hạn chế đụng API.

---

## 1. Hiện trạng

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| `ChartSection`, `DonutChart`, `GaugeChart`, `BarChartH`, `StackedBarChart` | `apps/web/src/components/DashboardCharts.tsx` | Đã đọc màu theo theme qua `cssColor()` + `useChartTheme()` (vẽ lại khi đổi theme). |
| Bảng màu biểu đồ | `CHART_COLORS` trong `packages/shared/src/index.ts` | Dùng chung với mobile — `red` đang là `#f43f5e` (rose), `blue` `#3b82f6`. |
| Dữ liệu | `GET /api/dashboard/summary` (`dashboard.service.ts`) | Chỉ có số đếm **tại thời điểm hiện tại** — chưa có chuỗi thời gian. |
| Các khối trên trang | `app/houses/dashboard/page.tsx` | Báo cáo số lượng nhà, Phân loại số nhà, Ấp/thôn, Theo xã/phường, Tuyến đường, Số nhà trùng, Biển số, Tiến độ khảo sát, Tiến độ đánh số, Hồ sơ – quy trình. |

## 2. Nguyên tắc thiết kế (áp dụng cho mọi biểu đồ)

1. **Màu chỉ lấy từ token** (`--ok`, `--warn`, `--danger`, `--info`, `--accent`, `--fg`, `--line`) qua `cssColor()` — không viết hex trong component.
2. **Phát sáng có chừng mực:** quầng sáng (shadow/glow) chỉ cho phần tử chính (vòng gauge, đường xu hướng), không cho cả biểu đồ.
3. **Nền biểu đồ trong suốt**, nằm trong card `.glass`; lưới mờ (`--line` alpha 0.4–0.6), bỏ viền trục.
4. **Bo tròn đầu thanh / cung** (`borderRadius`, `borderSkipped: false`), độ dày đồng đều.
5. **Tooltip thống nhất:** nền `--shell` 95%, viền `--line`, chấm màu dạng tròn, số dạng `tabular-nums` (định dạng `vi-VN`).
6. **Hover:** phần tử được trỏ sáng lên, phần còn lại mờ 40% (tập trung sự chú ý).
7. **Animation ngắn:** 600–800ms `easeOutQuart`; tắt khi `prefers-reduced-motion`.

## 3. Đề xuất cụ thể

### 3.1. Thẻ KPI có sparkline (không cần API mới nếu chấp nhận dạng "thanh tỉ lệ")
- **Phương án A (ngay, không đổi API):** dưới số liệu mỗi `StatCard` thêm **thanh tỉ lệ mảnh** (ví dụ Đã cấp biển / Tổng) có gradient + glow — gọn, đúng dữ liệu hiện có.
- **Phương án B (cần API — xem mục 4):** sparkline 8–12 tuần, đường cong `tension: 0.4`, không trục, không điểm, vùng tô gradient mờ dần xuống dưới.

### 3.2. "Báo cáo số lượng nhà" — thay donut phẳng
- **Gauge nửa vòng** (`GaugeChart` sẵn có): % đã cấp biển & QR / tổng nhà, cung màu `--ok` có glow, số % lớn ở giữa.
- **Thanh ngang xếp chồng 1 dòng** (100%): Đã cấp biển (`--ok`) · Chờ duyệt (`--warn`) · Cần hiệu chỉnh (`--danger`), nhãn % ngay trên đoạn; bấm đoạn → mở danh sách như hiện tại (`onSliceClick`).
- Giữ legend dạng chip có chấm phát sáng (dùng `StatusBadge`) thay vì legend của Chart.js — dễ đọc ở cả 2 theme.

### 3.3. "Phân loại số nhà" (5 giai đoạn)
- Đổi donut → **thanh tiến trình theo giai đoạn** (funnel ngang): Đề xuất → Đã kiểm tra → Đã duyệt → Đã ký → Từ chối, mỗi bậc một thanh dài theo số lượng, màu `--info` → `--accent` → `--ok`, Từ chối `--danger`.

### 3.4. Địa bàn: Ấp/thôn, Xã/phường, Tuyến đường
- `BarChartH`: thanh bo tròn, **gradient ngang** (`--accent` → `--info`), nhãn giá trị ở cuối thanh (đã có), tối đa 10 dòng, tên dài cắt bớt (đã có).
- "Theo xã/phường" (`StackedBarChart`): đã có số (`--ok`) / chưa có số (`--warn`), thêm **sắp xếp theo số chưa có số** để làm nổi "điểm nóng cần xử lý".
- Gợi ý thêm khối **"Top tuyến đường cần xử lý"** = sắp `topStreets` theo số nhà chưa có số (cần API, mục 4 — hiện `byStreet` chỉ có khi lọc 1 xã).

### 3.5. Biển số, Khảo sát, Đánh số, Hồ sơ
- **Biển số:** gauge "Tiến độ gắn biển" (`installedPct`) + thanh xếp chồng Đã cấp / Đã gắn / Thu hồi.
- **Khảo sát:** gauge `completedPct` + thanh trạng thái nhiệm vụ (Đã giao · Đang làm · Chờ duyệt · Hoàn tất · Khảo sát lại).
- **Đánh số:** gauge `approvedPct` + chip trạng thái phương án.
- **Hồ sơ:** 3 KPI nhỏ (Đang xử lý / Hoàn tất / Từ chối) với thanh tỉ lệ — bỏ biểu đồ nếu số lượng ít.

## 4. Dữ liệu cần bổ sung (nếu muốn sparkline / biểu đồ theo thời gian)

Không cần đổi schema — DB đã có mốc thời gian: `House.createdAt`, `House.approvedAt`, `HousePlate.installedAt`, `SurveyAssignment.reviewedAt`, `HouseHistory` (đổi trạng thái).

Đề xuất endpoint `GET /api/dashboard/trends?weeks=12` trả về:

```ts
interface DashboardTrends {
  weeks: string[];                 // nhãn tuần, vd "22/09"
  housesCreated: number[];         // hồ sơ mới / tuần
  housesApproved: number[];        // được cấp số / tuần (approvedAt)
  needsAdjustEvents: number[];     // số lần chuyển sang "Cần hiệu chỉnh" / tuần (HouseHistory)
  platesInstalled: number[];       // biển đã gắn / tuần (installedAt)
  assignmentsCompleted: number[];  // nhiệm vụ khảo sát nghiệm thu / tuần (reviewedAt)
}
// kèm (tuỳ chọn) topPendingStreets: { street: string; pending: number }[] — toàn tỉnh
```

Dùng cho: sparkline 4 thẻ KPI, **biểu đồ vùng (area) gradient** "Tiến độ khảo sát theo tuần", và khối "Top tuyến đường cần xử lý".

## 5. Mẫu cấu hình Chart.js theo token

```ts
// Gradient cho area / sparkline — tạo trong scriptable option để đúng kích thước canvas
const areaFill = (ctx: ScriptableContext<'line'>) => {
  const { chart } = ctx;
  const { ctx: c, chartArea } = chart;
  if (!chartArea) return 'transparent';
  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, cssColor('--accent', 0.35));
  g.addColorStop(1, cssColor('--accent', 0));
  return g;
};

const sparkline: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: { x: { display: false }, y: { display: false } },
  elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } },
  animation: { duration: 700, easing: 'easeOutQuart' },
};
// dataset: { data, borderColor: cssColor('--accent'), backgroundColor: areaFill, fill: true }
```

Tooltip dùng chung (thay `TOOLTIP_STYLE` đang cố định `#0f172a`):

```ts
const tooltipStyle = () => ({
  backgroundColor: cssColor('--shell', 0.95),
  borderColor: cssColor('--line'),
  borderWidth: 1,
  titleColor: cssColor('--fg'),
  bodyColor: cssColor('--fg-muted'),
  padding: 10,
  cornerRadius: 8,
  usePointStyle: true,
});
```

## 6. Thứ tự triển khai đề xuất

| Bước | Nội dung | Đụng API? | Ước lượng |
|---|---|---|---|
| 1 | Tooltip theo token, gradient + bo tròn cho `BarChartH`/`StackedBarChart`, hover làm mờ phần còn lại | Không | Nhỏ |
| 2 | "Báo cáo số lượng nhà" → gauge + thanh xếp chồng 100%; "Phân loại số nhà" → funnel ngang | Không | Vừa |
| 3 | Thanh tỉ lệ trong `StatCard` (KPI phương án A) | Không | Nhỏ |
| 4 | Endpoint `dashboard/trends` + sparkline KPI + area chart tiến độ khảo sát + Top tuyến đường cần xử lý | **Có** | Vừa–lớn |

**Lưu ý:**
- `CHART_COLORS` ở `packages/shared` dùng chung với mobile — nếu đổi màu (vd `red` → `#EF4444`) cần kiểm tra app mobile; an toàn hơn là ánh xạ màu ở web qua token.
- Mọi thay đổi chỉ ở `apps/web` cho bước 1–3; bước 4 thêm code ở `apps/api/src/dashboard` + type ở `packages/shared`.
