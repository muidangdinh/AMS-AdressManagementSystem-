/**
 * Các mảnh UI dùng chung, tái sử dụng giữa các trang /houses/* — theo design system
 * Cyber-Tech / Geospatial (UI.md). Màu lấy từ token theme (bg-surface, text-fg, border-line,
 * accent/ok/warn/danger/info — xem globals.css) nên tự đúng ở cả theme tối lẫn sáng.
 */
import type React from 'react';

/** Class dùng chung cho input/select/textarea trong mọi form của app. */
export const FIELD_CLASS =
  'w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface-2/60 text-fg placeholder:text-fg-subtle focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition';

/** 1 nhóm field trong form — thẻ bo góc + tiêu đề nhỏ, tách các field liên quan thành khối. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-line p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-accent uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

/** 1 field có label — dùng cùng FIELD_CLASS cho input/select/textarea bên trong. */
export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Hình minh hoạ "chưa có dữ liệu" kiểu GIS: lưới toạ độ + ghim định vị. */
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 120 80" className="w-28 h-auto text-accent" fill="none" aria-hidden>
      <defs>
        <pattern id="empty-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x="4" y="8" width="112" height="64" rx="8" fill="url(#empty-grid)" stroke="currentColor" strokeOpacity="0.3" />
      <path d="M14 58 L40 40 L62 50 L88 26 L106 34" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="4 3" />
      <circle cx="88" cy="26" r="9" fill="currentColor" fillOpacity="0.12" />
      <path d="M88 15a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor" />
    </svg>
  );
}

/** Khối rỗng chuẩn hoá — mặc định hình minh hoạ kiểu GIS; truyền `icon` (emoji) để dùng kiểu cũ. */
export function EmptyState({ icon, text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-fg-subtle">
      {icon ? <span className="text-2xl">{icon}</span> : <EmptyIllustration />}
      <p className="text-sm">{text}</p>
    </div>
  );
}

/** Spinner nhỏ dùng trong nút submit đang loading, đồng bộ style toàn app. */
export function ButtonSpinner({ light }: { light?: boolean }) {
  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin ${
        light ? 'border-white/40 border-t-white' : 'border-line border-t-accent'
      }`}
    />
  );
}

/** Tiêu đề trang chuẩn — dùng ở đầu mỗi trang list (cases/surveys/numbering/addresses). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-lg font-bold text-fg">{title}</h1>
        {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** Card kính mờ chuẩn (UI.md). */
export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`glass ${className}`}>{children}</div>;
}

export type ButtonVariant = 'primary' | 'success' | 'ghost' | 'danger';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-gradient text-white shadow-glow-accent hover:brightness-110',
  success: 'bg-ok text-white hover:brightness-110 shadow-glow-ok',
  ghost: 'bg-surface-2/60 text-fg border border-line hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110',
};

/** Nút chuẩn: primary = gradient xanh điện, success = xanh cyber (vd Xuất Excel). */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${BUTTON_VARIANT[variant]} ${className}`}
    />
  );
}

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral';

const TONE: Record<StatusTone, { badge: string; dot: string }> = {
  ok: { badge: 'bg-ok/10 text-ok border-ok/30', dot: 'bg-ok shadow-glow-ok' },
  warn: { badge: 'bg-warn/10 text-warn border-warn/30', dot: 'bg-warn shadow-glow-warn' },
  danger: { badge: 'bg-danger/10 text-danger border-danger/30', dot: 'bg-danger shadow-glow-danger' },
  info: { badge: 'bg-info/10 text-info border-info/30', dot: 'bg-info shadow-glow-info' },
  accent: { badge: 'bg-accent/10 text-accent border-accent/30', dot: 'bg-accent shadow-glow-accent' },
  neutral: { badge: 'bg-surface-2 text-fg-muted border-line', dot: 'bg-fg-subtle' },
};

/** Nhãn trạng thái có chấm phát sáng — ok=Đã cấp biển/QR, warn=Chờ duyệt, danger=Cần hiệu chỉnh, info=Đề xuất. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[tone].badge}`}
    >
      <span className={`status-dot !h-1.5 !w-1.5 ${TONE[tone].dot}`} />
      {children}
    </span>
  );
}

/** Ô số liệu nhỏ trên thanh KPI của header. */
export function KpiPill({ tone, label, value }: { tone: StatusTone; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line/80 bg-surface/40 px-2.5 py-1">
      <span className={`status-dot ${TONE[tone].dot}`} />
      <span className="text-[11px] text-fg-muted whitespace-nowrap">{label}</span>
      <span className="text-sm font-bold text-fg tabular-nums">{value}</span>
    </div>
  );
}

/** Công tắc chuyển thay checkbox (ma trận phân quyền…). */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Nhãn cho trình đọc màn hình. */
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-300 disabled:opacity-50 ${
        checked ? 'bg-accent/80 border-accent shadow-glow-accent' : 'bg-surface-2 border-line'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300 ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

/** Bộ chọn dạng phân đoạn (vd [Bảng | Bản đồ]) — cũng dùng làm tab. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (next: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-2/50 p-0.5" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-md font-semibold transition-all duration-300 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${active ? 'bg-accent/15 text-accent shadow-glow-accent' : 'text-fg-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
