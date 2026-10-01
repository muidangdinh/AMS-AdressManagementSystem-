'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NumberingScheme, Street } from '@tayninh/shared';
import { NUMBERING_SCHEME_STATUS_LABELS, NumberingSchemeStatus, PERMISSIONS } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { numberingSchemesApi } from '@/lib/numbering-api';
import { streetsApi } from '@/lib/addresses-api';
import { Plus, Send } from 'lucide-react';
import {
  Button,
  ButtonSpinner,
  EmptyState,
  FIELD_CLASS,
  FormField,
  FormSection,
  PageHeader,
  ToggleSwitch,
} from '@/components/ui';

const STATUS_BADGE: Record<NumberingSchemeStatus, string> = {
  [NumberingSchemeStatus.DRAFT]: 'bg-surface-2 text-fg border-line',
  [NumberingSchemeStatus.SUBMITTED]: 'bg-warn/15 text-warn border-warn/30',
  [NumberingSchemeStatus.APPROVED]: 'bg-ok/15 text-ok border-ok/30',
  [NumberingSchemeStatus.REJECTED]: 'bg-danger/15 text-danger border-danger/30',
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

  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function handleQuickSubmit(scheme: NumberingScheme) {
    if (!confirm(`Trình duyệt phương án "${scheme.name}"?`)) return;
    setSubmittingId(scheme.id);
    setError(null);
    try {
      await numberingSchemesApi.submit(scheme.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không trình duyệt được phương án');
    } finally {
      setSubmittingId(null);
    }
  }

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
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Tạo phương án mới
            </Button>
          )
        }
      />

      <div className="glass p-3 flex gap-3 items-end flex-wrap">
        <div className="w-56">
          <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">
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
          <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">
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
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <div className="glass overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-fg-subtle">Đang tải…</p>
        ) : schemes.length === 0 ? (
          <EmptyState text="Chưa có phương án nào" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-fg-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Tên phương án</th>
                <th className="text-left px-4 py-3">Đường/Phố</th>
                <th className="text-left px-4 py-3">Xã/Phường</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                <th className="text-left px-4 py-3">Người tạo</th>
                <th className="text-left px-4 py-3">Ngày tạo</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {schemes.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/houses/numbering/${s.id}`)}
                  className="cursor-pointer hover:bg-surface-2 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-fg">{s.name}</td>
                  <td className="px-4 py-3">{s.street.name}</td>
                  <td className="px-4 py-3">{s.ward?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE[s.status]}`}
                    >
                      {NUMBERING_SCHEME_STATUS_LABELS[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">{s.createdBy?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      {s.status === NumberingSchemeStatus.DRAFT && (
                        // Trình duyệt nhanh ngay từ danh sách — API tự kiểm tra phương án đủ điều kiện.
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSubmit(s);
                          }}
                          disabled={submittingId === s.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/15 disabled:opacity-50"
                        >
                          {submittingId === s.id ? <ButtonSpinner /> : <Send className="w-3.5 h-3.5" />}
                          Trình duyệt
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-surface rounded-2xl shadow-soft w-full max-w-lg overflow-hidden">
            <div className="bg-shell text-fg border-b border-line px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Tạo phương án đánh số</h3>
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
                <div className="flex items-center gap-2.5 text-sm text-fg">
                  <ToggleSwitch
                    checked={form.oddEvenSplit}
                    onChange={(v) => setForm((f) => ({ ...f, oddEvenSplit: v }))}
                    label="Tách chẵn/lẻ 2 bên đường"
                  />
                  Tách chẵn/lẻ 2 bên đường (tắt = đánh số liên tục cả 2 bên)
                </div>
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
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-line bg-surface text-fg-muted hover:bg-surface-2 transition"
                >
                  Hủy
                </button>
                <button
                  disabled={creating}
                  className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
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
