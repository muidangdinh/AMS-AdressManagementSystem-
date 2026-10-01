'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Street, SurveyAssignment, SurveyCampaign, SurveyRoute } from '@tayninh/shared';
import { ASSIGNMENT_STATUS_LABELS, AssignmentStatus } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { assignmentsApi, routesApi } from '@/lib/surveys-api';
import { streetsApi } from '@/lib/addresses-api';
import { formatLength } from '@/lib/routing';
import { EMPTY_DRAFT, SURVEYOR_DRAG_TYPE, type RouteDraft } from '@/components/RoutePickerMap';
import { ButtonSpinner, EmptyState, FIELD_CLASS } from '@/components/ui';

// Leaflet cần `window` nên chỉ render phía client.
const RoutePickerMap = dynamic(() => import('@/components/RoutePickerMap'), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-sm text-fg-subtle">Đang tải bản đồ…</div>,
});

/** Bảng màu dùng cho phân vùng và cho cán bộ, lặp lại khi nhiều hơn số màu. */
const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
/** Màu tuyến chưa giao khi tô theo cán bộ. */
const UNASSIGNED_COLOR = '#94a3b8';

const EMPTY_FORM = { zoneId: '', name: '', streetId: '', note: '' };

type Surveyor = { id: string; fullName: string; username: string };

/** Hộp thoại giao tuyến mở ra sau khi thả cán bộ lên tuyến chưa giao. */
interface PendingAssign {
  route: SurveyRoute;
  surveyor: Surveyor;
  dueDate: string;
  targetCount: string;
  note: string;
}

/**
 * Tuyến đường khảo sát của 1 đợt: bản đồ + danh sách tuyến theo phân vùng. Người có quyền
 * `survey:manage`:
 *   - thêm tuyến bằng cách chấm điểm đầu/cuối trên bản đồ (bám đường qua OSRM);
 *   - kéo chip cán bộ thả lên tuyến để giao nhiệm vụ theo tuyến (hoặc chọn ở ô "Giao cho…").
 * Danh sách tuyến giữ ở state riêng để thêm/xóa không phải tải lại cả trang; nhiệm vụ lấy từ
 * dữ liệu đợt (`campaign.zones[].assignments`) mà trang tải lại êm sau mỗi lần giao.
 */
export default function SurveyRoutesPanel({
  campaign,
  canManage,
  surveyors,
  onAssignmentsChanged,
}: {
  campaign: SurveyCampaign;
  canManage: boolean;
  surveyors: Surveyor[];
  /** Gọi sau khi giao/đổi người để trang tải lại đợt (danh sách nhiệm vụ bên dưới). */
  onAssignmentsChanged: () => Promise<void> | void;
}) {
  const zones = useMemo(() => campaign.zones ?? [], [campaign.zones]);
  const [routes, setRoutes] = useState<SurveyRoute[]>(() => zones.flatMap((z) => z.routes ?? []));
  const zoneColors = useMemo(
    () => Object.fromEntries(zones.map((z, i) => [z.id, PALETTE[i % PALETTE.length]])),
    [zones],
  );

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState<number | undefined>(undefined);

  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<RouteDraft>(EMPTY_DRAFT);
  const [form, setForm] = useState(EMPTY_FORM);
  const [streets, setStreets] = useState<Street[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Giao tuyến (kéo thả cán bộ) ----
  /** Nhiệm vụ gắn tuyến — mỗi tuyến tối đa 1 (API kiểm tra). */
  const assignmentByRoute = useMemo(() => {
    const m = new Map<string, SurveyAssignment>();
    for (const z of zones) for (const a of z.assignments ?? []) if (a.routeId) m.set(a.routeId, a);
    return m;
  }, [zones]);
  const surveyorColors = useMemo(
    () => Object.fromEntries(surveyors.map((u, i) => [u.id, PALETTE[i % PALETTE.length]])),
    [surveyors],
  );
  const routeCountBySurveyor = useMemo(() => {
    const m = new Map<string, number>();
    assignmentByRoute.forEach((a) => m.set(a.assigneeId, (m.get(a.assigneeId) ?? 0) + 1));
    return m;
  }, [assignmentByRoute]);

  /** Tiến độ từng cán bộ trong đợt: tổng nhà đã khảo sát / tổng chỉ tiêu (mọi nhiệm vụ của họ). */
  const statsBySurveyor = useMemo(() => {
    const m = new Map<string, { houses: number; target: number }>();
    for (const z of zones)
      for (const a of z.assignments ?? []) {
        const cur = m.get(a.assigneeId) ?? { houses: 0, target: 0 };
        cur.houses += a._count?.houses ?? 0;
        cur.target += a.targetCount ?? 0;
        m.set(a.assigneeId, cur);
      }
    return m;
  }, [zones]);

  const [colorBy, setColorBy] = useState<'assignee' | 'zone'>('assignee');
  const routeColors = useMemo(
    () =>
      Object.fromEntries(
        routes.map((r) => {
          if (colorBy === 'zone') return [r.id, zoneColors[r.zoneId] ?? UNASSIGNED_COLOR];
          const a = assignmentByRoute.get(r.id);
          return [r.id, a ? surveyorColors[a.assigneeId] ?? '#475569' : UNASSIGNED_COLOR];
        }),
      ),
    [routes, colorBy, zoneColors, assignmentByRoute, surveyorColors],
  );
  const mutedRouteIds = useMemo(
    () =>
      colorBy === 'assignee'
        ? new Set(routes.filter((r) => !assignmentByRoute.has(r.id)).map((r) => r.id))
        : undefined,
    [routes, colorBy, assignmentByRoute],
  );

  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [draggingSurveyor, setDraggingSurveyor] = useState(false);

  // Danh mục đường lọc theo xã của phân vùng đang chọn.
  const selectedZone = zones.find((z) => z.id === form.zoneId);
  useEffect(() => {
    if (!drawing || !form.zoneId) {
      setStreets([]);
      return;
    }
    streetsApi
      .list(selectedZone?.wardId ?? undefined)
      .then(setStreets)
      .catch(() => setStreets([]));
  }, [drawing, form.zoneId, selectedZone?.wardId]);

  // Esc = huỷ chấm tuyến.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelDrawing();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawing]);

  function startDrawing() {
    setError(null);
    setPendingAssign(null);
    setForm({ ...EMPTY_FORM, zoneId: zones.length === 1 ? zones[0].id : '' });
    setDraft(EMPTY_DRAFT);
    setSelectedRouteId(null);
    setDrawing(true);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function selectRoute(id: string) {
    setSelectedRouteId(id);
    setFocusNonce(Date.now());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const { start, end, result } = draft;
    if (!start || !end || !result || !form.zoneId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await routesApi.create({
        zoneId: form.zoneId,
        name: form.name.trim(),
        streetId: form.streetId || undefined,
        note: form.note.trim() || undefined,
        startLat: start[0],
        startLng: start[1],
        endLat: end[0],
        endLng: end[1],
        path: result.path,
        lengthM: Math.round(result.lengthM),
        snapped: result.snapped,
      });
      setRoutes((prev) => [...prev, created]);
      setDrawing(false);
      setDraft(EMPTY_DRAFT);
      setSelectedRouteId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được tuyến đường');
    } finally {
      setSaving(false);
    }
  }

  /** Giao tuyến cho cán bộ — dùng chung cho thả trên bản đồ và ô chọn "Giao cho…" ở danh sách. */
  async function assignRoute(routeId: string, assigneeId: string) {
    const route = routes.find((r) => r.id === routeId);
    const surveyor = surveyors.find((u) => u.id === assigneeId);
    if (!route || !surveyor) return;
    setError(null);
    setSelectedRouteId(route.id);
    const existing = assignmentByRoute.get(route.id);
    if (!existing) {
      setPendingAssign({ route, surveyor, dueDate: '', targetCount: '', note: '' });
      return;
    }
    if (existing.assigneeId === assigneeId) return;
    if (existing.status !== AssignmentStatus.ASSIGNED) {
      setError(
        `Tuyến "${route.name}" đang ở trạng thái "${ASSIGNMENT_STATUS_LABELS[existing.status]}" — không đổi người được nữa.`,
      );
      return;
    }
    if (!confirm(`Đổi người thực hiện tuyến "${route.name}" từ ${existing.assignee.fullName} sang ${surveyor.fullName}?`)) {
      return;
    }
    setAssigning(true);
    try {
      await assignmentsApi.reassign(existing.id, assigneeId);
      await onAssignmentsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được người thực hiện');
    } finally {
      setAssigning(false);
    }
  }

  async function confirmAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingAssign) return;
    const { route, surveyor, dueDate, targetCount, note } = pendingAssign;
    setAssigning(true);
    setError(null);
    try {
      await assignmentsApi.create({
        zoneId: route.zoneId,
        routeId: route.id,
        assigneeId: surveyor.id,
        dueDate: dueDate || undefined,
        targetCount: targetCount ? Number(targetCount) : undefined,
        note: note.trim() || undefined,
      });
      setPendingAssign(null);
      await onAssignmentsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không giao được tuyến');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemove(route: SurveyRoute) {
    if (!confirm(`Xóa tuyến "${route.name}"?`)) return;
    setError(null);
    try {
      await routesApi.remove(route.id);
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
      if (selectedRouteId === route.id) setSelectedRouteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được tuyến đường');
    }
  }

  const canSave = !!draft.result && !draft.computing && !!form.zoneId && !!form.name.trim() && !saving;

  return (
    <div className="glass overflow-hidden">
      <div className="px-4 py-3 bg-surface-2 border-b border-line flex items-center gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-sm text-fg">Tuyến đường khảo sát</h3>
          <p className="text-xs text-fg-muted">
            {routes.length} tuyến • {assignmentByRoute.size} đã giao • Tổng{' '}
            {formatLength(routes.reduce((s, r) => s + (r.lengthM ?? 0), 0))}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-surface border border-line p-0.5 text-[11px] font-semibold">
          {(['assignee', 'zone'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setColorBy(k)}
              className={`px-2 py-1 rounded-md transition ${
                colorBy === k ? 'bg-accent/15 text-accent shadow-glow-accent' : 'text-fg-muted hover:bg-surface-2'
              }`}
            >
              {k === 'assignee' ? 'Màu theo cán bộ' : 'Màu theo phân vùng'}
            </button>
          ))}
        </div>
        {canManage && !drawing && (
          <button
            type="button"
            onClick={startDrawing}
            disabled={zones.length === 0}
            title={zones.length === 0 ? 'Cần tạo phân vùng trước' : undefined}
            className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            + Thêm tuyến
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-danger/10 border border-danger/30 text-danger rounded-lg p-2.5 text-sm">{error}</div>
      )}

      {drawing && (
        <form onSubmit={handleSave} className="p-4 border-b border-line grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Phân vùng *</label>
            <select
              required
              value={form.zoneId}
              onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value, streetId: '' }))}
              className={FIELD_CLASS}
            >
              <option value="">-- Chọn phân vùng --</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Đường (danh mục)</label>
            <select
              value={form.streetId}
              disabled={!form.zoneId}
              onChange={(e) => {
                const streetId = e.target.value;
                const street = streets.find((s) => s.id === streetId);
                // Tên tuyến còn trống thì lấy luôn tên đường.
                setForm((f) => ({ ...f, streetId, name: f.name.trim() ? f.name : street?.name ?? '' }));
              }}
              className={FIELD_CLASS}
            >
              <option value="">-- Không liên kết --</option>
              {streets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Tên tuyến *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='vd "Đường 30/4 — đoạn chợ → cầu"'
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Ghi chú</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Tùy chọn"
              className={FIELD_CLASS}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 flex-wrap">
            <p className="text-xs text-fg-muted mr-auto">
              {!draft.start || !draft.end ? (
                'Chấm điểm đầu (A) rồi điểm cuối (B) trên bản đồ.'
              ) : draft.computing ? (
                'Đang tìm tuyến bám đường…'
              ) : draft.result ? (
                <>
                  Độ dài <b className="text-fg">{formatLength(draft.result.lengthM)}</b>
                  {!draft.result.snapped && (
                    <span className="text-warn"> • Không tìm được đường thực tế — dùng đường thẳng</span>
                  )}
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setDraft(EMPTY_DRAFT)}
              disabled={!draft.start}
              className="text-xs font-semibold text-fg-muted hover:bg-surface-2 disabled:opacity-40 px-3 py-1.5 rounded-lg"
            >
              Chấm lại
            </button>
            <button
              type="button"
              onClick={cancelDrawing}
              className="text-xs font-semibold text-fg-muted hover:bg-surface-2 px-3 py-1.5 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition inline-flex items-center gap-1.5"
            >
              {saving && <ButtonSpinner light />}
              Lưu tuyến
            </button>
          </div>
        </form>
      )}

      {pendingAssign && (
        <form
          onSubmit={confirmAssign}
          className="mx-4 mt-3 rounded-lg border border-accent/30 bg-accent/10 p-3 flex flex-wrap items-end gap-3"
        >
          <p className="basis-full text-sm text-fg">
            Giao tuyến <b>{pendingAssign.route.name}</b> cho <b>{pendingAssign.surveyor.fullName}</b>
          </p>
          <label className="block">
            <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Hạn</span>
            <input
              type="date"
              value={pendingAssign.dueDate}
              onChange={(e) => setPendingAssign((p) => p && { ...p, dueDate: e.target.value })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Chỉ tiêu (nhà)</span>
            <input
              type="number"
              min={1}
              value={pendingAssign.targetCount}
              onChange={(e) => setPendingAssign((p) => p && { ...p, targetCount: e.target.value })}
              className={`${FIELD_CLASS} !w-32`}
            />
          </label>
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Ghi chú</span>
            <input
              value={pendingAssign.note}
              onChange={(e) => setPendingAssign((p) => p && { ...p, note: e.target.value })}
              placeholder="Tùy chọn"
              className={FIELD_CLASS}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingAssign(null)}
              className="text-xs font-semibold text-fg-muted hover:bg-surface-2 px-3 py-2 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={assigning}
              className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
            >
              {assigning && <ButtonSpinner light />}
              Giao
            </button>
          </div>
        </form>
      )}

      <div className="relative mt-3 border-t border-line">
        <div className={`h-[480px] relative ${draggingSurveyor ? 'ring-2 ring-inset ring-accent' : ''}`}>
          <RoutePickerMap
            routes={routes}
            routeColors={routeColors}
            mutedRouteIds={mutedRouteIds}
            onDropAssignee={canManage ? assignRoute : undefined}
            drawing={drawing}
            draft={draft}
            onDraftChange={setDraft}
            selectedRouteId={selectedRouteId}
            onSelectRoute={selectRoute}
            focusNonce={focusNonce}
          />
        </div>
        {/* Danh sách tuyến: nổi trên bản đồ (kính mờ) ở màn lớn, xếp dưới bản đồ ở màn nhỏ. */}
        <div className="border-t border-line max-h-[360px] overflow-auto lg:absolute lg:z-[600] lg:top-14 lg:right-3 lg:bottom-3 lg:w-80 lg:max-h-none lg:border-t-0 lg:glass lg:!bg-surface/80">
          {routes.length === 0 ? (
            <EmptyState icon="🛣️" text="Chưa có tuyến đường nào" />
          ) : (
            zones
              .filter((z) => routes.some((r) => r.zoneId === z.id))
              .map((z) => (
                <div key={z.id}>
                  <p className="sticky top-0 z-[1] bg-surface/90 backdrop-blur px-4 pt-3 pb-1 text-[11px] font-bold uppercase text-fg-muted flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: zoneColors[z.id] }} />
                    {z.name}
                  </p>
                  <ul>
                    {routes
                      .filter((r) => r.zoneId === z.id)
                      .map((r) => {
                        const a = assignmentByRoute.get(r.id);
                        const canChange = canManage && (!a || a.status === AssignmentStatus.ASSIGNED);
                        return (
                          <li
                            key={r.id}
                            onClick={() => selectRoute(r.id)}
                            className={`px-4 py-2 flex items-start justify-between gap-2 cursor-pointer transition-colors ${
                              selectedRouteId === r.id ? 'bg-accent/10' : 'hover:bg-surface-2'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-fg truncate">{r.name}</p>
                              <p className="text-[11px] text-fg-muted">
                                {formatLength(r.lengthM)}
                                {r.street ? ` • ${r.street.name}` : ''}
                                {!r.snapped && <span className="text-warn"> • đường thẳng</span>}
                              </p>
                              {r.note && <p className="text-[11px] text-fg-subtle truncate">{r.note}</p>}
                              {a ? (
                                <p className="text-[11px] mt-0.5 flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: surveyorColors[a.assigneeId] ?? '#475569' }}
                                  />
                                  <span className="font-semibold text-fg truncate">{a.assignee.fullName}</span>
                                  <span className="text-fg-subtle shrink-0">• {ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                                </p>
                              ) : (
                                <p className="text-[11px] text-fg-subtle mt-0.5">Chưa giao</p>
                              )}
                              {canChange && surveyors.length > 0 && (
                                // Cách thay thế cho kéo thả (màn hình cảm ứng, bàn phím).
                                <select
                                  value=""
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => e.target.value && assignRoute(r.id, e.target.value)}
                                  aria-label={`Giao tuyến ${r.name} cho cán bộ`}
                                  className="mt-1 border border-line rounded-md px-1.5 py-0.5 text-[11px] text-fg-muted bg-surface outline-none focus:ring-2 focus:ring-accent/40"
                                >
                                  <option value="">{a ? 'Đổi người…' : 'Giao cho…'}</option>
                                  {surveyors
                                    .filter((u) => u.id !== a?.assigneeId)
                                    .map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.fullName}
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                            {canManage && !a && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemove(r);
                                }}
                                className="text-danger hover:underline text-xs font-semibold shrink-0"
                              >
                                Xóa
                              </button>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Panel cán bộ khảo sát (UI.md): chip kéo thả vào tuyến + thanh tiến độ theo chỉ tiêu. */}
      {surveyors.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
              Cán bộ khảo sát{canManage && !drawing && routes.length > 0 ? ' — kéo thả vào tuyến để giao' : ''}
            </p>
            {assigning && <ButtonSpinner />}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {surveyors.map((u) => {
              const st = statsBySurveyor.get(u.id);
              const pct = st && st.target > 0 ? Math.min(100, Math.round((st.houses / st.target) * 100)) : null;
              const draggable = canManage && !drawing && routes.length > 0;
              return (
                <div
                  key={u.id}
                  draggable={draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(SURVEYOR_DRAG_TYPE, u.id);
                    e.dataTransfer.effectAllowed = 'copy';
                    setDraggingSurveyor(true);
                  }}
                  onDragEnd={() => setDraggingSurveyor(false)}
                  title={draggable ? 'Kéo thả lên một tuyến trên bản đồ' : undefined}
                  className={`rounded-lg border border-line bg-surface-2/40 px-3 py-2 select-none transition-all duration-300 ${
                    draggable ? 'cursor-grab active:cursor-grabbing hover:border-accent/50 hover:shadow-glow-accent' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: surveyorColors[u.id], boxShadow: `0 0 10px ${surveyorColors[u.id]}` }}
                    >
                      {u.fullName.trim()[0]?.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-fg truncate">{u.fullName}</span>
                    <span className="ml-auto text-[11px] text-fg-subtle tabular-nums shrink-0" title="Số tuyến đang nhận">
                      {routeCountBySurveyor.get(u.id) ?? 0} tuyến
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-gradient"
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-fg-muted tabular-nums shrink-0">
                      {st ? `${st.houses}${st.target ? `/${st.target}` : ''} nhà` : 'Chưa nhận việc'}
                      {pct !== null ? ` • ${pct}%` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
