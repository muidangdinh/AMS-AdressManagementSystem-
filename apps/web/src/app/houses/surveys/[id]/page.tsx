'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { SurveyAssignment, SurveyCampaign, Ward } from '@tayninh/shared';
import {
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatus,
  assignmentProgressPercent,
  CAMPAIGN_STATUS_LABELS,
  CampaignStatus,
  EDITOR_ROLES,
  PERMISSIONS,
  UserRole,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { assignmentsApi, campaignsApi, zonesApi } from '@/lib/surveys-api';
import { NotificationEntity } from '@tayninh/shared';
import RemindButton from '@/components/RemindButton';
import AssignmentTimeline from '@/components/AssignmentTimeline';
import RevisitModal from '@/components/RevisitModal';
import SurveyRoutesPanel from '@/components/SurveyRoutesPanel';
import { Home, Layers, Route, UserCheck } from 'lucide-react';
import { formatLength } from '@/lib/routing';
import { formatDueDate, isOverdue } from '@/lib/deadline';
import { wardsApi } from '@/lib/addresses-api';
import { EmptyState, FIELD_CLASS } from '@/components/ui';

const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: 'bg-surface-2 text-fg border-line',
  [CampaignStatus.ACTIVE]: 'bg-accent/15 text-accent border-accent/30',
  [CampaignStatus.COMPLETED]: 'bg-ok/15 text-ok border-ok/30',
};

const ASSIGNMENT_STATUS_BADGE: Record<AssignmentStatus, string> = {
  [AssignmentStatus.ASSIGNED]: 'bg-surface-2 text-fg border-line',
  [AssignmentStatus.IN_PROGRESS]: 'bg-accent/15 text-accent border-accent/30',
  [AssignmentStatus.SUBMITTED]: 'bg-warn/15 text-warn border-warn/30',
  [AssignmentStatus.COMPLETED]: 'bg-ok/15 text-ok border-ok/30',
  [AssignmentStatus.NEEDS_REVISIT]: 'bg-danger/15 text-danger border-danger/30',
};

export default function SurveyCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { user, hasPermission } = useAuth();
  const canEdit = !!user && EDITOR_ROLES.includes(user.role as UserRole);
  // Tuyến đường khảo sát: cùng quyền với API `survey-routes` (ghi cần survey:manage).
  const canManageRoutes = hasPermission(PERMISSIONS.SURVEY_MANAGE);

  const [campaign, setCampaign] = useState<SurveyCampaign | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [surveyors, setSurveyors] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [surveyorsLoaded, setSurveyorsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** `silent` = tải lại ngầm (không hiện màn "Đang tải…") — giữ nguyên bản đồ tuyến và vị trí zoom. */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
    assignmentsApi
      .listSurveyors()
      .then(setSurveyors)
      .catch(() => {})
      .finally(() => setSurveyorsLoaded(true));
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
    if (!confirm('Xóa phân vùng này? Các tuyến đường của phân vùng cũng bị xóa. (chỉ xóa được khi chưa giao nhiệm vụ nào)')) return;
    try {
      await zonesApi.remove(zoneId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được phân vùng');
    }
  }

  // ---- Giao nhiệm vụ ----
  const [assignForm, setAssignForm] = useState<Record<string, { assigneeId: string; dueDate: string; note: string; targetCount: string }>>(
    {},
  );
  const [assigning, setAssigning] = useState<string | null>(null);

  function getAssignForm(zoneId: string) {
    return assignForm[zoneId] ?? { assigneeId: '', dueDate: '', note: '', targetCount: '' };
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
        targetCount: f.targetCount ? Number(f.targetCount) : undefined,
      });
      setAssignForm((prev) => ({ ...prev, [zoneId]: { assigneeId: '', dueDate: '', note: '', targetCount: '' } }));
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

  // Phase 11 Đợt 2b — modal chọn nhà cần khảo sát lại (thay cho hộp thoại nhập lý do chung).
  const [revisitTarget, setRevisitTarget] = useState<{ assignment: SurveyAssignment; zoneName: string } | null>(null);

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
      <div className="p-6 text-sm text-fg-subtle flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
        Đang tải…
      </div>
    );
  }
  if (error || !campaign) {
    return <div className="p-6 text-sm text-danger">{error ?? 'Không tìm thấy đợt khảo sát'}</div>;
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <Link href="/houses/surveys" className="text-sm text-accent hover:underline font-semibold">
        ← Danh sách đợt khảo sát
      </Link>

      {revisitTarget && (
        <RevisitModal
          assignment={revisitTarget.assignment}
          zoneName={revisitTarget.zoneName}
          onClose={() => setRevisitTarget(null)}
          onDone={() => {
            setRevisitTarget(null);
            load();
          }}
        />
      )}

      {actionError && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">{actionError}</div>
      )}

      <div className="glass p-5">
        <span
          className={`inline-block mb-2 px-2 py-0.5 rounded text-[11px] font-bold border ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}
        >
          {CAMPAIGN_STATUS_LABELS[campaign.status]}
        </span>
        <h2 className="text-lg font-bold text-fg">{campaign.name}</h2>
        {campaign.description && <p className="text-sm text-fg-muted mt-1">{campaign.description}</p>}
        <p className="text-xs text-fg-subtle mt-2">
          Tạo bởi {campaign.createdBy?.fullName ?? '—'} lúc{' '}
          {new Date(campaign.createdAt).toLocaleString('vi-VN')}
        </p>
        {canEdit && (
          <div className="flex gap-2 mt-3">
            {campaign.status === CampaignStatus.DRAFT && (
              <button
                onClick={() => handleStatusChange(CampaignStatus.ACTIVE)}
                className="bg-brand hover:bg-brand/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Bắt đầu triển khai
              </button>
            )}
            {campaign.status === CampaignStatus.ACTIVE && (
              <button
                onClick={() => handleStatusChange(CampaignStatus.COMPLETED)}
                className="bg-ok hover:bg-ok/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
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
          className="glass p-4 flex gap-3 items-end flex-wrap"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">
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
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Xã/Phường</label>
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
            className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm
          </button>
        </form>
      )}

      {/* Thanh thống kê đợt (UI.md): chiều dài tuyến, số nhà đã khảo sát, phân vùng. */}
      {(() => {
        const zones = campaign.zones ?? [];
        const routes = zones.flatMap((z) => z.routes ?? []);
        const assignments = zones.flatMap((z) => z.assignments ?? []);
        const lengthM = routes.reduce((sum, r) => sum + (r.lengthM ?? 0), 0);
        const houses = assignments.reduce((sum, a) => sum + (a._count?.houses ?? 0), 0);
        const target = assignments.reduce((sum, a) => sum + (a.targetCount ?? 0), 0);
        const tiles = [
          { icon: Layers, label: 'Phân vùng', value: String(zones.length) },
          { icon: Route, label: 'Chiều dài tuyến', value: `${formatLength(lengthM)} • ${routes.length} tuyến` },
          { icon: UserCheck, label: 'Nhiệm vụ', value: String(assignments.length) },
          { icon: Home, label: 'Nhà đã khảo sát', value: target ? `${houses} / ${target}` : String(houses) },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="glass px-4 py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent grid place-items-center shadow-glow-accent shrink-0">
                  <t.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-fg-subtle">{t.label}</p>
                  <p className="text-base font-bold text-fg tabular-nums truncate">{t.value}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <SurveyRoutesPanel
        campaign={campaign}
        canManage={canManageRoutes}
        surveyors={surveyors}
        onAssignmentsChanged={() => load(true)}
      />

      <div className="space-y-4">
        {(campaign.zones ?? []).length === 0 && (
          <div className="glass">
            <EmptyState icon="🧭" text="Chưa có phân vùng nào trong đợt khảo sát này" />
          </div>
        )}
        {(campaign.zones ?? []).map((zone) => (
          <div key={zone.id} className="glass overflow-hidden">
            <div className="px-4 py-3 bg-surface-2 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-fg">{zone.name}</h3>
                <p className="text-xs text-fg-muted">{zone.ward?.name ?? 'Chưa gán xã/phường'}</p>
              </div>
              {canEdit && (zone._count?.assignments ?? 0) === 0 && (
                <button
                  onClick={() => handleRemoveZone(zone.id)}
                  className="text-danger hover:underline text-xs font-semibold"
                >
                  Xóa phân vùng
                </button>
              )}
            </div>

            <div className="p-4 space-y-2">
              {(zone.assignments ?? []).length === 0 && (
                <p className="text-xs text-fg-subtle py-2">Chưa giao nhiệm vụ nào trong phân vùng này</p>
              )}
              {(zone.assignments ?? []).map((a: SurveyAssignment) => (
                <div
                  key={a.id}
                  className="border border-line rounded-lg p-3 flex items-center justify-between gap-3 hover:border-line transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg">{a.assignee.fullName}</p>
                    {a.route && <p className="text-[11px] text-accent font-semibold">Tuyến: {a.route.name}</p>}
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${ASSIGNMENT_STATUS_BADGE[a.status]}`}
                    >
                      {ASSIGNMENT_STATUS_LABELS[a.status]}
                    </span>
                    <p className="text-[11px] text-fg-subtle mt-0.5">
                      {a._count?.houses ?? 0}{a.targetCount ? ` / ${a.targetCount}` : ''} nhà đã khảo sát
                      {a.dueDate ? ` • Hạn ${formatDueDate(a.dueDate)}` : ''}
                      {a.dueDate &&
                        isOverdue(a.dueDate) &&
                        (a.status === AssignmentStatus.ASSIGNED ||
                          a.status === AssignmentStatus.IN_PROGRESS ||
                          a.status === AssignmentStatus.NEEDS_REVISIT) && (
                          <span className="text-danger font-bold"> • QUÁ HẠN</span>
                        )}
                    </p>
                    {a.targetCount ? (
                      <div className="mt-1 flex items-center gap-2" title="Tiến độ theo chỉ tiêu">
                        <div className="h-1.5 w-28 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${Math.min(100, assignmentProgressPercent(a) ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-fg-muted">{assignmentProgressPercent(a)}%</span>
                      </div>
                    ) : null}
                    {a.note && <p className="text-[11px] text-fg-muted mt-0.5">Ghi chú: {a.note}</p>}
                    {(a.revisitPending ?? 0) > 0 && (
                      <p className="text-[11px] text-danger font-semibold mt-0.5">
                        {a.revisitPending} nhà cần khảo sát lại
                      </p>
                    )}
                    {a.reviewNote && (
                      <p className="text-[11px] text-danger mt-0.5">Lý do khảo sát lại: {a.reviewNote}</p>
                    )}
                    <AssignmentTimeline assignmentId={a.id} />
                  </div>
                  {canEdit && (
                    <div className="flex gap-1.5 shrink-0">
                      {(a.status === AssignmentStatus.ASSIGNED ||
                        a.status === AssignmentStatus.IN_PROGRESS ||
                        a.status === AssignmentStatus.NEEDS_REVISIT) && (
                        <RemindButton entityType={NotificationEntity.SURVEY_ASSIGNMENT} entityId={a.id} />
                      )}
                      {a.status === AssignmentStatus.ASSIGNED && (
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="text-danger hover:underline text-xs font-semibold"
                        >
                          Xóa
                        </button>
                      )}
                      {a.status === AssignmentStatus.SUBMITTED && (
                        <>
                          <button
                            onClick={() => handleComplete(a.id)}
                            className="bg-ok hover:bg-ok/90 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition"
                          >
                            Duyệt hoàn tất
                          </button>
                          <button
                            onClick={() => setRevisitTarget({ assignment: a, zoneName: zone.name })}
                            className="border border-danger/30 text-danger hover:bg-danger/10 text-xs font-semibold px-2.5 py-1 rounded-lg transition"
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
                    className="border border-line rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
                  >
                    <option value="">-- Chọn cán bộ khảo sát --</option>
                    {surveyors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                  {surveyorsLoaded && surveyors.length === 0 && (
                    <p className="basis-full text-[11px] text-warn">
                      Chưa có cán bộ khảo sát nào.{' '}
                      {user?.role === UserRole.ADMIN ? (
                        <Link href="/houses/users" className="font-semibold underline">
                          Tạo tài khoản ở Quản lý người dùng
                        </Link>
                      ) : (
                        'Liên hệ quản trị viên để tạo tài khoản.'
                      )}
                    </p>
                  )}
                  <input
                    type="date"
                    value={getAssignForm(zone.id).dueDate}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        [zone.id]: { ...getAssignForm(zone.id), dueDate: e.target.value },
                      }))
                    }
                    className="border border-line rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
                  />
                  <input
                    type="number"
                    min={1}
                    value={getAssignForm(zone.id).targetCount}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        [zone.id]: { ...getAssignForm(zone.id), targetCount: e.target.value },
                      }))
                    }
                    placeholder="Chỉ tiêu (số nhà)"
                    className="border border-line rounded-lg px-2 py-1.5 text-xs w-36 focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
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
                    className="border border-line rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[140px] focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
                  />
                  <button
                    onClick={() => handleAssign(zone.id)}
                    disabled={assigning === zone.id || !getAssignForm(zone.id).assigneeId}
                    className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
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
