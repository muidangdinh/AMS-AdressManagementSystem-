'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { SurveyAssignment, SurveyCampaign, Ward } from '@tayninh/shared';
import {
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatus,
  CAMPAIGN_STATUS_LABELS,
  CampaignStatus,
  EDITOR_ROLES,
  UserRole,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { assignmentsApi, campaignsApi, zonesApi } from '@/lib/surveys-api';
import { wardsApi } from '@/lib/addresses-api';
import { EmptyState, FIELD_CLASS } from '@/components/ui';

const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [CampaignStatus.ACTIVE]: 'bg-blue-100 text-blue-800 border-blue-200',
  [CampaignStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const ASSIGNMENT_STATUS_BADGE: Record<AssignmentStatus, string> = {
  [AssignmentStatus.ASSIGNED]: 'bg-slate-100 text-slate-700 border-slate-200',
  [AssignmentStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
  [AssignmentStatus.SUBMITTED]: 'bg-amber-100 text-amber-800 border-amber-200',
  [AssignmentStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [AssignmentStatus.NEEDS_REVISIT]: 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function SurveyCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { user } = useAuth();
  const canEdit = !!user && EDITOR_ROLES.includes(user.role as UserRole);

  const [campaign, setCampaign] = useState<SurveyCampaign | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [surveyors, setSurveyors] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaign(await campaignsApi.get(campaignId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được đợt khảo sát');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    wardsApi.list().then(setWards).catch(() => {});
    assignmentsApi.listSurveyors().then(setSurveyors).catch(() => {});
  }, []);

  async function handleStatusChange(status: CampaignStatus) {
    setActionError(null);
    try {
      await campaignsApi.update(campaignId, { status });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không đổi được trạng thái');
    }
  }

  // ---- Thêm phân vùng ----
  const [zoneForm, setZoneForm] = useState({ name: '', wardId: '' });
  const [zoneSaving, setZoneSaving] = useState(false);

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    setZoneSaving(true);
    setActionError(null);
    try {
      await zonesApi.create({
        campaignId,
        name: zoneForm.name,
        wardId: zoneForm.wardId || undefined,
      });
      setZoneForm({ name: '', wardId: '' });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không thêm được phân vùng');
    } finally {
      setZoneSaving(false);
    }
  }

  async function handleRemoveZone(zoneId: string) {
    if (!confirm('Xóa phân vùng này? (chỉ xóa được khi chưa giao nhiệm vụ nào)')) return;
    try {
      await zonesApi.remove(zoneId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được phân vùng');
    }
  }

  // ---- Giao nhiệm vụ ----
  const [assignForm, setAssignForm] = useState<Record<string, { assigneeId: string; dueDate: string; note: string }>>(
    {},
  );
  const [assigning, setAssigning] = useState<string | null>(null);

  function getAssignForm(zoneId: string) {
    return assignForm[zoneId] ?? { assigneeId: '', dueDate: '', note: '' };
  }

  async function handleAssign(zoneId: string) {
    const f = getAssignForm(zoneId);
    if (!f.assigneeId) return;
    setAssigning(zoneId);
    setActionError(null);
    try {
      await assignmentsApi.create({
        zoneId,
        assigneeId: f.assigneeId,
        dueDate: f.dueDate || undefined,
        note: f.note || undefined,
      });
      setAssignForm((prev) => ({ ...prev, [zoneId]: { assigneeId: '', dueDate: '', note: '' } }));
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không giao được nhiệm vụ');
    } finally {
      setAssigning(null);
    }
  }

  async function handleComplete(assignmentId: string) {
    if (!confirm('Duyệt hoàn tất nhiệm vụ khảo sát này?')) return;
    setActionError(null);
    try {
      await assignmentsApi.complete(assignmentId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không duyệt được');
    }
  }

  async function handleRequestRevisit(assignmentId: string) {
    const reason = prompt('Lý do yêu cầu khảo sát lại:');
    if (!reason) return;
    setActionError(null);
    try {
      await assignmentsApi.requestRevisit(assignmentId, reason);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không gửi yêu cầu được');
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    if (!confirm('Xóa nhiệm vụ này? (chỉ xóa được khi chưa bắt đầu)')) return;
    try {
      await assignmentsApi.remove(assignmentId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được nhiệm vụ');
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400 flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
        Đang tải…
      </div>
    );
  }
  if (error || !campaign) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Không tìm thấy đợt khảo sát'}</div>;
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <Link href="/houses/surveys" className="text-sm text-blue-600 hover:underline font-semibold">
        ← Danh sách đợt khảo sát
      </Link>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{actionError}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <span
          className={`inline-block mb-2 px-2 py-0.5 rounded text-[11px] font-bold border ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </span>
        <h2 className="text-lg font-bold text-slate-900">{campaign.name}</h2>
        {campaign.description && <p className="text-sm text-slate-600 mt-1">{campaign.description}</p>}
        <p className="text-xs text-slate-400 mt-2">
          Tạo bởi {campaign.createdBy?.fullName ?? '—'} lúc{' '}
          {new Date(campaign.createdAt).toLocaleString('vi-VN')}
        </p>
        {canEdit && (
          <div className="flex gap-2 mt-3">
            {campaign.status === CampaignStatus.DRAFT && (
              <button
                onClick={() => handleStatusChange(CampaignStatus.ACTIVE)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Bắt đầu triển khai
              </button>
            )}
            {campaign.status === CampaignStatus.ACTIVE && (
              <button
                onClick={() => handleStatusChange(CampaignStatus.COMPLETED)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Đánh dấu hoàn tất
              </button>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <form
          onSubmit={handleAddZone}
          className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 items-end shadow-card flex-wrap"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              + Thêm phân vùng — Tên *
            </label>
            <input
              required
              value={zoneForm.name}
              onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='vd "Khu vực Phường 3"'
              className={FIELD_CLASS}
            />
          </div>
          <div className="w-48">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Xã/Phường</label>
            <select
              value={zoneForm.wardId}
              onChange={(e) => setZoneForm((f) => ({ ...f, wardId: e.target.value }))}
              className={FIELD_CLASS}
            >
              <option value="">-- Không --</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={zoneSaving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm
          </button>
        </form>
      )}

      <div className="space-y-4">
        {(campaign.zones ?? []).length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-card">
            <EmptyState icon="🧭" text="Chưa có phân vùng nào trong đợt khảo sát này" />
          </div>
        )}
        {(campaign.zones ?? []).map((zone) => (
          <div key={zone.id} className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{zone.name}</h3>
                <p className="text-xs text-slate-500">{zone.ward?.name ?? 'Chưa gán xã/phường'}</p>
              </div>
              {canEdit && (zone._count?.assignments ?? 0) === 0 && (
                <button
                  onClick={() => handleRemoveZone(zone.id)}
                  className="text-rose-600 hover:underline text-xs font-semibold"
                >
                  Xóa phân vùng
                </button>
              )}
            </div>

            <div className="p-4 space-y-2">
              {(zone.assignments ?? []).length === 0 && (
                <p className="text-xs text-slate-400 py-2">Chưa giao nhiệm vụ nào trong phân vùng này</p>
              )}
              {(zone.assignments ?? []).map((a: SurveyAssignment) => (
                <div
                  key={a.id}
                  className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{a.assignee.fullName}</p>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${ASSIGNMENT_STATUS_BADGE[a.status]}`}
                    >
                      {ASSIGNMENT_STATUS_LABELS[a.status]}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {a._count?.houses ?? 0} nhà đã khảo sát
                      {a.dueDate ? ` • Hạn ${new Date(a.dueDate).toLocaleDateString('vi-VN')}` : ''}
                    </p>
                    {a.note && <p className="text-[11px] text-slate-500 mt-0.5">Ghi chú: {a.note}</p>}
                    {a.reviewNote && (
                      <p className="text-[11px] text-rose-600 mt-0.5">Lý do khảo sát lại: {a.reviewNote}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5 shrink-0">
                      {a.status === AssignmentStatus.ASSIGNED && (
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-rose-600 hover:underline text-xs font-semibold"
                        >
                          Xóa
                        </button>
                      )}
                      {a.status === AssignmentStatus.SUBMITTED && (
                        <>
                          <button
                            onClick={() => handleComplete(a.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition"
                          >
                            Duyệt hoàn tất
                          </button>
                          <button
                            onClick={() => handleRequestRevisit(a.id)}
                            className="border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold px-2.5 py-1 rounded-lg transition"
                          >
                            Yêu cầu khảo sát lại
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {canEdit && (
                <div className="flex gap-2 items-end pt-2 flex-wrap">
                  <select
                    value={getAssignForm(zone.id).assigneeId}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        [zone.id]: { ...getAssignForm(zone.id), assigneeId: e.target.value },
                      }))
                    }
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition"
                  >
                    <option value="">-- Chọn cán bộ khảo sát --</option>
                    {surveyors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={getAssignForm(zone.id).dueDate}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        [zone.id]: { ...getAssignForm(zone.id), dueDate: e.target.value },
                      }))
                    }
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition"
                  />
                  <input
                    value={getAssignForm(zone.id).note}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        [zone.id]: { ...getAssignForm(zone.id), note: e.target.value },
                      }))
                    }
                    placeholder="Ghi chú (tùy chọn)"
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[140px] focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition"
                  />
                  <button
                    onClick={() => handleAssign(zone.id)}
                    disabled={assigning === zone.id || !getAssignForm(zone.id).assigneeId}
                    className="bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    Giao việc
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
