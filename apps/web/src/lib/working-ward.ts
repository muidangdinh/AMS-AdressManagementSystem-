'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * TN-03 — Ngữ cảnh "xã đang làm việc" trên web (góp ý khách hàng 11/09/2026
 * — hệ thống phục vụ NHIỀU xã, có cán bộ phụ trách nhiều xã). Web chỉ có 2
 * lớp (không có khái niệm "nhiệm vụ khảo sát đang chọn" như mobile — đó là
 * lớp 1, chỉ áp dụng ở `apps/mobile/src/lib/workingWard.ts`):
 *   - Xã người dùng TỰ CHỌN, lưu localStorage, nhớ lại lần sau.
 *   - Không có gì -> null, giao diện hiểu là "Toàn tỉnh".
 * Lớp "xã công tác gán theo tài khoản" CHƯA làm ở đợt này (xem BACKLOG.md TN-25).
 */
export interface WorkingWard {
  id: string;
  name: string;
}

const MANUAL_WARD_KEY = 'tayninh_manual_ward';
/** Sự kiện tùy biến để mọi component trên trang đồng bộ khi xã đổi ở nơi khác (vd header). */
const CHANGE_EVENT = 'tayninh:working-ward-change';

export function getManualWard(): WorkingWard | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(MANUAL_WARD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkingWard;
  } catch {
    return null;
  }
}

export function setManualWard(ward: WorkingWard | null): void {
  if (ward) window.localStorage.setItem(MANUAL_WARD_KEY, JSON.stringify(ward));
  else window.localStorage.removeItem(MANUAL_WARD_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Hook React đọc + theo dõi ngữ cảnh xã đang làm việc (đồng bộ giữa các component qua sự kiện tuỳ biến). */
export function useWorkingWard() {
  const [ward, setWardState] = useState<WorkingWard | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWardState(getManualWard());
    setReady(true);
    const handler = () => setWardState(getManualWard());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const chooseWard = useCallback((next: WorkingWard | null) => {
    setManualWard(next);
  }, []);

  return { ward, ready, chooseWard };
}
