'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HouseCase } from '@tayninh/shared';
import {
  CASE_REQUEST_TYPE_LABELS,
  CASE_STATUS_LABELS,
  CaseStatus,
  EDITOR_ROLES,
  UserRole,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { casesApi } from '@/lib/cases-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, FormSection, PageHeader } from '@/components/ui';
import { isOverdue } from '@/lib/deadline';

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

/** Danh sách hồ sơ (Phase 10 — IX. Quản lý hồ sơ – quy trình). */
export default function CasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canEdit = !!user && EDITOR_ROLES.includes(user.role as UserRole);

  const [cases, setCases] = useState<HouseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');

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

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Hồ sơ – Quy trình"
        subtitle="Tiếp nhận yêu cầu cấp số nhà, theo dõi tiến độ xử lý từ tiếp nhận đến trả kết quả."
        actions={
          canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
            >
              + Tiếp nhận hồ sơ
            </button>
          )
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3 items-end shadow-card flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tìm kiếm</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Số hồ sơ hoặc tên người yêu cầu..."
            className={FIELD_CLASS}
          />
        </div>
        <div className="w-56">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Trạng thái</label>
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
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Số hồ sơ</th>
              <th className="text-left px-4 py-3">Người yêu cầu</th>
              <th className="text-left px-4 py-3">Loại</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-left px-4 py-3">Cán bộ xử lý</th>
              <th className="text-left px-4 py-3">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="py-8">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                    <ButtonSpinner /> Đang tải…
                  </div>
                </td>
              </tr>
            )}
            {!loading && cases.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="🗂️" text="Chưa có hồ sơ nào" />
                </td>
              </tr>
            )}
            {!loading &&
              cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/houses/cases/${c.id}`)}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{c.caseNumber}
                    {isOverdue(c.dueDate) && c.status !== CaseStatus.COMPLETED && c.status !== CaseStatus.REJECTED && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 font-sans">
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
                  <td className="px-4 py-3 text-xs text-slate-500">{c.assignedTo?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-soft w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Tiếp nhận hồ sơ mới</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4 bg-slate-50">
              {createError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
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
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
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
