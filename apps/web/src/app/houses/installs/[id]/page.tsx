'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Hammer, Home, Layers, Route as RouteIcon, UserCheck } from 'lucide-react';
import type {
  InstallAssignment,
  InstallCampaign,
  InstallPlateItem,
  SurveyCampaign,
  SurveyRoute,
  Ward,
} from '@tayninh/shared';
import {
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatus,
  CAMPAIGN_STATUS_LABELS,
  CampaignStatus,
  NotificationEntity,
  PERMISSIONS,
  PlateStatus,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { installAssignmentsApi, installCampaignsApi, installZonesApi } from '@/lib/installs-api';
import { campaignsApi as surveyCampaignsApi } from '@/lib/surveys-api';
import { wardsApi } from '@/lib/addresses-api';
import { formatLength } from '@/lib/routing';
import { formatDueDate, isOverdue } from '@/lib/deadline';
import RemindButton from '@/components/RemindButton';
import { EMPTY_DRAFT, SURVEYOR_DRAG_TYPE, type MapDot } from '@/components/RoutePickerMap';
import { Button, ButtonSpinner, EmptyState, FIELD_CLASS, StatusBadge, type StatusTone } from '@/components/ui';

// Leaflet cần `window` nên chỉ render phía client.
const RoutePickerMap = dynamic(() => import('@/components/RoutePickerMap'), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-sm text-fg-subtle">Đang tải bản đồ…</div>,
});

const CAMPAIGN_TONE: Record<CampaignStatus, StatusTone> = {
  [CampaignStatus.DRAFT]: 'neutral',
  [CampaignStatus.ACTIVE]: 'warn',
  [CampaignStatus.COMPLETED]: 'ok',
};

const ASSIGNMENT_TONE: Record<AssignmentStatus, StatusTone> = {
  [AssignmentStatus.ASSIGNED]: 'neutral',
  [AssignmentStatus.IN_PROGRESS]: 'accent',
  [AssignmentStatus.SUBMITTED]: 'warn',
  [AssignmentStatus.COMPLETED]: 'ok',
  [AssignmentStatus.NEEDS_REVISIT]: 'danger',
};

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
const UNASSIGNED_COLOR = '#94a3b8';
const NOOP = () => undefined;

/** Nhãn sự kiện trên dòng thời gian nhiệm vụ thi công (khớp `INSTALL_EVENT` ở API). */
const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Giao nhiệm vụ',
  STARTED: 'Bắt đầu thi công',
  SUBMITTED: 'Gửi duyệt',
  COMPLETED: 'Nghiệm thu hoàn tất',
  REVISIT_REQUESTED: 'Yêu cầu thi công lại',
  REASSIGNED: 'Đổi người thực hiện',
  PLATES_REFRESHED: 'Bổ sung biển',
};

type Installer = { id: string; fullName: string; username: string };

/** Biển → màu chấm trên bản đồ: đã gắn = xanh, chưa gắn được = đỏ, cần làm lại = tím, chờ gắn = vàng. */
function plateColor(p: InstallPlateItem): string {
  if (p.status === PlateStatus.INSTALLED) return '#10b981';
  if (p.revisitReason) return '#8b5cf6';
  if (p.notInstalledAt) return '#ef4444';
  return '#f59e0b';
}

function plateLabel(p: InstallPlateItem): string {
  const state =
    p.status === PlateStatus.INSTALLED
      ? 'Đã gắn'
      : p.revisitReason
        ? 'Cần thi công lại'
        : p.notInstalledAt
          ? `Chưa gắn được${p.notInstalledReason ? ` (${p.notInstalledReason})` : ''}`
          : 'Chờ gắn';
  return `Số ${p.house.houseNumber} ${p.house.street} — ${state}`;
}

export default function InstallCampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.INSTALL_MANAGE);
  const canReview = hasPermission(PERMISSIONS.INSTALL_REVIEW);

  const [campaign, setCampaign] = useState<InstallCampaign | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /** `silent` = tải lại ngầm (không hiện "Đang tải…") để giữ bản đồ và vị trí zoom. */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        setCampaign(await installCampaignsApi.get(campaignId));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Không tải được đợt thi công');
      } finally {
        setLoading(false);
      }
    },
    [campaignId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    wardsApi.list().then(setWards).catch(() => {});
    if (canManage) installAssignmentsApi.listInstallers().then(setInstallers).catch(() => {});
  }, [canManage]);

  const zones = useMemo(() => campaign?.zones ?? [], [campaign]);
  const assignments = useMemo(() => zones.flatMap((z) => z.assignments ?? []), [zones]);

  // ---- Tuyến lấy từ 1 đợt khảo sát (dùng chung) ----
  const [surveyCampaigns, setSurveyCampaigns] = useState<SurveyCampaign[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [routes, setRoutes] = useState<SurveyRoute[]>([]);
  /** routeId → xã/phường của phân vùng khảo sát chứa tuyến (gợi ý chọn phân vùng thi công). */
  const [routeWard, setRouteWard] = useState<Record<string, string | null>>({});
  /** Phân vùng của đợt khảo sát nguồn kèm tuyến — dựng danh sách tuyến nổi trên bản đồ. */
  /** Mọi phân vùng của đợt khảo sát nguồn (kể cả chưa có tuyến) — dùng cho nút "Nhập phân vùng". */
  const [surveyZonesAll, setSurveyZonesAll] = useState<{ id: string; name: string; wardId: string | null }[]>([]);
  /** routeId → phân vùng khảo sát chứa tuyến (khớp tên + xã với phân vùng thi công khi giao việc). */
  const [routeSurveyZone, setRouteSurveyZone] = useState<Record<string, { name: string; wardId: string | null }>>({});
  const [routeGroups, setRouteGroups] = useState<{ id: string; name: string; routes: SurveyRoute[] }[]>([]);

  useEffect(() => {
    surveyCampaignsApi
      .list()
      .then((list) => {
        setSurveyCampaigns(list);
        if (list.length > 0) setSourceId((cur) => cur || list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sourceId) {
      setRoutes([]);
      setRouteGroups([]);
      setSurveyZonesAll([]);
      setRouteSurveyZone({});
      return;
    }
    surveyCampaignsApi
      .get(sourceId)
      .then((c) => {
        const zs = c.zones ?? [];
        setRoutes(zs.flatMap((z) => z.routes ?? []));
        setSurveyZonesAll(zs.map((z) => ({ id: z.id, name: z.name, wardId: z.wardId ?? null })));
        setRouteSurveyZone(
          Object.fromEntries(
            zs.flatMap((z) => (z.routes ?? []).map((r) => [r.id, { name: z.name, wardId: z.wardId ?? null }])),
          ),
        );
        setRouteGroups(zs.filter((z) => (z.routes ?? []).length > 0).map((z) => ({ id: z.id, name: z.name, routes: z.routes ?? [] })));
        setRouteWard(Object.fromEntries(zs.flatMap((z) => (z.routes ?? []).map((r) => [r.id, z.wardId ?? null]))));
      })
      .catch(() => {
        setRoutes([]);
        setRouteGroups([]);
        setSurveyZonesAll([]);
        setRouteSurveyZone({});
      });
  }, [sourceId]);

  // ---- Biển của đợt (chấm trên bản đồ) ----
  const [platesByAssignment, setPlatesByAssignment] = useState<Record<string, InstallPlateItem[]>>({});
  const assignmentKey = assignments.map((a) => `${a.id}:${a.status}:${a.stats?.installed}:${a.stats?.pending}`).join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(assignments.map((a) => installAssignmentsApi.plates(a.id).then((p) => [a.id, p] as const)))
      .then((pairs) => {
        if (!cancelled) setPlatesByAssignment(Object.fromEntries(pairs));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentKey]);

  const dots = useMemo<MapDot[]>(
    () =>
      Object.values(platesByAssignment)
        .flat()
        .map((p) => ({
          id: p.id,
          lat: p.house.latitude,
          lng: p.house.longitude,
          color: plateColor(p),
          title: plateLabel(p),
        })),
    [platesByAssignment],
  );

  const installerColors = useMemo(
    () => Object.fromEntries(installers.map((u, i) => [u.id, PALETTE[i % PALETTE.length]])),
    [installers],
  );
  const assignmentByRoute = useMemo(() => {
    const m = new Map<string, InstallAssignment>();
    for (const a of assignments) if (a.routeId) m.set(a.routeId, a);
    return m;
  }, [assignments]);
  const routeColors = useMemo(
    () =>
      Object.fromEntries(
        routes.map((r) => {
          const a = assignmentByRoute.get(r.id);
          return [r.id, a ? (installerColors[a.assigneeId] ?? '#475569') : UNASSIGNED_COLOR];
        }),
      ),
    [routes, assignmentByRoute, installerColors],
  );
  const mutedRouteIds = useMemo(
    () => new Set(routes.filter((r) => !assignmentByRoute.has(r.id)).map((r) => r.id)),
    [routes, assignmentByRoute],
  );

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState<number | undefined>(undefined);
  const [draggingInstaller, setDraggingInstaller] = useState(false);

  // ---- Thao tác chung ----
  async function handleStatusChange(status: CampaignStatus) {
    setActionError(null);
    try {
      await installCampaignsApi.update(campaignId, { status });
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không đổi được trạng thái');
    }
  }

  // Thêm phân vùng
  const [zoneForm, setZoneForm] = useState({ name: '', wardId: '' });
  const [zoneSaving, setZoneSaving] = useState(false);
  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    setZoneSaving(true);
    setActionError(null);
    try {
      await installZonesApi.create({ campaignId, name: zoneForm.name, wardId: zoneForm.wardId || undefined });
      setZoneForm({ name: '', wardId: '' });
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không thêm được phân vùng');
    } finally {
      setZoneSaving(false);
    }
  }
  /** Chép phân vùng của đợt khảo sát nguồn (cùng tên + cùng xã) sang đợt thi công; bỏ qua phân vùng đã có. */
  async function importSurveyZones() {
    const missing = surveyZonesAll.filter(
      (sz) => !zones.some((z) => z.name === sz.name && (z.wardId ?? null) === sz.wardId),
    );
    if (missing.length === 0) {
      alert(surveyZonesAll.length === 0 ? 'Đợt khảo sát này chưa có phân vùng nào.' : 'Đợt thi công đã có đủ các phân vùng của đợt khảo sát này.');
      return;
    }
    const names = missing.map((z) => `- ${z.name}`).join(String.fromCharCode(10));
    if (!confirm(`Thêm ${missing.length} phân vùng từ đợt khảo sát:` + String.fromCharCode(10) + names)) return;
    setZoneSaving(true);
    setActionError(null);
    try {
      for (const sz of missing) {
        await installZonesApi.create({ campaignId, name: sz.name, wardId: sz.wardId ?? undefined });
      }
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không nhập được phân vùng');
      await load(true);
    } finally {
      setZoneSaving(false);
    }
  }

  async function handleRemoveZone(zoneId: string) {
    if (!confirm('Xóa phân vùng này? (chỉ xóa được khi chưa giao nhiệm vụ nào)')) return;
    try {
      await installZonesApi.remove(zoneId);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được phân vùng');
    }
  }

  // ---- Giao việc: thả cán bộ lên tuyến (hoặc chọn ở danh sách tuyến) ----
  const [pending, setPending] = useState<{
    route: SurveyRoute;
    installer: Installer;
    zoneId: string;
    dueDate: string;
    targetCount: string;
    note: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function assignRoute(routeId: string, installerId: string) {
    const route = routes.find((r) => r.id === routeId);
    const installer = installers.find((u) => u.id === installerId);
    if (!route || !installer) return;
    setActionError(null);
    setSelectedRouteId(route.id);
    const existing = assignmentByRoute.get(route.id);
    if (!existing) {
      if (zones.length === 0) {
        setActionError('Hãy thêm phân vùng cho đợt thi công trước khi giao tuyến.');
        return;
      }
      const ward = routeWard[route.id];
      const sz = routeSurveyZone[route.id];
      const zone =
        (sz && zones.find((z) => z.name === sz.name && (z.wardId ?? null) === sz.wardId)) ||
        zones.find((z) => z.wardId && z.wardId === ward) ||
        zones[0];
      setPending({ route, installer, zoneId: zone.id, dueDate: '', targetCount: '', note: '' });
      return;
    }
    if (existing.assigneeId === installerId) return;
    if (existing.status !== AssignmentStatus.ASSIGNED) {
      setActionError(
        `Tuyến "${route.name}" đang ở trạng thái "${ASSIGNMENT_STATUS_LABELS[existing.status]}" — không đổi người được nữa.`,
      );
      return;
    }
    if (!confirm(`Đổi người thi công tuyến "${route.name}" từ ${existing.assignee.fullName} sang ${installer.fullName}?`)) return;
    await reassign(existing.id, installerId);
  }

  async function reassign(assignmentId: string, assigneeId: string) {
    setBusy(true);
    setActionError(null);
    try {
      await installAssignmentsApi.reassign(assignmentId, assigneeId);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không đổi được người thực hiện');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      await installAssignmentsApi.create({
        zoneId: pending.zoneId,
        routeId: pending.route.id,
        assigneeId: pending.installer.id,
        dueDate: pending.dueDate || undefined,
        targetCount: pending.targetCount ? Number(pending.targetCount) : undefined,
        note: pending.note.trim() || undefined,
      });
      setPending(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không giao được tuyến');
    } finally {
      setBusy(false);
    }
  }

  // Giao cả phân vùng (không kèm tuyến)
  const [zoneAssign, setZoneAssign] = useState<Record<string, { assigneeId: string; dueDate: string; note: string }>>({});
  const setZoneField = (zoneId: string, patch: Partial<{ assigneeId: string; dueDate: string; note: string }>) =>
    setZoneAssign((prev) => ({
      ...prev,
      [zoneId]: { ...({ assigneeId: '', dueDate: '', note: '' } as { assigneeId: string; dueDate: string; note: string }), ...prev[zoneId], ...patch },
    }));
  async function handleAssignZone(zoneId: string) {
    const f = zoneAssign[zoneId];
    if (!f?.assigneeId) return;
    setBusy(true);
    setActionError(null);
    try {
      await installAssignmentsApi.create({
        zoneId,
        assigneeId: f.assigneeId,
        dueDate: f.dueDate || undefined,
        note: f.note || undefined,
      });
      setZoneAssign((prev) => ({ ...prev, [zoneId]: { assigneeId: '', dueDate: '', note: '' } }));
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không giao được nhiệm vụ');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAssignment(id: string) {
    if (!confirm('Xóa nhiệm vụ này? Biển trong nhiệm vụ sẽ trở về trạng thái ngoài nhiệm vụ.')) return;
    try {
      await installAssignmentsApi.remove(id);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được nhiệm vụ');
    }
  }

  async function handleRefreshPlates(id: string) {
    setActionError(null);
    try {
      const { added } = await installAssignmentsApi.refreshPlates(id);
      alert(added > 0 ? `Đã bổ sung ${added} biển vào nhiệm vụ.` : 'Không có biển mới trong phạm vi nhiệm vụ.');
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không bổ sung được biển');
    }
  }

  async function handleComplete(id: string) {
    if (!confirm('Nghiệm thu hoàn tất nhiệm vụ thi công này?')) return;
    try {
      await installAssignmentsApi.complete(id);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không nghiệm thu được');
    }
  }

  // ---- Yêu cầu thi công lại (chọn từng biển) ----
  const [revisit, setRevisit] = useState<{
    assignment: InstallAssignment;
    plates: InstallPlateItem[];
    selected: Set<string>;
    note: string;
  } | null>(null);

  async function openRevisit(a: InstallAssignment) {
    setActionError(null);
    try {
      const plates = await installAssignmentsApi.plates(a.id);
      setRevisit({ assignment: a, plates, selected: new Set(), note: '' });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không tải được danh sách biển');
    }
  }

  async function submitRevisit(e: React.FormEvent) {
    e.preventDefault();
    if (!revisit || revisit.selected.size === 0 || !revisit.note.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await installAssignmentsApi.requestRevisit(revisit.assignment.id, {
        reviewNote: revisit.note.trim(),
        plates: [...revisit.selected].map((plateId) => ({ plateId })),
      });
      setRevisit(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu');
    } finally {
      setBusy(false);
    }
  }

  // ---- Dòng thời gian ----
  const [timeline, setTimeline] = useState<Record<string, InstallAssignment['events'] | 'loading'>>({});
  async function toggleTimeline(id: string) {
    if (timeline[id]) {
      setTimeline((t) => {
        const { [id]: _, ...rest } = t;
        return rest;
      });
      return;
    }
    setTimeline((t) => ({ ...t, [id]: 'loading' }));
    try {
      const detail = await installAssignmentsApi.get(id);
      setTimeline((t) => ({ ...t, [id]: detail.events ?? [] }));
    } catch {
      setTimeline((t) => ({ ...t, [id]: [] }));
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-fg-subtle flex items-center gap-2">
        <ButtonSpinner /> Đang tải…
      </div>
    );
  }
  if (error || !campaign) {
    return <div className="p-6 text-sm text-danger">{error ?? 'Không tìm thấy đợt thi công'}</div>;
  }

  const totals = assignments.reduce(
    (t, a) => ({
      total: t.total + (a.stats?.total ?? 0),
      installed: t.installed + (a.stats?.installed ?? 0),
      notInstalled: t.notInstalled + (a.stats?.notInstalled ?? 0),
    }),
    { total: 0, installed: 0, notInstalled: 0 },
  );
  const lengthM = routes
    .filter((r) => assignmentByRoute.has(r.id))
    .reduce((s, r) => s + (r.lengthM ?? 0), 0);
  const tiles = [
    { icon: Layers, label: 'Phân vùng', value: String(zones.length) },
    { icon: UserCheck, label: 'Nhiệm vụ', value: String(assignments.length) },
    { icon: Hammer, label: 'Biển cần gắn', value: String(totals.total) },
    { icon: Home, label: 'Đã gắn', value: `${totals.installed} / ${totals.total}` },
  ];

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 space-y-4">
      <Link href="/houses/installs" className="text-sm text-accent hover:underline font-semibold">
        ← Danh sách đợt thi công
      </Link>

      {actionError && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">{actionError}</div>
      )}

      <div className="glass p-5">
        <StatusBadge tone={CAMPAIGN_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</StatusBadge>
        <h2 className="text-lg font-bold text-fg mt-2">{campaign.name}</h2>
        {campaign.description && <p className="text-sm text-fg-muted mt-1">{campaign.description}</p>}
        <p className="text-xs text-fg-subtle mt-2">
          Tạo bởi {campaign.createdBy?.fullName ?? '—'} lúc {new Date(campaign.createdAt).toLocaleString('vi-VN')}
        </p>
        {canManage && (
          <div className="flex gap-2 mt-3">
            {campaign.status === CampaignStatus.DRAFT && (
              <Button onClick={() => handleStatusChange(CampaignStatus.ACTIVE)} className="!py-1.5 text-xs">
                Bắt đầu triển khai
              </Button>
            )}
            {campaign.status === CampaignStatus.ACTIVE && (
              <Button variant="success" onClick={() => handleStatusChange(CampaignStatus.COMPLETED)} className="!py-1.5 text-xs">
                Đánh dấu hoàn tất
              </Button>
            )}
          </div>
        )}
      </div>

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

      {canManage && (
        <form onSubmit={handleAddZone} className="glass p-4 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">+ Thêm phân vùng — Tên *</label>
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
          <Button disabled={zoneSaving}>+ Thêm</Button>
        </form>
      )}

      {/* Bản đồ: tuyến (từ 1 đợt khảo sát) + biển cần gắn; kéo cán bộ thi công thả vào tuyến để giao. */}
      <div className="glass overflow-hidden">
        <div className="px-4 py-3 bg-surface-2/50 border-b border-line flex items-center gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-sm text-fg">Bản đồ thi công</h3>
            <p className="text-xs text-fg-muted">
              {routes.length} tuyến • {assignmentByRoute.size} đã giao • {formatLength(lengthM)} • {dots.length} biển
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-fg-muted">
            {canManage && sourceId && (
              <Button
                type="button"
                variant="ghost"
                onClick={importSurveyZones}
                disabled={zoneSaving}
                title="Tạo các phân vùng thi công giống phân vùng của đợt khảo sát đã chọn"
                className="!px-2.5 !py-1 text-xs"
              >
                Nhập phân vùng
              </Button>
            )}
            <span>Tuyến từ đợt khảo sát:</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="border border-line rounded-lg px-2 py-1 bg-surface-2/60 text-fg text-xs"
            >
              {surveyCampaigns.length === 0 && <option value="">(chưa có đợt khảo sát)</option>}
              {surveyCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-4 pt-2 flex items-center gap-3 flex-wrap text-[11px] text-fg-muted">
          {[
            ['#f59e0b', 'Chờ gắn'],
            ['#10b981', 'Đã gắn'],
            ['#ef4444', 'Chưa gắn được'],
            ['#8b5cf6', 'Cần thi công lại'],
          ].map(([c, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              {label}
            </span>
          ))}
        </div>

        {canManage && routes.length > 0 && (
          <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
              Kéo cán bộ thi công thả vào tuyến để giao:
            </span>
            {installers.length === 0 && <span className="text-xs text-fg-subtle">Chưa có cán bộ thi công nào.</span>}
            {installers.map((u) => (
              <span
                key={u.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(SURVEYOR_DRAG_TYPE, u.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  setDraggingInstaller(true);
                }}
                onDragEnd={() => setDraggingInstaller(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/50 pl-1 pr-2.5 py-1 text-xs font-semibold text-fg cursor-grab active:cursor-grabbing select-none hover:border-accent/50"
              >
                <span
                  className="w-5 h-5 rounded-full grid place-items-center text-[10px] text-white"
                  style={{ background: installerColors[u.id] }}
                >
                  {u.fullName.trim()[0]?.toUpperCase()}
                </span>
                {u.fullName}
              </span>
            ))}
            {busy && <ButtonSpinner />}
          </div>
        )}

        {pending && (
          <form
            onSubmit={confirmAssign}
            className="mx-4 mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 flex flex-wrap items-end gap-3"
          >
            <p className="basis-full text-sm text-fg">
              Giao tuyến <b>{pending.route.name}</b> cho <b>{pending.installer.fullName}</b>
            </p>
            <label className="block">
              <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Phân vùng</span>
              <select
                value={pending.zoneId}
                onChange={(e) => setPending((p) => p && { ...p, zoneId: e.target.value })}
                className={FIELD_CLASS}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Hạn</span>
              <input
                type="date"
                value={pending.dueDate}
                onChange={(e) => setPending((p) => p && { ...p, dueDate: e.target.value })}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Chỉ tiêu (biển)</span>
              <input
                type="number"
                min={1}
                value={pending.targetCount}
                onChange={(e) => setPending((p) => p && { ...p, targetCount: e.target.value })}
                className={`${FIELD_CLASS} !w-32`}
              />
            </label>
            <label className="block flex-1 min-w-[160px]">
              <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Ghi chú</span>
              <input
                value={pending.note}
                onChange={(e) => setPending((p) => p && { ...p, note: e.target.value })}
                placeholder="Tùy chọn"
                className={FIELD_CLASS}
              />
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setPending(null)} className="!py-2 text-xs">
                Hủy
              </Button>
              <Button disabled={busy} className="!py-2 text-xs">
                {busy && <ButtonSpinner light />}
                Giao
              </Button>
            </div>
          </form>
        )}

        <div className={`h-[460px] relative mt-3 border-t border-line ${draggingInstaller ? 'ring-2 ring-inset ring-accent' : ''}`}>
          {routes.length === 0 && (
            <p className="absolute z-[600] top-3 left-3 right-3 text-xs bg-surface/90 border border-line rounded-lg px-3 py-2 text-fg-muted">
              Chọn đợt khảo sát có tuyến đường để giao theo tuyến. Biển cần gắn vẫn hiện trên bản đồ.
            </p>
          )}
          {/* Danh sách tuyến của đợt khảo sát đã chọn: bấm tuyến → bản đồ bay tới tuyến đó; giao việc ngay tại đây. */}
          {routeGroups.length > 0 && (
            <div className="absolute z-[600] top-14 right-3 bottom-3 w-72 sm:w-80 max-w-[85%] glass !bg-surface/85 overflow-auto">
              {routeGroups.map((g) => (
                <div key={g.id}>
                  <p className="sticky top-0 z-[1] bg-surface/90 backdrop-blur px-4 pt-3 pb-1 text-[11px] font-bold uppercase text-fg-muted">
                    {g.name}
                  </p>
                  <ul>
                    {g.routes.map((r) => {
                      const a = assignmentByRoute.get(r.id);
                      const canChange = canManage && (!a || a.status === AssignmentStatus.ASSIGNED);
                      return (
                        <li
                          key={r.id}
                          onClick={() => {
                            setSelectedRouteId(r.id);
                            setFocusNonce(Date.now());
                          }}
                          className={`px-4 py-2 cursor-pointer transition-colors ${
                            selectedRouteId === r.id ? 'bg-accent/10' : 'hover:bg-surface-2'
                          }`}
                        >
                          <p className="text-sm font-semibold text-fg truncate">{r.name}</p>
                          <p className="text-[11px] text-fg-muted">
                            {formatLength(r.lengthM)}
                            {r.street ? ` • ${r.street.name}` : ''}
                            {!r.snapped && <span className="text-warn"> • đường thẳng</span>}
                          </p>
                          {a ? (
                            <p className="text-[11px] mt-0.5 flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: installerColors[a.assigneeId] ?? '#475569' }}
                              />
                              <span className="font-semibold text-fg truncate">{a.assignee.fullName}</span>
                              <span className="text-fg-subtle shrink-0">• {ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-fg-subtle mt-0.5">Chưa giao thi công</p>
                          )}
                          {canChange && installers.length > 0 && (
                            <select
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => e.target.value && assignRoute(r.id, e.target.value)}
                              aria-label={`Giao tuyến ${r.name} cho cán bộ thi công`}
                              className="mt-1 border border-line rounded-md px-1.5 py-0.5 text-[11px] text-fg-muted bg-surface-2/60 outline-none focus:ring-2 focus:ring-accent/40"
                            >
                              <option value="">{a ? 'Đổi người…' : 'Giao cho…'}</option>
                              {installers
                                .filter((u) => u.id !== a?.assigneeId)
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.fullName}
                                  </option>
                                ))}
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <RoutePickerMap
            routes={routes}
            routeColors={routeColors}
            mutedRouteIds={mutedRouteIds}
            onDropAssignee={canManage ? assignRoute : undefined}
            drawing={false}
            draft={EMPTY_DRAFT}
            onDraftChange={NOOP}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => {
              setSelectedRouteId(id);
              setFocusNonce(Date.now());
            }}
            focusNonce={focusNonce}
            dots={dots}
          />
        </div>
      </div>

      {/* Phân vùng → nhiệm vụ */}
      <div className="space-y-4">
        {zones.length === 0 && (
          <div className="glass">
            <EmptyState text="Chưa có phân vùng nào trong đợt thi công này" />
          </div>
        )}
        {zones.map((zone) => (
          <div key={zone.id} className="glass overflow-hidden">
            <div className="px-4 py-3 bg-surface-2/50 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-fg">{zone.name}</h3>
                <p className="text-xs text-fg-muted">{zone.ward?.name ?? 'Chưa gán xã/phường'}</p>
              </div>
              {canManage && (zone._count?.assignments ?? 0) === 0 && (
                <button onClick={() => handleRemoveZone(zone.id)} className="text-danger hover:underline text-xs font-semibold">
                  Xóa phân vùng
                </button>
              )}
            </div>

            <div className="p-4 space-y-2">
              {(zone.assignments ?? []).length === 0 && (
                <p className="text-xs text-fg-subtle py-2">Chưa giao nhiệm vụ nào trong phân vùng này</p>
              )}
              {(zone.assignments ?? []).map((a) => {
                const st = a.stats;
                const done = st ? st.installed + st.notInstalled : 0;
                const pct = st && st.total > 0 ? Math.round((done / st.total) * 100) : 0;
                const open = a.status !== AssignmentStatus.COMPLETED;
                const tl = timeline[a.id];
                return (
                  <div key={a.id} className="border border-line rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg">{a.assignee.fullName}</p>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          <StatusBadge tone={ASSIGNMENT_TONE[a.status]}>{ASSIGNMENT_STATUS_LABELS[a.status]}</StatusBadge>
                          {a.route && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-accent font-semibold">
                              <RouteIcon className="w-3 h-3" /> {a.route.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-fg-subtle mt-1">
                          {a.dueDate ? `Hạn ${formatDueDate(a.dueDate)}` : 'Không đặt hạn'}
                          {a.dueDate && isOverdue(a.dueDate) && open && (
                            <span className="text-danger font-bold"> • QUÁ HẠN</span>
                          )}
                          {a.targetCount ? ` • Chỉ tiêu ${a.targetCount} biển` : ''}
                        </p>
                        {st && st.total === 0 && open && a.status !== AssignmentStatus.SUBMITTED && (
                          <p className="text-[11px] text-warn font-semibold mt-1">
                            ⚠ Nhiệm vụ chưa có biển nào trong phạm vi — biển cấp mới sẽ tự được thêm vào; hoặc bấm “Bổ sung biển” để gom ngay.
                          </p>
                        )}
                        {a.note && <p className="text-[11px] text-fg-muted mt-0.5">Ghi chú: {a.note}</p>}
                        {a.reviewNote && a.status === AssignmentStatus.NEEDS_REVISIT && (
                          <p className="text-[11px] text-danger mt-0.5">Lý do thi công lại: {a.reviewNote}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {canManage && open && a.status !== AssignmentStatus.SUBMITTED && (
                          <Button variant="ghost" onClick={() => handleRefreshPlates(a.id)} className="!px-2.5 !py-1 text-xs">
                            Bổ sung biển
                          </Button>
                        )}
                        {canManage && open && (
                          <RemindButton entityType={NotificationEntity.INSTALL_ASSIGNMENT} entityId={a.id} />
                        )}
                        {canManage && a.status === AssignmentStatus.ASSIGNED && (
                          <>
                            <select
                              value=""
                              onChange={(e) => e.target.value && reassign(a.id, e.target.value)}
                              aria-label="Đổi người thực hiện"
                              className="border border-line rounded-md px-1.5 py-1 text-xs bg-surface-2/60 text-fg-muted"
                            >
                              <option value="">Đổi người…</option>
                              {installers
                                .filter((u) => u.id !== a.assigneeId)
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.fullName}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={() => handleRemoveAssignment(a.id)}
                              className="text-danger hover:underline text-xs font-semibold"
                            >
                              Xóa
                            </button>
                          </>
                        )}
                        {canReview && a.status === AssignmentStatus.SUBMITTED && (
                          <>
                            <Button variant="success" onClick={() => handleComplete(a.id)} className="!px-2.5 !py-1 text-xs">
                              Duyệt hoàn tất
                            </Button>
                            <Button variant="danger" onClick={() => openRevisit(a)} className="!px-2.5 !py-1 text-xs">
                              Yêu cầu thi công lại
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-fg-subtle mb-1">
                        <span>
                          {st
                            ? `${st.installed} đã gắn • ${st.notInstalled} chưa gắn được • ${st.pending} chờ gắn`
                            : '—'}
                          {st && st.revisit > 0 && <span className="text-info font-semibold"> • {st.revisit} cần làm lại</span>}
                        </span>
                        <span className="tabular-nums">
                          {done}/{st?.total ?? 0} • {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <button
                      onClick={() => toggleTimeline(a.id)}
                      className="text-[11px] font-semibold text-fg-muted hover:text-accent"
                    >
                      {tl ? 'Ẩn nhật ký' : 'Xem nhật ký'}
                    </button>
                    {tl === 'loading' && <p className="text-[11px] text-fg-subtle">Đang tải…</p>}
                    {Array.isArray(tl) && (
                      <ul className="border-l border-line ml-1 pl-3 space-y-1">
                        {tl.length === 0 && <li className="text-[11px] text-fg-subtle">Chưa có sự kiện nào</li>}
                        {tl.map((ev) => (
                          <li key={ev.id} className="text-[11px] text-fg-muted">
                            <span className="font-semibold text-fg">{EVENT_LABELS[ev.action] ?? ev.action}</span>
                            {' • '}
                            {new Date(ev.createdAt).toLocaleString('vi-VN')}
                            {ev.actor ? ` • ${ev.actor.fullName}` : ''}
                            {ev.note ? ` — ${ev.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {canManage && (
                <div className="flex gap-2 items-end pt-2 flex-wrap">
                  <select
                    value={zoneAssign[zone.id]?.assigneeId ?? ''}
                    onChange={(e) => setZoneField(zone.id, { assigneeId: e.target.value })}
                    className="border border-line rounded-lg px-2 py-1.5 text-xs bg-surface-2/60 text-fg"
                  >
                    <option value="">-- Giao cả phân vùng cho cán bộ thi công --</option>
                    {installers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={zoneAssign[zone.id]?.dueDate ?? ''}
                    onChange={(e) => setZoneField(zone.id, { dueDate: e.target.value })}
                    className="border border-line rounded-lg px-2 py-1.5 text-xs bg-surface-2/60 text-fg"
                  />
                  <input
                    value={zoneAssign[zone.id]?.note ?? ''}
                    onChange={(e) => setZoneField(zone.id, { note: e.target.value })}
                    placeholder="Ghi chú (tùy chọn)"
                    className="border border-line rounded-lg px-2 py-1.5 text-xs flex-1 min-w-[140px] bg-surface-2/60 text-fg"
                  />
                  <Button
                    onClick={() => handleAssignZone(zone.id)}
                    disabled={busy || !zoneAssign[zone.id]?.assigneeId}
                    className="!px-3 !py-1.5 text-xs"
                  >
                    Giao việc
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {revisit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <form onSubmit={submitRevisit} className="glass !bg-surface/95 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h3 className="font-bold text-fg">Yêu cầu thi công lại — {revisit.assignment.assignee.fullName}</h3>
              <button type="button" onClick={() => setRevisit(null)} className="text-fg-subtle hover:text-fg text-lg">
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-fg-muted">Chọn các biển cần làm lại (biển đã gắn hoặc đã ghi nhận chưa gắn được):</p>
              <ul className="max-h-60 overflow-auto border border-line rounded-lg divide-y divide-line">
                {revisit.plates.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-surface-2/60">
                      <input
                        type="checkbox"
                        checked={revisit.selected.has(p.id)}
                        onChange={(e) =>
                          setRevisit((r) => {
                            if (!r) return r;
                            const next = new Set(r.selected);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return { ...r, selected: next };
                          })
                        }
                        className="accent-[rgb(var(--accent))]"
                      />
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: plateColor(p) }} />
                      <span className="text-fg">{plateLabel(p)}</span>
                    </label>
                  </li>
                ))}
                {revisit.plates.length === 0 && <li className="px-3 py-3 text-xs text-fg-subtle">Nhiệm vụ chưa có biển nào</li>}
              </ul>
              <textarea
                required
                value={revisit.note}
                onChange={(e) => setRevisit((r) => r && { ...r, note: e.target.value })}
                rows={2}
                placeholder="Lý do thi công lại *"
                className={FIELD_CLASS}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRevisit(null)}>
                  Hủy
                </Button>
                <Button variant="danger" disabled={busy || revisit.selected.size === 0 || !revisit.note.trim()}>
                  {busy && <ButtonSpinner light />}
                  Gửi yêu cầu ({revisit.selected.size})
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
