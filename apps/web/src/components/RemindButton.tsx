'use client';

import { useState } from 'react';
import type { NotificationEntity } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { notificationsApi } from '@/lib/notifications-api';

/**
 * Nút "Nhắc" — người giao việc gửi nhắc nhở ngay cho người nhận (BR-76: tối đa 1 lần / 15 phút
 * cho cùng một nhiệm vụ, API trả 409 nếu nhắc dồn dập). Chỉ hiển thị cho ADMIN/CADASTRAL ở nơi dùng.
 */
export default function RemindButton({
  entityType,
  entityId,
  className,
}: {
  entityType: NotificationEntity;
  entityId: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleClick() {
    const message = prompt('Lời nhắn kèm theo (có thể để trống):');
    if (message === null) return;
    setBusy(true);
    try {
      await notificationsApi.remind({ entityType, entityId, message: message.trim() || undefined });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không gửi được nhắc nhở');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || sent}
      className={
        className ??
        'border border-warn/30 text-warn hover:bg-warn/10 disabled:opacity-60 text-xs font-semibold px-2.5 py-1 rounded-lg transition'
      }
    >
      {sent ? 'Đã nhắc ✓' : busy ? 'Đang gửi…' : 'Nhắc'}
    </button>
  );
}
