'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SurveyRoute } from '@tayninh/shared';
import { TAYNINH_CENTER } from './map-types';
import { snapRoute, type LatLng, type RouteResult } from '@/lib/routing';
import { createSatelliteLayer, createStreetLayer } from '@/lib/map-tiles';

/** Tuyến vừa chấm, chưa lưu. `result` null khi mới có điểm A hoặc đang tính tuyến. */
export interface RouteDraft {
  start: LatLng | null;
  end: LatLng | null;
  result: RouteResult | null;
  computing: boolean;
}

/** Điểm đánh dấu thêm trên bản đồ (vd biển cần gắn của đợt thi công). */
export interface MapDot {
  id: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
}

export const EMPTY_DRAFT: RouteDraft = { start: null, end: null, result: null, computing: false };

/** Kiểu dữ liệu HTML5 drag mang id cán bộ — chip cán bộ ở `SurveyRoutesPanel` đặt giá trị này. */
export const SURVEYOR_DRAG_TYPE = 'application/x-surveyor-id';

/** Khoảng cách tối đa (pixel màn hình) từ con trỏ tới tuyến để tính là "thả trúng tuyến". */
const DROP_TOLERANCE_PX = 18;

export interface RoutePickerMapProps {
  routes: SurveyRoute[];
  /** Màu từng tuyến (routeId → màu) — panel tự tính theo phân vùng hoặc theo cán bộ. */
  routeColors: Record<string, string>;
  /** Tuyến vẽ nét đứt dù đã bám đường (vd tuyến chưa giao khi tô màu theo cán bộ). */
  mutedRouteIds?: Set<string>;
  /** Thả chip cán bộ lên 1 tuyến. Bỏ trống = không nhận kéo thả. */
  onDropAssignee?: (routeId: string, assigneeId: string) => void;
  /** Đang ở chế độ chấm tuyến mới. */
  drawing: boolean;
  draft: RouteDraft;
  onDraftChange: (draft: RouteDraft) => void;
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  /** Đổi `nonce` để zoom tới tuyến đang chọn. */
  focusNonce?: number;
  /** Chấm tròn bổ sung (biển cần gắn…) — chỉ hiển thị, không tương tác. */
  dots?: MapDot[];
}

const DRAFT_COLOR = '#2563eb';

function pointIcon(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);color:#fff;font:700 11px/20px system-ui;text-align:center">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/**
 * Bản đồ tuyến đường khảo sát (Leaflet + tile Esri như `HouseMapLeaflet`). Hiển thị các tuyến
 * đã lưu; ở chế độ `drawing` thì click lần 1 = điểm đầu, lần 2 = điểm cuối, rồi định tuyến
 * bám đường. Kéo 2 điểm để tính lại. Phải load qua next/dynamic({ ssr:false }).
 */
export default function RoutePickerMap({
  routes,
  routeColors,
  mutedRouteIds,
  onDropAssignee,
  drawing,
  draft,
  onDraftChange,
  selectedRouteId,
  onSelectRoute,
  focusNonce,
  dots,
}: RoutePickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const dotsLayerRef = useRef<L.LayerGroup | null>(null);
  const [layer, setLayerState] = useState<'street' | 'satellite'>('street');
  const fittedRef = useRef(false);
  // Kéo thả cán bộ: tuyến đang được rê qua + dòng gợi ý tạm khi thả trượt.
  const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);

  // Giữ giá trị mới nhất cho các handler Leaflet đăng ký 1 lần.
  const drawingRef = useRef(drawing);
  const draftRef = useRef(draft);
  const onDraftChangeRef = useRef(onDraftChange);
  const onSelectRouteRef = useRef(onSelectRoute);
  drawingRef.current = drawing;
  draftRef.current = draft;
  onDraftChangeRef.current = onDraftChange;
  onSelectRouteRef.current = onSelectRoute;
  const routingAbortRef = useRef<AbortController | null>(null);

  /** Định tuyến A→B; huỷ request cũ nếu người dùng kéo điểm liên tục. */
  function compute(start: LatLng, end: LatLng) {
    routingAbortRef.current?.abort();
    const controller = new AbortController();
    routingAbortRef.current = controller;
    onDraftChangeRef.current({ start, end, result: null, computing: true });
    snapRoute(start, end, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) onDraftChangeRef.current({ start, end, result, computing: false });
      })
      .catch(() => {});
  }
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(TAYNINH_CENTER, 14);
    const streetLayer = createStreetLayer().addTo(map);
    const satelliteLayer = createSatelliteLayer();
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      const p: LatLng = [e.latlng.lat, e.latlng.lng];
      const d = draftRef.current;
      if (!d.start) onDraftChangeRef.current({ ...d, start: p });
      else if (!d.end) computeRef.current(d.start, p);
    });

    routesLayerRef.current = L.layerGroup().addTo(map);
    dotsLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;

    return () => {
      routingAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Con trỏ hình chữ thập khi đang chấm tuyến.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.style.cursor = drawing ? 'crosshair' : '';
  }, [drawing]);

  // Vẽ các tuyến đã lưu.
  useEffect(() => {
    const map = mapRef.current;
    const group = routesLayerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    for (const r of routes) {
      const hovered = r.id === dragOverRouteId;
      const selected = r.id === selectedRouteId || hovered;
      const color = routeColors[r.id] ?? '#475569';
      // Quầng sáng (UI.md — tuyến phát sáng): 1 nét rộng mờ cùng màu nằm dưới nét chính.
      L.polyline(r.path, { color, weight: (hovered ? 9 : selected ? 7 : 4) + 10, opacity: 0.18, interactive: false }).addTo(group);
      const line = L.polyline(r.path, {
        color,
        weight: hovered ? 9 : selected ? 7 : 4,
        opacity: selected ? 1 : 0.8,
        dashArray: r.snapped && !mutedRouteIds?.has(r.id) ? undefined : '8 8',
      })
        .bindTooltip(hovered ? `Thả để giao: ${r.name}` : r.name, { sticky: true, permanent: hovered })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRouteRef.current(r.id);
        })
        .addTo(group);
      if (selected) line.bringToFront();
      L.circleMarker([r.startLat, r.startLng], { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(group);
      L.circleMarker([r.endLat, r.endLng], { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(group);
    }
    // Lần đầu có dữ liệu: canh khung vừa mọi tuyến.
    if (!fittedRef.current && routes.length > 0) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds(routes.flatMap((r) => r.path)), { padding: [40, 40], maxZoom: 17 });
    }
  }, [routes, selectedRouteId, routeColors, mutedRouteIds, dragOverRouteId]);

  // Chấm biển (hiển thị phía trên tuyến).
  useEffect(() => {
    const group = dotsLayerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const d of dots ?? []) {
      L.circleMarker([d.lat, d.lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: d.color,
        fillOpacity: 1,
        interactive: true,
      })
        .bindTooltip(d.title)
        .addTo(group);
    }
  }, [dots]);

  // Zoom tới tuyến đang chọn (khi bấm từ danh sách).
  useEffect(() => {
    const map = mapRef.current;
    const r = routes.find((x) => x.id === selectedRouteId);
    if (!map || !r || focusNonce === undefined) return;
    map.fitBounds(L.latLngBounds(r.path), { padding: [50, 50], maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Vẽ tuyến nháp + 2 điểm A/B kéo được.
  useEffect(() => {
    const group = draftLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!drawing) return;
    if (draft.result) {
      L.polyline(draft.result.path, {
        color: DRAFT_COLOR,
        weight: 5,
        dashArray: draft.result.snapped ? undefined : '8 8',
      }).addTo(group);
    } else if (draft.start && draft.end) {
      L.polyline([draft.start, draft.end], { color: DRAFT_COLOR, weight: 3, opacity: 0.4, dashArray: '4 8' }).addTo(group);
    }
    const addPoint = (p: LatLng, which: 'start' | 'end') => {
      const m = L.marker(p, {
        icon: pointIcon(which === 'start' ? '#16a34a' : '#dc2626', which === 'start' ? 'A' : 'B'),
        draggable: true,
      }).addTo(group);
      m.on('dragend', () => {
        const ll = m.getLatLng();
        const moved: LatLng = [ll.lat, ll.lng];
        const d = draftRef.current;
        const start = which === 'start' ? moved : d.start;
        const end = which === 'end' ? moved : d.end;
        if (start && end) computeRef.current(start, end);
        else onDraftChangeRef.current({ ...d, start });
      });
    };
    if (draft.start) addPoint(draft.start, 'start');
    if (draft.end) addPoint(draft.end, 'end');
  }, [drawing, draft]);

  /** Tuyến gần con trỏ nhất (tính theo pixel màn hình), trong ngưỡng `DROP_TOLERANCE_PX`. */
  function routeAtEvent(e: React.DragEvent): string | null {
    const map = mapRef.current;
    if (!map) return null;
    const p = map.mouseEventToLayerPoint(e.nativeEvent);
    let best: { id: string; d: number } | null = null;
    for (const r of routes) {
      const pts = r.path.map((ll) => map.latLngToLayerPoint(ll));
      for (let i = 1; i < pts.length; i++) {
        const d = L.LineUtil.pointToSegmentDistance(p, pts[i - 1], pts[i]);
        if (d <= DROP_TOLERANCE_PX && (!best || d < best.d)) best = { id: r.id, d };
      }
    }
    return best?.id ?? null;
  }

  const acceptsDrop = (e: React.DragEvent) =>
    !!onDropAssignee && !drawing && e.dataTransfer.types.includes(SURVEYOR_DRAG_TYPE);

  function handleDragOver(e: React.DragEvent) {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const id = routeAtEvent(e);
    e.dataTransfer.dropEffect = id ? 'copy' : 'none';
    if (id !== dragOverRouteId) setDragOverRouteId(id);
  }

  function handleDrop(e: React.DragEvent) {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const routeId = routeAtEvent(e);
    const assigneeId = e.dataTransfer.getData(SURVEYOR_DRAG_TYPE);
    setDragOverRouteId(null);
    if (routeId && assigneeId) onDropAssignee?.(routeId, assigneeId);
    else setDropHint('Thả đúng lên một tuyến đường để giao');
  }

  useEffect(() => {
    if (!dropHint) return;
    const t = setTimeout(() => setDropHint(null), 2500);
    return () => clearTimeout(t);
  }, [dropHint]);

  function setLayer(type: 'street' | 'satellite') {
    const map = mapRef.current;
    if (!map || !streetLayerRef.current || !satelliteLayerRef.current) return;
    if (type === 'satellite') {
      map.removeLayer(streetLayerRef.current);
      map.addLayer(satelliteLayerRef.current);
    } else {
      map.removeLayer(satelliteLayerRef.current);
      map.addLayer(streetLayerRef.current);
    }
    setLayerState(type);
  }

  const hint = !drawing
    ? dropHint
    : !draft.start
      ? 'Bấm lên bản đồ để chấm điểm đầu (A)'
      : !draft.end
        ? 'Bấm để chấm điểm cuối (B)'
        : draft.computing
          ? 'Đang tìm tuyến bám đường…'
          : 'Kéo điểm A/B để điều chỉnh tuyến';

  return (
    <div
      className="relative h-full w-full"
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        // Chỉ xoá khi rời hẳn khung bản đồ (dragleave cũng bắn khi đi qua phần tử con).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverRouteId(null);
      }}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="h-full w-full" />
      {hint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-shell/90 text-fg border border-line text-xs font-semibold px-3 py-1.5 rounded-full shadow-md pointer-events-none whitespace-nowrap">
          {hint}
        </div>
      )}
      <div className="absolute top-3 right-3 z-[500] glass !rounded-lg !bg-surface/80 p-1 flex space-x-1 text-xs">
        <button
          type="button"
          onClick={() => setLayer('street')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${
            layer === 'street' ? 'bg-brand text-white' : 'text-fg-muted hover:bg-surface-2'
          }`}
        >
          Giao thông
        </button>
        <button
          type="button"
          onClick={() => setLayer('satellite')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${
            layer === 'satellite' ? 'bg-brand text-white' : 'text-fg-muted hover:bg-surface-2'
          }`}
        >
          Vệ tinh
        </button>
      </div>
    </div>
  );
}
