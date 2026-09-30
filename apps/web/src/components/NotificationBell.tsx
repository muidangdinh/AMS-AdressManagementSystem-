'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@tayninh/shared';
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@tayninh/shared';
import { notificationsApi } from '@/lib/notifications-api';

const POLL_MS = 60_000;

const TYPE_DOT: Record<NotificationType, string> = {
  [NotificationType.ASSIGNED]: 'bg-blue-500',
  [NotificationType.STATUS_CHANGED]: 'bg-slate-400',
  [NotificationType.DUE_SOON]: 'bg-amber-500',
  [NotificationType.OVERDUE]: 'bg-rose-500',
  [NotificationType.REMINDER]: 'bg-amber-500',
  [NotificationType.ISSUE_REPORTED]: 'bg-rose-500',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** Chuông thông báo trên header: đếm chưa đọc (poll 60s + khi tab được focus), dropdown 20 thông báo mới nhất. */
export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setCount((await notificationsApi.unreadCount()).count);
    } catch {
      // Lỗi mạng tạm thời — giữ số cũ, lần poll sau thử lại.
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCount]);

  // Đóng dropdown khi bấm ra ngoài hoặc nhấn Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    try {
      setItems(await notificationsApi.list({ limit: 20 }));
      refreshCount();
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenItem(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setCount((c) => Math.max(0, c - 1));
      notificationsApi.markRead(n.id).catch(() => refreshCount());
    }
    if (n.link) router.push(n.link);
  }

  async function handleReadAll() {
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? now })));
      setCount(0);
    } catch {
      refreshCount();
    }
  }

  return (
    <div ref={rootRef} className="relative print:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-label={count > 0 ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors active:scale-95"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-[10px] font-bold leading-[18px] text-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <p className="text-sm font-bold">Thông báo</p>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={count === 0}
              className="text-xs font-semibold text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <p className="p-4 text-sm text-slate-400">Đang tải…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">Chưa có thông báo nào</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors ${
                    n.readAt ? '' : 'bg-blue-50/60'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : TYPE_DOT[n.type]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-slate-400 mt-1">
                      {NOTIFICATION_TYPE_LABELS[n.type]}
                      {n.actor ? ` • ${n.actor.fullName}` : ''} • {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
