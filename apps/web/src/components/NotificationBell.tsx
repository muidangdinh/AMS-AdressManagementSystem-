'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@tayninh/shared';
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@tayninh/shared';
import { Bell } from 'lucide-react';
import { notificationsApi } from '@/lib/notifications-api';

const POLL_MS = 60_000;

const TYPE_DOT: Record<NotificationType, string> = {
  [NotificationType.ASSIGNED]: 'bg-accent',
  [NotificationType.STATUS_CHANGED]: 'bg-fg-subtle',
  [NotificationType.DUE_SOON]: 'bg-warn',
  [NotificationType.OVERDUE]: 'bg-danger',
  [NotificationType.REMINDER]: 'bg-warn',
  [NotificationType.ISSUE_REPORTED]: 'bg-danger',
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
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2/50 hover:bg-surface-2 border border-line text-fg-muted hover:text-accent transition-all duration-300 active:scale-95"
      >
        <Bell className="w-[18px] h-[18px]" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white shadow-glow-danger text-[10px] font-bold leading-[18px] text-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-sm glass !bg-surface/95 text-fg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <p className="text-sm font-bold">Thông báo</p>
            <button
              type="button"
              onClick={handleReadAll}
              disabled={count === 0}
              className="text-xs font-semibold text-accent hover:underline disabled:text-fg-subtle disabled:no-underline"
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-line">
            {loading ? (
              <p className="p-4 text-sm text-fg-subtle">Đang tải…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-fg-subtle text-center">Chưa có thông báo nào</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-surface-2/60 transition-colors ${
                    n.readAt ? '' : 'bg-accent/5'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : TYPE_DOT[n.type]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? 'text-fg-muted' : 'font-semibold text-fg'}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="block text-xs text-fg-muted mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-fg-subtle mt-1">
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
