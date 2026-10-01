'use client';

import { useState } from 'react';
import type { AssignmentEvent } from '@tayninh/shared';
import { ASSIGNMENT_EVENT_LABELS, AssignmentEventAction } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { assignmentsApi } from '@/lib/surveys-api';

/** Màu chấm theo loại sự kiện — vấn đề/hỗ trợ nổi bật hơn các mốc trạng thái. */
const DOT: Record<AssignmentEventAction, string> = {
  [AssignmentEventAction.CREATED]: 'bg-fg-subtle',
  [AssignmentEventAction.STARTED]: 'bg-accent',
  [AssignmentEventAction.SUBMITTED]: 'bg-warn',
  [AssignmentEventAction.COMPLETED]: 'bg-ok',
  [AssignmentEventAction.REVISIT_REQUESTED]: 'bg-danger',
  [AssignmentEventAction.ISSUE_REPORTED]: 'bg-danger',
  [AssignmentEventAction.HELP_REQUESTED]: 'bg-warn',
  [AssignmentEventAction.HOUSE_RESURVEYED]: 'bg-ok',
  [AssignmentEventAction.REASSIGNED]: 'bg-info',
};

/**
 * Nhật ký (dòng thời gian) của 1 nhiệm vụ khảo sát — Phase 11 Đợt 2. Chỉ tải khi bấm mở
 * (GET /survey-assignments/:id) để danh sách nhiệm vụ không phải kéo theo toàn bộ sự kiện.
 */
export default function AssignmentTimeline({ assignmentId }: { assignmentId: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AssignmentEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await assignmentsApi.get(assignmentId);
      setEvents(detail.events ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được nhật ký');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-[11px] font-semibold text-accent hover:underline"
      >
        {open ? 'Ẩn nhật ký' : 'Nhật ký'}
      </button>
      {open && (
        <div className="mt-1.5 border-l-2 border-line pl-3 space-y-2">
          {loading && <p className="text-[11px] text-fg-subtle">Đang tải…</p>}
          {error && <p className="text-[11px] text-danger">{error}</p>}
          {!loading && !error && events?.length === 0 && (
            <p className="text-[11px] text-fg-subtle">Chưa có nhật ký</p>
          )}
          {events?.map((e) => (
            <div key={e.id} className="text-[11px]">
              <p className="flex items-center gap-1.5 font-semibold text-fg">
                <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${DOT[e.action] ?? 'bg-fg-subtle'}`} />
                {ASSIGNMENT_EVENT_LABELS[e.action] ?? e.action}
              </p>
              {e.note && (
                <p
                  className={
                    e.action === AssignmentEventAction.ISSUE_REPORTED ||
                    e.action === AssignmentEventAction.HELP_REQUESTED
                      ? 'text-danger'
                      : 'text-fg-muted'
                  }
                >
                  {e.note}
                </p>
              )}
              <p className="text-fg-subtle">
                {e.actor?.fullName ?? 'Hệ thống'} — {new Date(e.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
