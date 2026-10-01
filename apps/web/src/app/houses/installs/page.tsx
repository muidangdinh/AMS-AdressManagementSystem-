'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InstallCampaign } from '@tayninh/shared';
import { CAMPAIGN_STATUS_LABELS, CampaignStatus, PERMISSIONS } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { installCampaignsApi } from '@/lib/installs-api';
import { CalendarDays, Layers, Plus, UserCheck } from 'lucide-react';
import {
  Button,
  ButtonSpinner,
  EmptyState,
  FIELD_CLASS,
  FormField,
  FormSection,
  PageHeader,
  StatusBadge,
  type StatusTone,
} from '@/components/ui';

const STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  [CampaignStatus.DRAFT]: 'neutral',
  [CampaignStatus.ACTIVE]: 'warn',
  [CampaignStatus.COMPLETED]: 'ok',
};

/**
 * % thời gian đã trôi qua của đợt (ngày bắt đầu → kết thúc). Hoàn tất = 100%, nháp = 0%.
 * Không đủ ngày bắt đầu/kết thúc thì null (không vẽ thanh tiến độ).
 */
function campaignProgress(c: InstallCampaign): number | null {
  if (c.status === CampaignStatus.COMPLETED) return 100;
  if (c.status === CampaignStatus.DRAFT) return 0;
  if (!c.startDate || !c.endDate) return null;
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  if (end <= start) return null;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

/** Danh sách đợt thi công gắn biển (tương tự danh sách đợt khảo sát). */
export default function InstallCampaignsPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canEdit = hasPermission(PERMISSIONS.INSTALL_MANAGE);

  const [campaigns, setCampaigns] = useState<InstallCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await installCampaignsApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách đợt thi công');
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
      const campaign = await installCampaignsApi.create({
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      router.push(`/houses/installs/${campaign.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Không tạo được đợt thi công');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Thi công gắn biển số nhà"
        subtitle="Đợt thi công → phân vùng theo xã/phường → giao nhiệm vụ cho cán bộ thi công đi gắn biển (mobile)."
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Tạo đợt thi công
            </Button>
          )
        }
      />

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">{error}</div>
      )}

      {loading && <p className="text-sm text-fg-subtle">Đang tải…</p>}

      {!loading && campaigns.length === 0 && (
        <div className="glass">
          <EmptyState text="Chưa có đợt thi công nào" />
        </div>
      )}

      {/* Card đợt khảo sát (UI.md) — trạng thái, phân vùng, người tạo, thanh tiến độ thời gian. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!loading &&
          campaigns.map((c) => {
            const progress = campaignProgress(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/houses/installs/${c.id}`)}
                className="glass group text-left p-4 flex flex-col gap-3 transition-all duration-300 hover:border-accent/50 hover:shadow-glow-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-fg truncate group-hover:text-accent transition-colors">{c.name}</h3>
                    {c.description && <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{c.description}</p>}
                  </div>
                  <StatusBadge tone={STATUS_TONE[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</StatusBadge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-fg-muted">
                    <Layers className="w-3.5 h-3.5 text-accent" />
                    <span>
                      <b className="text-fg tabular-nums">{c._count?.zones ?? 0}</b> phân vùng
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-fg-muted min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate">{c.createdBy?.fullName ?? '—'}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-fg-muted">
                    <CalendarDays className="w-3.5 h-3.5 text-accent" />
                    {c.startDate || c.endDate ? (
                      <span>
                        {c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '…'} →{' '}
                        {c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : '…'}
                      </span>
                    ) : (
                      <span>Tạo ngày {new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                    )}
                  </div>
                </div>

                {progress !== null && (
                  <div>
                    <div className="flex justify-between text-[11px] text-fg-subtle mb-1">
                      <span>Tiến độ thời gian</span>
                      <span className="tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.status === CampaignStatus.COMPLETED ? 'bg-ok shadow-glow-ok' : 'bg-brand-gradient shadow-glow-accent'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-surface rounded-2xl shadow-soft w-full max-w-lg overflow-hidden">
            <div className="bg-shell text-fg border-b border-line px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold">Tạo đợt thi công</h3>
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
              <FormSection title="Thông tin đợt thi công">
                <FormField label="Tên đợt" required>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder='vd "Thi công đợt 1 — Quý 4/2026"'
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
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-line text-fg-muted bg-surface hover:bg-surface-2 transition"
                >
                  Hủy
                </button>
                <button
                  disabled={creating}
                  className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {creating && <ButtonSpinner light />}
                  {creating ? 'Đang tạo…' : 'Tạo & mở đợt thi công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
