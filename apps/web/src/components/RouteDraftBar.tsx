'use client';

import { useEffect, useRef } from 'react';
import { formatLength } from '@/lib/routing';
import { ButtonSpinner } from '@/components/ui';
import type { RouteDraft } from '@/components/route-map-types';

/**
 * Thanh trạng thái và nút thao tác khi chấm tuyến, dùng chung cho kho tuyến và panel khảo sát:
 * báo độ dài, "Chấm lại", "Hủy" (hoặc Esc) và nút lưu. Phải đặt bên trong <form> có onSubmit lưu tuyến.
 */
export default function RouteDraftBar({
  draft,
  geometryLocked = false,
  saving,
  canSave,
  saveLabel,
  onReset,
  onCancel,
}: {
  draft: RouteDraft;
  /** Đang sửa thông tin tuyến đã được giao: đường đi giữ nguyên, không chấm lại. */
  geometryLocked?: boolean;
  saving: boolean;
  canSave: boolean;
  saveLabel: string;
  onReset: () => void;
  onCancel: () => void;
}) {
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-xs text-fg-muted mr-auto">
        {geometryLocked ? (
          'Tuyến đã được giao nên đường đi được giữ nguyên. Cần đổi đường đi thì dùng "Nhân bản".'
        ) : !draft.start || !draft.end ? (
          'Chấm điểm đầu (A) rồi điểm cuối (B) trên bản đồ.'
        ) : draft.computing ? (
          'Đang tìm tuyến bám đường…'
        ) : draft.result ? (
          <>
            Độ dài <b className="text-fg">{formatLength(draft.result.lengthM)}</b>
            {!draft.result.snapped && (
              <span className="text-warn"> • Không tìm được đường thực tế — dùng đường thẳng</span>
            )}
          </>
        ) : null}
      </p>
      {!geometryLocked && (
        <button
          type="button"
          onClick={onReset}
          disabled={!draft.start}
          className="text-xs font-semibold text-fg-muted hover:bg-surface-2 disabled:opacity-40 px-3 py-1.5 rounded-lg"
        >
          Chấm lại
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="text-xs font-semibold text-fg-muted hover:bg-surface-2 px-3 py-1.5 rounded-lg"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={!canSave}
        className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
      >
        {saving && <ButtonSpinner light />}
        {saveLabel}
      </button>
    </div>
  );
}
