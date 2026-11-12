'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Street, SurveyRoute, Ward } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { useConfirmDialog } from '@/components/ConfirmDialogProvider';
import { streetsApi, wardsApi } from '@/lib/addresses-api';
import { formatLength } from '@/lib/routing';
import { routesApi } from '@/lib/surveys-api';
import {
  EMPTY_DRAFT,
  draftFromRoute,
  isRouteGeometryLocked,
  type RouteDraft,
} from '@/components/route-map-types';
import RouteDraftBar from '@/components/RouteDraftBar';
import { ButtonSpinner, EmptyState, FIELD_CLASS } from '@/components/ui';

// Bản đồ cần `window` nên chỉ render phía client.
const RoutePickerMap = dynamic(() => import('@/components/RoutePickerMap'), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-sm text-fg-subtle">Đang tải bản đồ…</div>,
});

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
const INACTIVE_COLOR = '#94a3b8';
const EMPTY_FORM = { name: '', wardId: '', streetId: '', note: '' };

type StatusFilter = 'active' | 'inactive' | 'all';

/**
 * Kho tuyến đường dùng chung, nằm trong phân hệ "Quản lý tuyến đường". Đợt khảo sát chọn tuyến từ đây hoặc
 * tạo tuyến mới (cũng vào đây), và cùng đọc 1 dữ liệu nên 2 nơi luôn khớp nhau. Tuyến đã từng được giao
 * thì không sửa được đường đi, chỉ nhân bản; tuyến đang dùng thì ngừng sử dụng thay vì xóa.
 */
export default function RouteCatalogPanel() {
  const { confirm, prompt: confirmText } = useConfirmDialog();
  const [routes, setRoutes] = useState<SurveyRoute[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wardFilter, setWardFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState<number | undefined>(undefined);

  /** null = không soạn; 'new' = tuyến mới; còn lại = id tuyến đang sửa. */
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [draft, setDraft] = useState<RouteDraft>(EMPTY_DRAFT);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, w] = await Promise.all([routesApi.list(), wardsApi.list()]);
      setRoutes(r);
      setWards(w);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách tuyến đường');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Đường trong danh mục lọc theo xã đang chọn trong form.
  useEffect(() => {
    if (!editing) return;
    streetsApi
      .list(form.wardId || undefined)
      .then(setStreets)
      .catch(() => setStreets([]));
  }, [editing, form.wardId]);

  const visibleRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return routes.filter(
      (r) =>
        (statusFilter === 'all' || r.isActive === (statusFilter === 'active')) &&
        (!wardFilter || r.wardId === wardFilter) &&
        (!term || r.name.toLowerCase().includes(term)),
    );
  }, [routes, statusFilter, wardFilter, search]);

  const wardColors = useMemo(
    () => Object.fromEntries(wards.map((w, i) => [w.id, PALETTE[i % PALETTE.length]])),
    [wards],
  );
  const routeColors = useMemo(
    () =>
      Object.fromEntries(
        visibleRoutes.map((r) => [r.id, r.isActive ? (wardColors[r.wardId ?? ''] ?? '#475569') : INACTIVE_COLOR]),
      ),
    [visibleRoutes, wardColors],
  );
  const mutedRouteIds = useMemo(
    () => new Set(visibleRoutes.filter((r) => !r.isActive).map((r) => r.id)),
    [visibleRoutes],
  );

  const editingRoute = editing && editing !== 'new' ? routes.find((r) => r.id === editing) : undefined;
  const geometryLocked = !!editingRoute && isRouteGeometryLocked(editingRoute);

  function startNew() {
    setError(null);
    setEditing('new');
    setForm({ ...EMPTY_FORM, wardId: wardFilter });
    setDraft(EMPTY_DRAFT);
    setSelectedRouteId(null);
  }

  function startEdit(route: SurveyRoute) {
    setError(null);
    setEditing(route.id);
    setForm({
      name: route.name,
      wardId: route.wardId ?? '',
      streetId: route.streetId ?? '',
      note: route.note ?? '',
    });
    setDraft(draftFromRoute(route));
    selectRoute(route.id);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function selectRoute(id: string) {
    setSelectedRouteId(id);
    setFocusNonce(Date.now());
  }

  function replaceRoute(updated: SurveyRoute) {
    setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { start, end, result } = draft;
      const geometry =
        !geometryLocked && start && end && result
          ? {
              startLat: start[0],
              startLng: start[1],
              endLat: end[0],
              endLng: end[1],
              path: result.path,
              lengthM: Math.round(result.lengthM),
              snapped: result.snapped,
            }
          : undefined;
      if (editing === 'new') {
        if (!geometry) return;
        const created = await routesApi.create({
          name: form.name.trim(),
          wardId: form.wardId || undefined,
          streetId: form.streetId || undefined,
          note: form.note.trim() || undefined,
          ...geometry,
        });
        setRoutes((prev) => [...prev, created]);
        setSelectedRouteId(created.id);
      } else if (editing) {
        const updated = await routesApi.update(editing, {
          name: form.name.trim(),
          wardId: form.wardId,
          streetId: form.streetId,
          note: form.note.trim(),
          ...geometry,
        });
        replaceRoute(updated);
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được tuyến đường');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(route: SurveyRoute) {
    setError(null);
    try {
      const copy = await routesApi.duplicate(route.id);
      setRoutes((prev) => [...prev, copy]);
      startEdit(copy);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không nhân bản được tuyến');
    }
  }

  async function handleToggleActive(route: SurveyRoute) {
    setError(null);
    try {
      replaceRoute(await routesApi.update(route.id, { isActive: !route.isActive }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không cập nhật được tuyến');
    }
  }

  async function handleRemove(route: SurveyRoute) {
    if (!(await confirm(`Xóa tuyến "${route.name}" khỏi kho? Thao tác này không thể hoàn tác.`))) return;
    const confirmation = await confirmText('Để xác nhận, nhập chính xác:', `DELETE ${route.name}`);
    if (confirmation === null) return;
    setError(null);
    try {
      await routesApi.remove(route.id, confirmation);
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
      if (selectedRouteId === route.id) setSelectedRouteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được tuyến');
    }
  }

  const canSave =
    !saving &&
    !!form.name.trim() &&
    !draft.computing &&
    (geometryLocked || !!(draft.start && draft.end && draft.result));

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-fg-subtle text-sm py-10">
        <ButtonSpinner /> Đang tải…
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      <div className="px-4 py-3 bg-surface-2 border-b border-line flex items-center gap-3 flex-wrap">
        <div className="mr-auto">
          <h3 className="font-bold text-sm text-fg">Kho tuyến đường</h3>
          <p className="text-xs text-fg-muted">
            {visibleRoutes.length} tuyến • Tổng {formatLength(visibleRoutes.reduce((s, r) => s + (r.lengthM ?? 0), 0))} •
            Dùng chung cho các đợt khảo sát
          </p>
        </div>
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          aria-label="Lọc theo xã/phường"
          className={`${FIELD_CLASS} !w-44`}
        >
          <option value="">Mọi xã/phường</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Lọc theo trạng thái"
          className={`${FIELD_CLASS} !w-40`}
        >
          <option value="active">Đang sử dụng</option>
          <option value="inactive">Ngừng sử dụng</option>
          <option value="all">Tất cả</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên tuyến…"
          aria-label="Tìm tên tuyến"
          className={`${FIELD_CLASS} !w-44`}
        />
        {!editing && (
          <button
            type="button"
            onClick={startNew}
            className="bg-brand hover:bg-brand/90 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            + Thêm tuyến
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-danger/10 border border-danger/30 text-danger rounded-lg p-2.5 text-sm">{error}</div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="p-4 border-b border-line grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Xã/phường</label>
            <select
              value={form.wardId}
              onChange={(e) => setForm((f) => ({ ...f, wardId: e.target.value, streetId: '' }))}
              className={FIELD_CLASS}
            >
              <option value="">-- Chưa xác định --</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Đường (danh mục)</label>
            <select
              value={form.streetId}
              onChange={(e) => {
                const streetId = e.target.value;
                const street = streets.find((s) => s.id === streetId);
                // Tên tuyến còn trống thì lấy luôn tên đường.
                setForm((f) => ({ ...f, streetId, name: f.name.trim() ? f.name : (street?.name ?? '') }));
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
            <label className="block text-[11px] font-bold text-fg-muted uppercase mb-1">Ghi chú</label>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Tùy chọn"
              className={FIELD_CLASS}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <RouteDraftBar
              draft={draft}
              geometryLocked={geometryLocked}
              saving={saving}
              canSave={canSave}
              saveLabel={editing === 'new' ? 'Lưu tuyến' : 'Cập nhật tuyến'}
              onReset={() => setDraft(EMPTY_DRAFT)}
              onCancel={cancelEdit}
            />
          </div>
        </form>
      )}

      <div className="relative">
        <div className="h-[520px] relative">
          <RoutePickerMap
            routes={visibleRoutes}
            routeColors={routeColors}
            mutedRouteIds={mutedRouteIds}
            drawing={!!editing && !geometryLocked}
            draft={draft}
            onDraftChange={setDraft}
            selectedRouteId={selectedRouteId}
            onSelectRoute={selectRoute}
            focusNonce={focusNonce}
          />
        </div>
        <div className="border-t border-line max-h-[360px] overflow-auto lg:absolute lg:z-[600] lg:top-14 lg:right-3 lg:bottom-3 lg:w-80 lg:max-h-none lg:border-t-0 lg:glass lg:!bg-surface/80">
          {visibleRoutes.length === 0 ? (
            <EmptyState icon="🛣️" text="Chưa có tuyến đường nào" />
          ) : (
            <ul>
              {visibleRoutes.map((r) => {
                const locked = isRouteGeometryLocked(r);
                const zoneCount = r._count?.zoneLinks ?? 0;
                const inUse = zoneCount > 0 || locked;
                return (
                  <li
                    key={r.id}
                    onClick={() => selectRoute(r.id)}
                    className={`px-4 py-2 cursor-pointer transition-colors ${
                      selectedRouteId === r.id ? 'bg-accent/10' : 'hover:bg-surface-2'
                    }`}
                  >
                    <p className="text-sm font-semibold text-fg truncate">{r.name}</p>
                    <p className="text-[11px] text-fg-muted">
                      {formatLength(r.lengthM)}
                      {r.ward ? ` • ${r.ward.name}` : ''}
                      {!r.snapped && <span className="text-warn"> • đường thẳng</span>}
                      {!r.isActive && <span className="text-warn"> • ngừng sử dụng</span>}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {zoneCount > 0 ? `Dùng ở ${zoneCount} phân vùng` : 'Chưa dùng ở đợt nào'}
                      {locked ? ' • đã giao, khóa đường đi' : ''}
                    </p>
                    {!editing && (
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => startEdit(r)} className="text-accent hover:underline">
                          Sửa
                        </button>
                        <button type="button" onClick={() => handleDuplicate(r)} className="text-accent hover:underline">
                          Nhân bản
                        </button>
                        <button type="button" onClick={() => handleToggleActive(r)} className="text-fg-muted hover:underline">
                          {r.isActive ? 'Ngừng sử dụng' : 'Dùng lại'}
                        </button>
                        {!inUse && (
                          <button type="button" onClick={() => handleRemove(r)} className="text-danger hover:underline">
                            Xóa
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
