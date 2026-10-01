'use client';

import { createContext, useContext, useState } from 'react';
import { useTheme } from '@/lib/theme';
import {
  ArcElement,
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
import { Bar, Doughnut } from 'react-chartjs-2';
import type { ChartSlice, StackedBarItem } from '@tayninh/shared';
import { EmptyState } from './ui';

// Kiểu dữ liệu biểu đồ dùng chung với mobile — định nghĩa ở packages/shared.
export type { ChartSlice, StackedBarItem };

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
ChartJS.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Đọc màu token theme hiện tại (globals.css) cho Chart.js — canvas không dùng được class Tailwind. */
function cssColor(name: string, alpha = 1): string {
  if (typeof document === 'undefined') return `rgba(100,116,139,${alpha})`;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).join(',');
  return v ? `rgba(${v},${alpha})` : `rgba(100,116,139,${alpha})`;
}

/**
 * Theo dõi theme để vẽ lại biểu đồ khi đổi sáng/tối: trả về `key` gắn vào <Doughnut>/<Bar>
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

/** Cho phép biểu đồ (do trang cha dựng sẵn) gọi mở/thu gọn khối chi tiết của `ChartSection`. */
const ToggleDetailsContext = createContext<() => void>(() => {});

/**
 * Khung dùng chung cho mọi mục trên Dashboard: mặc định chỉ hiện biểu đồ, bấm vào
 * nền biểu đồ mới bung khối số liệu cũ (thẻ số/danh sách xếp hạng) ra bên dưới.
 * Bấm trúng 1 lát/1 thanh thì mở popup danh sách thay vì bung khối chi tiết.
 */
export function ChartSection({
  title,
  subtitle,
  chart,
  details,
}: {
  title: string;
  subtitle?: string;
  chart: React.ReactNode;
  details: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded((v) => !v);

  return (
    <section className="mb-6">
      <div className="mb-2.5">
        <h3 className="text-sm font-bold text-fg">{title}</h3>
        {subtitle && <p className="text-xs text-fg-subtle">{subtitle}</p>}
      </div>

      <div
        onClick={toggle}
        className="glass p-4 cursor-pointer hover:border-accent/30 transition"
      >
        {/* Canvas tự xử lý click (lát → popup, nền → toggle) nên chặn nổi bọt để không toggle 2 lần. */}
        <div onClick={(e) => e.stopPropagation()}>
          <ToggleDetailsContext.Provider value={toggle}>{chart}</ToggleDetailsContext.Provider>
        </div>
        <p className="text-[11px] text-fg-subtle text-center mt-2">
          Bấm vào lát/thanh để xem danh sách · bấm nền biểu đồ để{' '}
          {expanded ? 'thu gọn' : 'xem'} số liệu chi tiết
        </p>
      </div>

      {expanded && <div className="mt-3">{details}</div>}
    </section>
  );
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

/** Vẽ số tổng + nhãn vào đúng tâm vòng donut (Chart.js không có sẵn). */
function centerTextPlugin(label: string, value: number): Plugin<'doughnut'> {
  return {
    id: 'centerText',
    afterDraw(chart: Chart<'doughnut'>) {
      const arc = chart.getDatasetMeta(0)?.data?.[0] as unknown as { x: number; y: number } | undefined;
      if (!arc) return;
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssColor('--fg');
      ctx.font = `bold 24px ${ChartJS.defaults.font.family}`;
      ctx.fillText(String(value), arc.x, arc.y - 8);
      ctx.fillStyle = cssColor('--fg-subtle');
      ctx.font = `11px ${ChartJS.defaults.font.family}`;
      ctx.fillText(label, arc.x, arc.y + 14);
      ctx.restore();
    },
  };
}

/** Donut cho các mục "tổng + chia theo trạng thái" — tổng hiển thị ở giữa vòng tròn. */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  onSliceClick,
}: {
  data: ChartSlice[];
  centerLabel: string;
  centerValue: number;
  onSliceClick?: (key: string) => void;
}) {
  const chartTheme = useChartTheme();
  const toggleDetails = useContext(ToggleDetailsContext);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    layout: { padding: 4 },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index === undefined) toggleDetails();
      else onSliceClick?.(data[index].key);
    },
    onHover: (evt, elements) => {
      const target = evt.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          padding: 14,
          // Màu chữ chú giải theo theme (rõ ở cả sáng lẫn tối) — xem cssColor/useChartTheme.
          color: cssColor('--fg'),
          font: { size: 12, weight: 500 },
          generateLabels: () =>
            data.map((slice, i) => ({
              text: `${slice.name} — ${slice.value}`,
              fontColor: cssColor('--fg'),
              fillStyle: slice.color,
              strokeStyle: slice.color,
              lineWidth: 0,
              pointStyle: 'circle' as const,
              index: i,
            })),
        },
      },
      tooltip: {
        ...TOOLTIP_STYLE,
        callbacks: {
          label: (item) => {
            const value = item.parsed;
            const pct = total ? Math.round((value / total) * 100) : 0;
            return ` ${item.label}: ${value} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="h-60">
      <Doughnut
        key={chartTheme}
        data={{
          labels: data.map((d) => d.name),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: data.map((d) => d.color),
              borderColor: cssColor('--surface'),
              borderWidth: 2,
              borderRadius: 6,
              hoverOffset: 10,
            },
          ],
        }}
        options={options}
        plugins={[centerTextPlugin(centerLabel, centerValue)]}
      />
    </div>
  );
}

/** Đồng hồ bán nguyệt cho 1 chỉ số phần trăm (tiến độ gắn biển, hoàn tất khảo sát…). */
export function GaugeChart({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const chartTheme = useChartTheme();
  const toggleDetails = useContext(ToggleDetailsContext);
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  const gaugeTextPlugin: Plugin<'doughnut'> = {
    id: 'gaugeText',
    afterDraw(chart: Chart<'doughnut'>) {
      const arc = chart.getDatasetMeta(0)?.data?.[0] as unknown as { x: number; y: number } | undefined;
      if (!arc) return;
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssColor('--fg');
      ctx.font = `bold 22px ${ChartJS.defaults.font.family}`;
      ctx.fillText(`${pct}%`, arc.x, arc.y - 10);
      ctx.fillStyle = cssColor('--fg-subtle');
      ctx.font = `11px ${ChartJS.defaults.font.family}`;
      ctx.fillText(label, arc.x, arc.y + 12);
      ctx.restore();
    },
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    circumference: 180,
    rotation: 270,
    cutout: '72%',
    layout: { padding: 4 },
    onClick: () => toggleDetails(),
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  return (
    <div className="h-[150px]">
      <Doughnut
        key={chartTheme}
        data={{
          labels: [label, 'Còn lại'],
          datasets: [
            {
              data: [pct, 100 - pct],
              backgroundColor: [color, cssColor('--line')],
              borderWidth: 0,
              borderRadius: 6,
            },
          ],
        }}
        options={options}
        plugins={[gaugeTextPlugin]}
      />
    </div>
  );
}

/** Vẽ giá trị ở cuối mỗi thanh — thay cho chartjs-plugin-datalabels để khỏi thêm package. */
const barValuePlugin: Plugin<'bar'> = {
  id: 'barValue',
  afterDatasetsDraw(chart: Chart<'bar'>) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.fillStyle = cssColor('--fg');
    ctx.font = `bold 11px ${ChartJS.defaults.font.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i];
      if (typeof value !== 'number') return;
      const { x, y } = bar as unknown as { x: number; y: number };
      ctx.fillText(String(value), x + 6, y);
    });
    ctx.restore();
  },
};

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
  const toggleDetails = useContext(ToggleDetailsContext);

  if (data.length === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 32 } },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index === undefined) toggleDetails();
      else onBarClick?.(data[index].key);
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
          label: (item) => ` ${item.parsed.x} nhà`,
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
              borderRadius: 6,
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
  const toggleDetails = useContext(ToggleDetailsContext);

  if (data.length === 0) return <EmptyState icon="📭" text="Chưa có dữ liệu" />;

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 16 } },
    onClick: (_evt, elements) => {
      const index = elements[0]?.index;
      if (index === undefined) toggleDetails();
      else onBarClick?.(data[index].key);
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
          label: (item) => ` ${item.dataset.label}: ${item.parsed.x} nhà`,
          footer: (items) => {
            const item = data[items[0].dataIndex];
            return item ? `Tổng: ${item.approved + item.withoutNumber} nhà` : '';
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
              borderRadius: 4,
              barThickness: 20,
              maxBarThickness: 24,
            },
            {
              label: 'Chưa có số',
              data: data.map((d) => d.withoutNumber),
              backgroundColor: '#f59e0b',
              borderRadius: 4,
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
