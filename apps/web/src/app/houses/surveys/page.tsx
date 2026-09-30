'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SurveyCampaign } from '@tayninh/shared';
import { CAMPAIGN_STATUS_LABELS, CampaignStatus, PERMISSIONS } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { campaignsApi } from '@/lib/surveys-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, FormSection, PageHeader } from '@/components/ui';

const STATUS_BADGE: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [CampaignStatus.ACTIVE]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CampaignStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

/** Danh sách đợt khảo sát (Phase 9 — VII. Quản lý khảo sát thực địa). */
export default function SurveyCampaignsPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canEdit = hasPermission(PERMISSIONS.SURVEY_MANAGE);

  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await campaignsApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách đợt khảo sát');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const campaign = await campaignsApi.create({
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      router.push(`/houses/surveys/${campaign.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Không tạo được đợt khảo sát');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Khảo sát có tổ chức"
        subtitle="Đợt khảo sát → phân vùng theo xã/phường → giao nhiệm vụ cho cán bộ khảo sát (mobile)."
        actions={
          canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
            >
              + Tạo đợt khảo sát
            </button>
          )
        }
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Tên đợt</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-left px-4 py-3">Số phân vùng</th>
              <th className="text-left px-4 py-3">Người tạo</th>
              <th className="text-left px-4 py-3">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && campaigns.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon="🗺️" text="Chưa có đợt khảo sát nào" />
                </td>
              </tr>
            )}
            {!loading &&
              campaigns.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/houses/surveys/${c.id}`)}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[c.status]}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c._count?.zones ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.createdBy?.fullName ?? '—'}</td>
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
              <h3 className="font-bold">Tạo đợt khảo sát</h3>
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
              <FormSection title="Thông tin đợt khảo sát">
                <FormField label="Tên đợt" required>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder='vd "Khảo sát đợt 1 — Quý 3/2026"'
                    className={FIELD_CLASS}
                  />
                </FormField>
                <FormField label="Mô tả">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className={FIELD_CLASS}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Bắt đầu">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Kết thúc">
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                </div>
              </FormSection>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {creating && <ButtonSpinner light />}
                  {creating ? 'Đang tạo…' : 'Tạo & mở đợt khảo sát'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
