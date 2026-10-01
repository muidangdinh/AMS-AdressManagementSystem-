'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HouseCase } from '@tayninh/shared';
import {
  CASE_REQUEST_TYPE_LABELS,
  CASE_STATUS_LABELS,
  CaseStatus,
  PERMISSIONS,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { casesApi } from '@/lib/cases-api';
import { Plus } from 'lucide-react';
import {
  Button,
  ButtonSpinner,
  EmptyState,
  FIELD_CLASS,
  FormField,
  FormSection,
  PageHeader,
  SegmentedControl,
} from '@/components/ui';

/** Chip lọc nhanh (UI.md): Đang xử lý = chưa hoàn tất/từ chối. Lọc ở client trên danh sách đã tải. */
type QuickFilter = 'all' | 'open' | 'done';
const CLOSED_STATUSES: CaseStatus[] = [CaseStatus.COMPLETED, CaseStatus.REJECTED];
import { isOverdue } from '@/lib/deadline';

const STATUS_BADGE: Record<CaseStatus, string> = {
  [CaseStatus.RECEIVED]: 'bg-surface-2 text-fg border-line',
  [CaseStatus.ASSIGNED]: 'bg-surface-2 text-fg border-line',
  [CaseStatus.REVIEWING]: 'bg-accent/15 text-accent border-accent/30',
  [CaseStatus.SURVEYING]: 'bg-accent/15 text-accent border-accent/30',
  [CaseStatus.NUMBERING]: 'bg-accent/15 text-accent border-accent/30',
  [CaseStatus.APPROVED]: 'bg-warn/15 text-warn border-warn/30',
  [CaseStatus.PLATE_ISSUED]: 'bg-warn/15 text-warn border-warn/30',
  [CaseStatus.COMPLETED]: 'bg-ok/15 text-ok border-ok/30',
  [CaseStatus.REJECTED]: 'bg-danger/15 text-danger border-danger/30',
};

/** Danh sách hồ sơ (Phase 10 — IX. Quản lý hồ sơ – quy trình). */
export default function CasesPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canEdit = hasPermission(PERMISSIONS.CASE_MANAGE);

  const [cases, setCases] = useState<HouseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCases(await casesApi.list({ status: statusFilter || undefined, search: search || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ applicantName: '', applicantPhone: '', description: '', dueDate: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const c = await casesApi.create({
        applicantName: form.applicantName,
        applicantPhone: form.applicantPhone || undefined,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
      });
      router.push(`/houses/cases/${c.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Không tạo được hồ sơ');
    } finally {
      setCreating(false);
    }
  }

  const visibleCases =
    quickFilter === 'all'
      ? cases
      : cases.filter((c) =>
          quickFilter === 'done' ? c.status === CaseStatus.COMPLETED : !CLOSED_STATUSES.includes(c.status),
        );

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Hồ sơ – Quy trình"
        subtitle="Tiếp nhận yêu cầu cấp số nhà, theo dõi tiến độ xử lý từ tiếp nhận đến trả kết quả."
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Tiếp nhận hồ sơ
            </Button>
          )
        }
      />

      <div className="glass p-3 flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Lọc nhanh</label>
          <SegmentedControl
            value={quickFilter}
            onChange={setQuickFilter}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'open', label: 'Đang xử lý' },
              { value: 'done', label: 'Đã hoàn thành' },
            ]}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Tìm kiếm</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Số hồ sơ hoặc tên người yêu cầu..."
            className={FIELD_CLASS}
          />
        </div>
        <div className="w-56">
          <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | '')}
            className={FIELD_CLASS}
          >
            <option value="">-- Tất cả --</option>
            {Object.values(CaseStatus).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="glass overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-fg-muted text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Số hồ sơ</th>
              <th className="text-left px-4 py-3">Người yêu cầu</th>
              <th className="text-left px-4 py-3">Loại</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-left px-4 py-3">Cán bộ xử lý</th>
              <th className="text-left px-4 py-3">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <tr>
                <td colSpan={6} className="py-8">
                  <div className="flex items-center justify-center gap-2 text-fg-subtle text-sm">
                    <ButtonSpinner /> Đang tải…
                  </div>
                </td>
              </tr>
            )}
            {!loading && visibleCases.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState text="Chưa có hồ sơ nào" />
                </td>
              </tr>
            )}
            {!loading &&
              visibleCases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/houses/cases/${c.id}`)}
                  className="cursor-pointer hover:bg-accent/10 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-bold text-fg">{c.caseNumber}
                    {isOverdue(c.dueDate) && c.status !== CaseStatus.COMPLETED && c.status !== CaseStatus.REJECTED && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger/15 text-danger border border-danger/30 font-sans">
                        Quá hạn
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.applicantName}</td>
                  <td className="px-4 py-3 text-xs">{CASE_REQUEST_TYPE_LABELS[c.requestType]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[c.status]}`}
                    >
                      {CASE_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">{c.assignedTo?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-surface rounded-2xl shadow-soft w-full max-w-lg overflow-hidden">
            <div className="bg-shell text-fg border-b border-line px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Tiếp nhận hồ sơ mới</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2 transition"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4 bg-surface-2">
              {createError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">
                  {createError}
                </div>
              )}
              <FormSection title="Thông tin người yêu cầu">
                <FormField label="Tên người yêu cầu" required>
                  <input
                    required
                    value={form.applicantName}
                    onChange={(e) => setForm((f) => ({ ...f, applicantName: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Số điện thoại">
                  <input
                    value={form.applicantPhone}
                    onChange={(e) => setForm((f) => ({ ...f, applicantPhone: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Mô tả yêu cầu / địa chỉ dự kiến">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Hạn xử lý">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </FormField>
              </FormSection>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-line bg-surface text-fg-muted hover:bg-surface-2 transition"
                >
                  Hủy
                </button>
                <button
                  disabled={creating}
                  className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {creating && <ButtonSpinner light />}
                  {creating ? 'Đang tạo…' : 'Tiếp nhận & mở hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
