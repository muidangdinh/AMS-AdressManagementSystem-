/**
 * Các mảnh UI dùng chung nhỏ, tái sử dụng giữa các trang /houses/* để đồng
 * bộ giao diện (spacing/bo góc/phân nhóm field) mà không cần 1 design system
 * lớn — giữ nguyên bảng màu xanh dương/trắng đang dùng.
 */
import type React from 'react';

/** Class dùng chung cho input/select/textarea trong mọi form của app. */
export const FIELD_CLASS =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition';

/** 1 nhóm field trong form — thẻ bo góc + tiêu đề nhỏ, tách các field liên quan thành khối. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">{title}</h4>
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
      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/** Khối rỗng chuẩn hoá — icon + dòng chữ nhạt, thay cho <p>Không có dữ liệu</p> rải rác. */
export function EmptyState({ icon = '📭', text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
      <span className="text-2xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

/** Spinner nhỏ dùng trong nút submit đang loading, đồng bộ style toàn app. */
export function ButtonSpinner({ light }: { light?: boolean }) {
  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin ${
        light ? 'border-white/40 border-t-white' : 'border-slate-300 border-t-blue-600'
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
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
