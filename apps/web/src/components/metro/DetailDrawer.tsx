'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { METRO_COLORS, METRO_FONT, type MetroColor } from './MetroTiles';

/**
 * Ngăn chi tiết trượt từ phải (kiểu "charm"/flyout của Windows 8) — mở khi bấm 1 tile trên dashboard.
 * Phẳng, góc vuông; dải đầu cùng màu nhóm của tile. Mở thì focus vào nút đóng; đóng (Esc do trang cha
 * xử lý, nút X, bấm nền mờ) thì trang cha trả focus về tile đã bấm.
 */
export function DetailDrawer({
  title,
  subtitle,
  color,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  color: MetroColor;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, [title]);

  return (
    <div className="fixed inset-0 z-[900]" style={{ fontFamily: METRO_FONT }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full w-[min(560px,100vw)] flex-col bg-canvas
          animate-drawer-in motion-reduce:animate-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4 text-white" style={{ background: METRO_COLORS[color] }}>
          <div className="min-w-0">
            <h2 className="text-2xl font-light leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-white/85">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 p-1.5 text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
