'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * Bảng màu tile Metro (Windows 8) — bản đậm hơn màu gốc để chữ trắng đạt tương phản ≥ 4.5:1 (WCAG AA).
 * Màu gốc Win 8 như #2D89EF (3.5:1), #00ABA9 (2.8:1), #E3A21A (2.2:1) không đạt nên không dùng.
 * Đổi màu ở đây phải kiểm tra lại tương phản với chữ trắng.
 */
export const METRO_COLORS = {
  /** Số nhà */
  blue: '#1E5FB4',
  /** Biển số */
  teal: '#00747A',
  /** Khảo sát */
  orange: '#B8510D',
  /** Đánh số */
  purple: '#5B3AA8',
  /** Hồ sơ hành chính */
  crimson: '#A1173F',
  /** Địa bàn */
  green: '#1B7A2E',
  /** Trạng thái: đã xong */
  ok: '#10773A',
  /** Trạng thái: đang chờ */
  warn: '#B45309',
  /** Trạng thái: cần xử lý */
  danger: '#C42B1C',
  /** Trung tính */
  slate: '#4A5568',
} as const;

export type MetroColor = keyof typeof METRO_COLORS;

/**
 * Nền màn hình Start của dashboard: xanh rêu rgb(19, 87, 69) pha ~22% trắng ở góc trên trái (chỗ tiêu đề),
 * nhạt dần về màu gốc ở góc dưới phải. Giống nhau ở giao diện sáng và tối. Chữ trên nền màu trắng — điểm sáng
 * nhất vẫn đạt tương phản ~4.8:1; pha thêm trắng nữa thì chữ trắng không còn đạt 4.5:1.
 */
export const METRO_BACKGROUND =
  'linear-gradient(160deg, rgb(72 125 111) 0%, rgb(46 106 90) 45%, rgb(19 87 69) 100%)';

/** Font kiểu Metro: Segoe UI có sẵn trên Windows (đủ dấu tiếng Việt); máy khác dùng Inter của app. */
export const METRO_FONT = '"Segoe UI", "Segoe UI Web (West European)", var(--font-sans), system-ui, sans-serif';

const fmt = (n: number) => n.toLocaleString('vi-VN');

/**
 * Lưới 4 cột đơn vị vuông. Từ màn hình `lg` (có sidebar, vùng nội dung ≥ ~730px) mỗi đơn vị cố định 7.5rem
 * (120px); nhỏ hơn thì 4 cột co giãn theo bề rộng nhóm (đơn vị tính bằng `cqw` của khung bao container)
 * — tránh tràn ngang ở máy tính bảng khi sidebar chiếm chỗ.
 */
const GRID_CLASS =
  'grid gap-2 [grid-auto-flow:dense] grid-cols-4 [grid-auto-rows:calc((100cqw-1.5rem)/4)] ' +
  'lg:[grid-template-columns:repeat(4,7.5rem)] lg:[grid-auto-rows:7.5rem]';

/** Nhóm tile có tiêu đề nét mảnh — như các nhóm trên màn hình Start của Windows 8. */
export function TileGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-full lg:w-auto [container-type:inline-size] lg:[container-type:normal]" aria-label={title}>
      <h2 className="text-xl font-light text-white mb-3">{title}</h2>
      <div className={GRID_CLASS}>{children}</div>
    </section>
  );
}

const SIZE_CLASS = {
  /** 1×1 */
  small: 'col-span-1 row-span-1',
  /** 2×2 */
  medium: 'col-span-2 row-span-2',
  /** 4×2 */
  wide: 'col-span-4 row-span-2',
} as const;

export type TileSize = keyof typeof SIZE_CLASS;

/**
 * Cỡ biểu tượng lớn giữa ô theo cỡ ô (`max-h-full` để không tràn khi ô thấp). Ô nhỏ trên điện thoại chỉ
 * rộng ~80px — không đủ chỗ cho số + biểu tượng + nhãn, nên ẩn biểu tượng để số và nhãn dễ đọc.
 */
const CENTER_ICON_CLASS: Record<TileSize, string> = {
  small: 'hidden sm:block sm:h-8 sm:w-8 lg:h-9 lg:w-9',
  medium: 'h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20',
  wide: 'h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20',
};

/**
 * Tile Metro: ô vuông màu đặc, phẳng (không bo góc, không bóng). Số to nét mảnh ở góc trên, nhãn ở góc dưới.
 * Như ô ứng dụng Windows 8, biểu tượng trắng nét mảnh nằm GIỮA ô — trừ khi ô có `content` lấp phần giữa
 * (cột mini, danh sách top 3), lúc đó biểu tượng thu nhỏ về góc dưới phải.
 * Là `<button>` — bấm để mở ngăn chi tiết. Khi bấm ô hơi lún (tắt nếu máy bật "giảm chuyển động").
 */
export function Tile({
  size = 'small',
  color,
  label,
  value,
  sub,
  icon: Icon,
  onClick,
  content,
  footer,
  ariaLabel,
}: {
  size?: TileSize;
  color: MetroColor;
  label: string;
  /** Số chính (định dạng vi-VN) hoặc chuỗi đã định dạng sẵn (vd "68%"). Bỏ trống cho tile chỉ có nội dung. */
  value?: number | string;
  /** Dòng phụ dưới số chính (chỉ hiện ở tile vừa/rộng). */
  sub?: string;
  icon?: LucideIcon;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Nội dung lấp phần giữa ô (cột mini, danh sách top 3…) — thay chỗ biểu tượng lớn. */
  content?: React.ReactNode;
  /** Nội dung nhỏ ngay trên nhãn (vd thanh tiến độ) — vẫn giữ biểu tượng lớn ở giữa. */
  footer?: React.ReactNode;
  ariaLabel?: string;
}) {
  const big = size !== 'small';
  const shown = typeof value === 'number' ? fmt(value) : value;
  const centerIcon = !!Icon && !content;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${label}${shown !== undefined ? `: ${shown}` : ''} — xem chi tiết`}
      title={label}
      className={`${SIZE_CLASS[size]} group relative flex min-w-0 flex-col overflow-hidden p-2 sm:p-2.5 lg:p-3 text-left text-white
        outline-none transition-transform duration-100 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100
        hover:ring-2 hover:ring-inset hover:ring-white/40
        focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
      style={{ background: METRO_COLORS[color] }}
    >
      {shown !== undefined && (
        <span
          className={`block shrink-0 font-light leading-none tabular-nums truncate ${
            big ? 'text-4xl sm:text-5xl' : 'text-lg sm:text-2xl lg:text-3xl'
          }`}
        >
          {shown}
        </span>
      )}
      {big && sub && <span className="mt-1.5 block shrink-0 text-xs sm:text-sm text-white/85 truncate">{sub}</span>}
      {content ? (
        <div className="mt-2 min-h-0 flex-1">{content}</div>
      ) : (
        <span className="flex min-h-0 flex-1 items-center justify-center py-1" aria-hidden>
          {/* Nét mảnh (1.5) cho giống biểu tượng phẳng của Windows 8. */}
          {centerIcon && Icon && <Icon strokeWidth={1.5} className={`max-h-full ${CENTER_ICON_CLASS[size]}`} />}
        </span>
      )}
      {footer && <div className="mb-1.5 shrink-0">{footer}</div>}
      <span className="flex shrink-0 items-end justify-between gap-2">
        <span
          className={`font-semibold leading-tight ${big ? 'text-sm' : 'text-[11px] sm:text-xs line-clamp-2'}`}
        >
          {label}
        </span>
        {Icon && !centerIcon && <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />}
      </span>
    </button>
  );
}

/** Ô giữ chỗ khi đang tải — phẳng, xám; nhấp nháy nhẹ (tắt nếu "giảm chuyển động"). */
export function TileSkeleton({ size = 'small' }: { size?: TileSize }) {
  return <div className={`${SIZE_CLASS[size]} bg-white/15 animate-pulse motion-reduce:animate-none`} aria-hidden />;
}

/** Biểu đồ cột mini màu trắng trong tile (vẽ bằng CSS, không dùng Chart.js) — kèm tên ngắn dưới mỗi cột. */
export function MiniBars({ items }: { items: { name: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-full min-h-[3rem] items-end gap-1.5" aria-hidden>
      {items.map((i) => (
        <div key={i.name} className="flex h-full min-w-0 flex-1 flex-col" title={`${i.name}: ${fmt(i.value)}`}>
          {/* Vùng cột riêng (flex-1, chừa chỗ phía trên cho con số) để đáy mọi cột thẳng hàng. */}
          <div className="min-h-0 flex-1 pt-4">
            <div className="relative h-full">
              <span
                className="absolute inset-x-0 text-[10px] leading-[14px] tabular-nums text-white/90"
                style={{ bottom: `calc(${(i.value / max) * 100}% + 2px)` }}
              >
                {fmt(i.value)}
              </span>
              <div
                className="absolute inset-x-0 bottom-0 bg-white/85"
                style={{ height: `max(2px, ${(i.value / max) * 100}%)` }}
              />
            </div>
          </div>
          <span className="mt-1 block h-3.5 truncate text-[10px] leading-[14px] text-white/85">{i.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Thanh tiến độ trắng trên nền tile. */
export function MiniProgress({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="h-2 w-full bg-white/25" aria-hidden>
      <div className="h-full bg-white" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Danh sách top N (tên — số) trong tile rộng. */
export function MiniList({ items, unit = 'nhà', emptyText = 'Chưa có dữ liệu' }: {
  items: { name: string; value: number }[];
  unit?: string;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-white/80">{emptyText}</p>;
  return (
    <ol className="space-y-1 sm:space-y-2 text-sm sm:text-base">
      {items.map((i, idx) => (
        <li key={`${i.name}-${idx}`} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            <span className="mr-1.5 text-white/70 tabular-nums">{idx + 1}.</span>
            {i.name}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {fmt(i.value)} <span className="font-normal text-white/80">{unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
