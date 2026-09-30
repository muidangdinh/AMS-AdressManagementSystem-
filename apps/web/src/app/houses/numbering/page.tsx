'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NumberingScheme, Street } from '@tayninh/shared';
import { NUMBERING_SCHEME_STATUS_LABELS, NumberingSchemeStatus, PERMISSIONS } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { numberingSchemesApi } from '@/lib/numbering-api';
import { streetsApi } from '@/lib/addresses-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, FormSection, PageHeader } from '@/components/ui';

const STATUS_BADGE: Record<NumberingSchemeStatus, string> = {
  [NumberingSchemeStatus.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [NumberingSchemeStatus.SUBMITTED]: 'bg-amber-100 text-amber-800 border-amber-200',
  [NumberingSchemeStatus.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [NumberingSchemeStatus.REJECTED]: 'bg-rose-100 text-rose-800 border-rose-200',
};

/** Danh sách phương án đánh số (Phase 7 — V. Đánh số nhà). */
export default function NumberingSchemesPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canEdit = hasPermission(PERMISSIONS.SCHEME_MANAGE);

  const [schemes, setSchemes] = useState<NumberingScheme[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [streetFilter, setStreetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<NumberingSchemeStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await numberingSchemesApi.list({
        streetId: streetFilter || undefined,
        status: statusFilter || undefined,
      });
      setSchemes(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách phương án');
    } finally {
      setLoading(false);
    }
  }, [streetFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    streetsApi.list().then(setStreets).catch(() => {});
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    streetId: '',
    description: '',
    oddEvenSplit: true,
    startNumber: '1',
    step: '2',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const scheme = await numberingSchemesApi.create({
        name: form.name,
        streetId: form.streetId,
        description: form.description || undefined,
        oddEvenSplit: form.oddEvenSplit,
        startNumber: Number(form.startNumber),
        step: Number(form.step),
      });
      router.push(`/houses/numbering/${scheme.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Không tạo được phương án');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Lập phương án đánh số"
        subtitle="Soạn phương án cho 1 tuyến đường, sinh số tự động, kiểm tra và trình duyệt trước khi ghi vào hồ sơ số nhà chính thức."
        actions={
          canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
            >
              + Tạo phương án
            </button>
          )
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex gap-3 items-end shadow-card">
        <div className="w-56">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Đường/Phố
          </label>
          <select
            value={streetFilter}
            onChange={(e) => setStreetFilter(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">-- Tất cả --</option>
            {streets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Trạng thái
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as NumberingSchemeStatus | '')}
            className={FIELD_CLASS}
          >
            <option value="">-- Tất cả --</option>
            {Object.values(NumberingSchemeStatus).map((s) => (
              <option key={s} value={s}>
                {NUMBERING_SCHEME_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        {loading ? (
          <EmptyState icon="⏳" text="Đang tải…" />
        ) : schemes.length === 0 ? (
          <EmptyState icon="📋" text="Chưa có phương án nào" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Tên phương án</th>
                <th className="text-left px-4 py-3">Đường/Phố</th>
                <th className="text-left px-4 py-3">Xã/Phường</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-left px-4 py-3">Người tạo</th>
                <th className="text-left px-4 py-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schemes.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/houses/numbering/${s.id}`)}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                  <td className="px-4 py-3">{s.street.name}</td>
                  <td className="px-4 py-3">{s.ward?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE[s.status]}`}
                    >
                      {NUMBERING_SCHEME_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.createdBy?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-white rounded-2xl shadow-soft w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Tạo phương án đánh số</h3>
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

              <FormSection title="Thông tin phương án">
                <FormField label="Tên phương án" required>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder='vd "Đánh số Cách Mạng Tháng Tám — đoạn 1"'
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Đường/Phố áp dụng" required>
                  <select
                    required
                    value={form.streetId}
                    onChange={(e) => setForm((f) => ({ ...f, streetId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="" disabled>
                      -- Chọn đường/phố --
                    </option>
                    {streets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Mô tả phạm vi / điểm đầu-cuối">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={FIELD_CLASS}
                    rows={2}
                  />
                </FormField>
              </FormSection>

              <FormSection title="Quy tắc sinh số">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    id="oddEvenSplit"
                    type="checkbox"
                    checked={form.oddEvenSplit}
                    onChange={(e) => setForm((f) => ({ ...f, oddEvenSplit: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40"
                  />
                  Tách chẵn/lẻ 2 bên đường (bỏ chọn = đánh số liên tục cả 2 bên)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Số bắt đầu">
                    <input
                      type="number"
                      value={form.startNumber}
                      onChange={(e) => setForm((f) => ({ ...f, startNumber: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Bước nhảy">
                    <input
                      type="number"
                      value={form.step}
                      onChange={(e) => setForm((f) => ({ ...f, step: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                </div>
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
                  {creating ? 'Đang tạo…' : 'Tạo & mở phương án'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
