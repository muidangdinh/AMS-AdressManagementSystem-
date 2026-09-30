'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { HouseCase, HouseSummary, PaginatedResult } from '@tayninh/shared';
import {
  CASE_REQUEST_TYPE_LABELS,
  CASE_STATUS_LABELS,
  CaseStatus,
  NotificationEntity,
  PERMISSIONS,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { casesApi } from '@/lib/cases-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS } from '@/components/ui';
import RemindButton from '@/components/RemindButton';
import { formatDueDate, isOverdue } from '@/lib/deadline';

const STATUS_BADGE: Record<CaseStatus, string> = {
  [CaseStatus.RECEIVED]: 'bg-slate-100 text-slate-700 border-slate-200',
  [CaseStatus.ASSIGNED]: 'bg-slate-100 text-slate-700 border-slate-200',
  [CaseStatus.REVIEWING]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CaseStatus.SURVEYING]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CaseStatus.NUMBERING]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CaseStatus.APPROVED]: 'bg-amber-100 text-amber-800 border-amber-200',
  [CaseStatus.PLATE_ISSUED]: 'bg-amber-100 text-amber-800 border-amber-200',
  [CaseStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [CaseStatus.REJECTED]: 'bg-rose-100 text-rose-800 border-rose-200',
};

const NEXT_STEP_LABEL: Partial<Record<CaseStatus, string>> = {
  [CaseStatus.RECEIVED]: 'Chuyển sang: Đã phân công',
  [CaseStatus.ASSIGNED]: 'Chuyển sang: Đang thẩm định',
  [CaseStatus.REVIEWING]: 'Chuyển sang: Đang khảo sát',
  [CaseStatus.SURVEYING]: 'Chuyển sang: Đang lập phương án',
  [CaseStatus.NUMBERING]: 'Chuyển sang: Đã duyệt / cấp số',
  [CaseStatus.APPROVED]: 'Chuyển sang: Đã cấp biển',
  [CaseStatus.PLATE_ISSUED]: 'Chuyển sang: Đã trả kết quả',
};

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const { user, hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.CASE_MANAGE);

  const [houseCase, setHouseCase] = useState<HouseCase | null>(null);
  const [staff, setStaff] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHouseCase(await casesApi.get(caseId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    casesApi.listStaff().then(setStaff).catch(() => {});
  }, []);

  async function handleAssign(assignedToId: string) {
    if (!assignedToId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await casesApi.assign(caseId, assignedToId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không phân công được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDueDate(value: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      await casesApi.update(caseId, { dueDate: value || null });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không cập nhật được hạn xử lý');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAdvance() {
    setActionLoading(true);
    setActionError(null);
    try {
      await casesApi.advance(caseId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không chuyển bước được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    const reason = prompt('Lý do từ chối hồ sơ:');
    if (!reason) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await casesApi.reject(caseId, reason);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không từ chối được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopen() {
    setActionLoading(true);
    setActionError(null);
    try {
      await casesApi.reopen(caseId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không mở lại được');
    } finally {
      setActionLoading(false);
    }
  }

  // ---- Liên kết hồ sơ nhà ----
  const [houseQuery, setHouseQuery] = useState('');
  const [houseResults, setHouseResults] = useState<HouseSummary[]>([]);
  const [searchingHouse, setSearchingHouse] = useState(false);

  async function handleSearchHouse() {
    setSearchingHouse(true);
    try {
      const res = await apiFetch<PaginatedResult<HouseSummary>>(
        `/api/houses?pageSize=20&search=${encodeURIComponent(houseQuery)}`,
      );
      setHouseResults(res.items);
    } catch {
      setHouseResults([]);
    } finally {
      setSearchingHouse(false);
    }
  }

  async function handleLinkHouse(houseId: string) {
    setActionError(null);
    try {
      await casesApi.linkHouse(caseId, houseId);
      setHouseResults([]);
      setHouseQuery('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không liên kết được');
    }
  }

  // ---- Ghi chú ----
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    setActionError(null);
    try {
      await casesApi.addNote(caseId, noteText.trim());
      setNoteText('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không ghi chú được');
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-slate-400">
        <ButtonSpinner /> Đang tải…
      </div>
    );
  }
  if (error || !houseCase) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Không tìm thấy hồ sơ'}</div>;
  }

  const isTerminal = houseCase.status === CaseStatus.COMPLETED || houseCase.status === CaseStatus.REJECTED;

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <Link href="/houses/cases" className="text-sm text-blue-600 hover:underline font-semibold">
        ← Danh sách hồ sơ
      </Link>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
          {actionError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <span
              className={`inline-block mb-2 px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[houseCase.status]}`}
            >
              {CASE_STATUS_LABELS[houseCase.status]}
            </span>
            <h2 className="text-lg font-bold text-slate-900 font-mono">{houseCase.caseNumber}</h2>
            <p className="text-sm text-slate-600 mt-1">
              {houseCase.applicantName}
              {houseCase.applicantPhone ? ` • ${houseCase.applicantPhone}` : ''} •{' '}
              {CASE_REQUEST_TYPE_LABELS[houseCase.requestType]}
            </p>
            {houseCase.description && <p className="text-sm text-slate-500 mt-1">{houseCase.description}</p>}
          </div>
        </div>

        {houseCase.status === CaseStatus.REJECTED && houseCase.rejectedReason && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm mt-3">
            <strong>Lý do từ chối:</strong> {houseCase.rejectedReason}
          </div>
        )}

        {houseCase.house ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm mt-3">
            <strong>Hồ sơ số nhà liên kết:</strong> Số {houseCase.house.houseNumber} {houseCase.house.street}
            {', '}
            {houseCase.house.ward}
          </div>
        ) : (
          canEdit &&
          !isTerminal && (
            <div className="border border-slate-200 rounded-xl p-3 mt-3 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase">Liên kết hồ sơ số nhà</p>
              <div className="flex gap-2">
                <input
                  value={houseQuery}
                  onChange={(e) => setHouseQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchHouse()}
                  placeholder="Tìm số nhà/chủ hộ..."
                  className={`flex-1 ${FIELD_CLASS}`}
                />
                <button
                  onClick={handleSearchHouse}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition"
                >
                  Tìm
                </button>
              </div>
              {searchingHouse && (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <ButtonSpinner /> Đang tìm…
                </p>
              )}
              {houseResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {houseResults.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleLinkHouse(h.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <span>
                        Số {h.houseNumber} {h.street} — {h.ownerName}
                      </span>
                      <span className="text-xs text-blue-600 font-semibold">+ Liên kết</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {canEdit && !isTerminal && (
          <div className="flex gap-2 items-end mt-3 flex-wrap">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Phân công cán bộ xử lý
              </label>
              <select
                value={houseCase.assignedToId ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="" disabled>
                  -- Chọn cán bộ --
                </option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hạn xử lý</label>
              <input
                key={houseCase.dueDate ?? 'none'}
                type="date"
                defaultValue={houseCase.dueDate?.slice(0, 10) ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (houseCase.dueDate?.slice(0, 10) ?? '')) handleDueDate(e.target.value);
                }}
                disabled={actionLoading}
                className={FIELD_CLASS}
              />
            </div>
            {houseCase.assignedToId && (
              <RemindButton
                entityType={NotificationEntity.HOUSE_CASE}
                entityId={houseCase.id}
                className="border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60 px-4 py-2 rounded-xl text-sm font-semibold transition"
              />
            )}
          </div>
        )}

        {houseCase.dueDate && (
          <p
            className={`text-xs font-semibold mt-3 ${
              !isTerminal && isOverdue(houseCase.dueDate) ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            Hạn xử lý: {formatDueDate(houseCase.dueDate)}
            {!isTerminal && isOverdue(houseCase.dueDate) && ' — ĐÃ QUÁ HẠN'}
          </p>
        )}

        <p className="text-xs text-slate-400 mt-3">
          Tạo bởi {houseCase.createdBy?.fullName ?? '—'} lúc{' '}
          {new Date(houseCase.createdAt).toLocaleString('vi-VN')}
          {houseCase.assignedTo && ` • Đang xử lý bởi ${houseCase.assignedTo.fullName}`}
        </p>
      </div>

      {canEdit && (
        <div className="flex gap-2 flex-wrap">
          {!isTerminal && NEXT_STEP_LABEL[houseCase.status] && (
            <button
              onClick={handleAdvance}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
            >
              {actionLoading && <ButtonSpinner light />}
              {NEXT_STEP_LABEL[houseCase.status]}
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-60 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Từ chối hồ sơ
            </button>
          )}
          {houseCase.status === CaseStatus.REJECTED && (
            <button
              onClick={handleReopen}
              disabled={actionLoading}
              className="border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60 px-4 py-2 rounded-xl text-sm font-semibold transition"
            >
              Mở lại hồ sơ
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">+ Thêm ghi chú xử lý</p>
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Ghi chú quá trình xử lý..."
              className={`flex-1 ${FIELD_CLASS}`}
            />
            <button
              onClick={handleAddNote}
              disabled={savingNote || !noteText.trim()}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              {savingNote && <ButtonSpinner light />}
              Ghi
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
        <h3 className="font-bold text-sm text-slate-900 mb-3">Lịch sử xử lý</h3>
        {(houseCase.events ?? []).length === 0 ? (
          <EmptyState icon="🕓" text="Chưa có lịch sử xử lý" />
        ) : (
          <div className="space-y-3">
            {(houseCase.events ?? []).map((e) => (
              <div key={e.id} className="border-b border-slate-100 pb-2 last:border-0 text-sm">
                <p className="text-slate-700">
                  {e.note ?? (e.toStatus ? `Chuyển sang: ${CASE_STATUS_LABELS[e.toStatus]}` : e.action)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {e.actor?.fullName ?? 'Hệ thống'} — {new Date(e.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
