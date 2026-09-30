'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AssignmentHouse, SurveyAssignment } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { assignmentsApi } from '@/lib/surveys-api';
import { ButtonSpinner, FIELD_CLASS } from '@/components/ui';

/**
 * Phase 11 Đợt 2b — "Yêu cầu khảo sát lại" có chọn TỪNG NHÀ. Nhà được tick sẽ bị đánh dấu cần sửa (kèm lý do
 * riêng); cán bộ khảo sát chỉ sửa được đúng các nhà này thay vì phải tạo nhà mới trùng. Không tick nhà nào =
 * khảo sát lại chung (cán bộ được thêm nhà còn thiếu như trước).
 */
export default function RevisitModal({
  assignment,
  zoneName,
  onClose,
  onDone,
}: {
  assignment: SurveyAssignment;
  /**
   * Tên phân vùng do trang truyền vào — nhiệm vụ lấy từ chi tiết đợt (`zones[].assignments[]`) là bản LỒNG nên
   * KHÔNG có trường `zone`; không được đọc `assignment.zone`.
   */
  zoneName: string;
  onClose: () => void;
  /** Gọi sau khi gửi yêu cầu thành công (để trang tải lại danh sách). */
  onDone: () => void;
}) {
  const [houses, setHouses] = useState<AssignmentHouse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  // houseId -> lý do riêng; có mặt trong map = đang được tick.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    assignmentsApi
      .listHouses(assignment.id)
      .then((list) => {
        if (!cancelled) setHouses(list);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh sách nhà');
      });
    return () => {
      cancelled = true;
    };
  }, [assignment.id]);

  const pickedCount = useMemo(() => Object.keys(picked).length, [picked]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });
  }

  function toggleAll() {
    if (!houses) return;
    setPicked(pickedCount === houses.length ? {} : Object.fromEntries(houses.map((h) => [h.id, picked[h.id] ?? ''])));
  }

  async function handleSubmit() {
    if (!note.trim()) {
      setError('Vui lòng nhập lý do chung');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await assignmentsApi.requestRevisit(assignment.id, {
        reviewNote: note.trim(),
        houses: Object.entries(picked).map(([houseId, reason]) => ({
          houseId,
          reason: reason.trim() || undefined,
        })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
      <div className="bg-white rounded-2xl shadow-soft w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base">Yêu cầu khảo sát lại</h3>
            <p className="text-xs text-slate-400 truncate">
              {zoneName} — {assignment.assignee.fullName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 bg-slate-50 overflow-y-auto">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
              Lý do chung <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="VD: Thiếu ảnh mặt tiền, sai số thửa…"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Nhà cần khảo sát lại {houses ? `(${pickedCount}/${houses.length})` : ''}
              </p>
              {houses && houses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {pickedCount === houses.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Chọn nhà có lỗi để cán bộ sửa <strong>đúng nhà đó</strong>. Không chọn nhà nào = khảo sát lại chung
              (cán bộ được thêm nhà còn thiếu).
            </p>

            {!houses && !loadError && (
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <ButtonSpinner /> Đang tải danh sách nhà…
              </p>
            )}
            {loadError && <p className="text-xs text-rose-600">{loadError}</p>}
            {houses && houses.length === 0 && (
              <p className="text-xs text-slate-400">Nhiệm vụ này chưa có nhà nào được khảo sát.</p>
            )}
            {houses && houses.length > 0 && (
              <div className="border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {houses.map((h) => {
                  const checked = h.id in picked;
                  return (
                    <div key={h.id} className="px-3 py-2">
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(h.id)}
                          className="mt-1 accent-blue-600"
                        />
                        <span className="min-w-0">
                          <span className="font-semibold text-slate-800">
                            Số {h.houseNumber} {h.street}
                          </span>
                          <span className="text-slate-500"> — {h.ownerName}</span>
                          {h.revisitReason && (
                            <span className="block text-[11px] text-rose-600">
                              Đang chờ sửa: {h.revisitReason}
                            </span>
                          )}
                        </span>
                      </label>
                      {checked && (
                        <input
                          value={picked[h.id]}
                          onChange={(e) => setPicked((prev) => ({ ...prev, [h.id]: e.target.value }))}
                          placeholder="Lý do riêng (bỏ trống = dùng lý do chung)"
                          className={`${FIELD_CLASS} mt-1.5 text-xs`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !note.trim()}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
          >
            {submitting && <ButtonSpinner light />}
            {pickedCount > 0 ? `Gửi yêu cầu (${pickedCount} nhà)` : 'Gửi yêu cầu (chung)'}
          </button>
        </div>
      </div>
    </div>
  );
}
