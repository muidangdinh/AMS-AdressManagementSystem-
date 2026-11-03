'use client';

import { useTheme } from '@/lib/theme';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type Chart,
  type ChartOptions,
  type Plugin,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { ChartSlice, StackedBarItem } from '@tayninh/shared';
import { EmptyState } from './ui';

// Kiểu dữ liệu biểu đồ dùng chung với mobile — định nghĩa ở packages/shared.
export type { ChartSlice, StackedBarItem };

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// Số trên trục theo kiểu Việt Nam (9.000), khớp với số trên cột và tooltip (`fmt`).
ChartJS.defaults.locale = 'vi-VN';

const fmt = (n: number) => n.toLocaleString('vi-VN');

/** Đọc màu token theme hiện tại (globals.css) cho Chart.js — canvas không dùng được class Tailwind. */
function cssColor(name: string, alpha = 1): string {
  if (typeof document === 'undefined') return `rgba(100,116,139,${alpha})`;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).join(',');
  return v ? `rgba(${v},${alpha})` : `rgba(100,116,139,${alpha})`;
}

/**
 * Theo dõi theme để vẽ lại biểu đồ khi đổi sáng/tối: trả về `key` gắn vào <Bar>
 * (đổi key = Chart.js tạo lại canvas với màu mới) và cập nhật màu chữ mặc định.
 */
function useChartTheme() {
  const { theme } = useTheme();
  ChartJS.defaults.color = cssColor('--fg-muted');
  return theme;
}

export interface ChartBar {
  key: string;
  name: string;
  value: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  padding: 10,
  cornerRadius: 8,
  usePointStyle: true,
  boxPadding: 4,
  titleFont: { size: 12, weight: 'bold' as const },
  bodyFont: { size: 12 },
};

/**
 * Vẽ giá trị ở đầu mỗi cột — thay cho chartjs-plugin-datalabels để khỏi thêm package.
 * Cột đứng: số nằm trên đỉnh cột; cột ngang (`indexAxis: 'y'`): số nằm bên phải thanh.
 */
const barValuePlugin: Plugin<'bar'> = {
  id: 'barValue',
  afterDatasetsDraw(chart: Chart<'bar'>) {
    const horizontal = chart.options.indexAxis === 'y';
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.fillStyle = cssColor('--fg');
    ctx.font = `bold 11px ${ChartJS.defaults.font.family}`;
    ctx.textAlign = horizontal ? 'left' : 'center';
    ctx.textBaseline = horizontal ? 'middle' : 'bottom';
    meta.data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i];
      if (typeof value !== 'number') return;
      const { x, y } = bar as unknown as { x: number; y: number };
      if (horizontal) ctx.fillText(fmt(value), x + 6, y);
      else ctx.fillText(fmt(value), x, y - 4);
    });
    ctx.restore();
  },
};

/** Ngắt nhãn trục thành nhiều dòng (~10 ký tự/dòng) để cột đứng không phải xoay chữ nghiêng. */
function wrapLabel(name: string, maxLen = 10): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of name.split(/\s+/)) {
    if (line && `${line} ${word}`.length > maxLen) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Cột đứng cho các mục "tổng + chia theo trạng thái": mỗi trạng thái 1 cột, giữ màu theo trạng thái,
 * số tổng hiện ở dòng trên biểu đồ. Bấm cột → `onBarClick(key)` (mở danh sách bản ghi).
 */
export function ColumnChart({
  data,
  totalLabel,
  totalValue,
  onBarClick,
}: {
  data: ChartSlice[];
  totalLabel: string;
  totalValue: number;
  onBarClick?: (key: string) => void;
}) {
  const chartTheme = useChartTheme();
  const sum = data.reduce((s, d) => s + d.value, 0);

  if (sum === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    // Chừa chỗ phía trên cho số trên đỉnh cột cao nhất.
    layout: { padding: { top: 20 } },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index !== undefined) onBarClick?.(data[index].key);
    },
    onHover: (evt, elements) => {
      const target = evt.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    scales: {
      x: {
        // Nhãn đã ngắt dòng (wrapLabel) nên giữ nằm ngang, không để Chart.js xoay nghiêng hay ẩn bớt khi màn hẹp.
        ticks: { color: cssColor('--fg-muted'), font: { size: 11 }, maxRotation: 0, autoSkip: false },
        grid: { display: false },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: cssColor('--fg-muted'), font: { size: 11 } },
        grid: { color: cssColor('--line', 0.6) },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => data[items[0].dataIndex]?.name ?? '',
          label: (item) => {
            const value = item.parsed.y ?? 0;
            const pct = Math.round((value / sum) * 100);
            return ` ${fmt(value)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div>
      <p className="text-xs text-fg-muted mb-1">
        {totalLabel}: <b className="text-base text-fg tabular-nums">{fmt(totalValue)}</b>
      </p>
      <div className="h-60">
        <Bar
          key={chartTheme}
          data={{
            labels: data.map((d) => wrapLabel(d.name)),
            datasets: [
              {
                data: data.map((d) => d.value),
                backgroundColor: data.map((d) => d.color),
                hoverBackgroundColor: data.map((d) => d.color),
                borderRadius: 0, // phẳng, góc vuông — khớp phong cách Metro của dashboard
                maxBarThickness: 56,
              },
            ],
          }}
          options={options}
          plugins={[barValuePlugin]}
        />
      </div>
    </div>
  );
}

/** Ô số phần trăm kèm thanh tiến độ (tiến độ gắn biển, hoàn tất khảo sát…) — thay cho đồng hồ bán nguyệt. */
export function ProgressStat({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="w-full border border-line bg-surface-2/50 p-4">
      <p className="text-3xl font-extrabold tabular-nums leading-tight" style={{ color }}>
        {pct}%
      </p>
      <p className="text-xs text-fg-muted font-medium mt-0.5">{label}</p>
      <div className="mt-3 h-2 rounded-full bg-fg-subtle/25 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Bar ngang cho các mục xếp hạng (ấp/thôn, tuyến đường, số nhà trùng). */
export function BarChartH({
  data,
  onBarClick,
  barColor = '#3b82f6',
}: {
  data: ChartBar[];
  onBarClick?: (key: string) => void;
  barColor?: string;
}) {
  const chartTheme = useChartTheme();

  if (data.length === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 32 } },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index !== undefined) onBarClick?.(data[index].key);
    },
    onHover: (evt, elements) => {
      const target = evt.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0, color: cssColor('--fg-muted'), font: { size: 11 } },
        grid: { color: cssColor('--line', 0.6) },
        border: { display: false },
      },
      y: {
        ticks: {
          color: cssColor('--fg-muted'),
          font: { size: 11 },
          // Tên ấp/đường có thể rất dài — cắt bớt cho khỏi bóp hẹp phần thanh.
          callback(_value, index) {
            const name = data[index]?.name ?? '';
            return name.length > 22 ? `${name.slice(0, 21)}…` : name;
          },
        },
        grid: { display: false },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => data[items[0].dataIndex]?.name ?? '',
          label: (item) => ` ${fmt(item.parsed.x ?? 0)} nhà`,
        },
      },
    },
  };

  return (
    <div style={{ height: Math.max(200, data.length * 38) }}>
      <Bar
        key={chartTheme}
        data={{
          labels: data.map((d) => d.name),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: barColor,
              hoverBackgroundColor: barColor,
              borderRadius: 0,
              barThickness: 20,
              maxBarThickness: 24,
            },
          ],
        }}
        options={options}
        plugins={[barValuePlugin]}
      />
    </div>
  );
}

/** Bar ngang chồng 2 phần "đã có số / chưa có số" — dùng cho thống kê theo xã/phường. */
export function StackedBarChart({
  data,
  onBarClick,
}: {
  data: StackedBarItem[];
  onBarClick?: (key: string) => void;
}) {
  const chartTheme = useChartTheme();

  if (data.length === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 16 } },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index !== undefined) onBarClick?.(data[index].key);
    },
    onHover: (evt, elements) => {
      const target = evt.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: { precision: 0, color: cssColor('--fg-muted'), font: { size: 11 } },
        grid: { color: cssColor('--line', 0.6) },
        border: { display: false },
      },
      y: {
        stacked: true,
        ticks: {
          color: cssColor('--fg-muted'),
          font: { size: 11 },
          callback(_value, index) {
            const name = data[index]?.name ?? '';
            return name.length > 22 ? `${name.slice(0, 21)}…` : name;
          },
        },
        grid: { display: false },
        border: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          padding: 12,
          color: cssColor('--fg'),
          font: { size: 12, weight: 500 },
        },
      },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          title: (items) => data[items[0].dataIndex]?.name ?? '',
          label: (item) => ` ${item.dataset.label}: ${fmt(item.parsed.x ?? 0)} nhà`,
          footer: (items) => {
            const item = data[items[0].dataIndex];
            return item ? `Tổng: ${fmt(item.approved + item.withoutNumber)} nhà` : '';
          },
        },
      },
    },
  };

  return (
    <div style={{ height: Math.max(200, data.length * 38) }}>
      <Bar
        key={chartTheme}
        data={{
          labels: data.map((d) => d.name),
          datasets: [
            {
              label: 'Đã có số',
              data: data.map((d) => d.approved),
              backgroundColor: '#10b981',
              borderRadius: 0,
              barThickness: 20,
              maxBarThickness: 24,
            },
            {
              label: 'Chưa có số',
              data: data.map((d) => d.withoutNumber),
              backgroundColor: '#f59e0b',
              borderRadius: 0,
              barThickness: 20,
              maxBarThickness: 24,
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}
