'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type CircleLayerSpecification,
  type GeoJSONSource,
  type LineLayerSpecification,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_MAP_CENTER } from './map-types';
import { snapRoute, type LatLng } from '@/lib/routing';
import { useAppConfig } from '@/lib/app-config';
import {
  GOONG_MAPTILES_KEY,
  goongStyleUrl,
  removeLayers,
  setPoiLayersVisible,
  type GoongLayer,
} from '@/lib/goong';
import {
  DRAFT_COLOR,
  DROP_TOLERANCE_PX,
  SURVEYOR_DRAG_TYPE,
  type RoutePickerMapProps,
} from './route-map-types';

const SRC_ROUTES = 'routes';
const SRC_ENDS = 'route-ends';
const SRC_DOTS = 'dots';
const SRC_DRAFT = 'draft';
const LAYER_ROUTES_GLOW = 'routes-glow';
const LAYER_ROUTES_SOLID = 'routes-solid';
const LAYER_ROUTES_DASHED = 'routes-dashed';
const LAYER_ENDS = 'route-ends';
const LAYER_DOTS = 'dots';
const LAYER_DRAFT_SOLID = 'draft-solid';
const LAYER_DRAFT_DASHED = 'draft-dashed';
const ROUTE_LAYERS = [LAYER_ROUTES_SOLID, LAYER_ROUTES_DASHED];
const ALL_LAYERS = [
  LAYER_DRAFT_DASHED,
  LAYER_DRAFT_SOLID,
  LAYER_DOTS,
  LAYER_ENDS,
  LAYER_ROUTES_DASHED,
  LAYER_ROUTES_SOLID,
  LAYER_ROUTES_GLOW,
];
const ALL_SOURCES = [SRC_ROUTES, SRC_ENDS, SRC_DOTS, SRC_DRAFT];

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
/** [lat,lng] (cách lưu của tuyến) → [lng,lat] (thứ tự MapLibre/GeoJSON). */
const lngLat = (p: LatLng): [number, number] => [p[1], p[0]];

function pointElement(color: string, label: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `width:26px;height:26px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);color:#fff;font:700 11px/20px system-ui;text-align:center;cursor:grab`;
  el.textContent = label;
  return el;
}

/** Khoảng cách (pixel) từ điểm p tới đoạn thẳng ab. */
function pointToSegmentDistance(p: maplibregl.Point, a: maplibregl.Point, b: maplibregl.Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Bản đồ tuyến đường khảo sát — bản Goong (MapLibre GL), cùng props/hành vi với
 * `RoutePickerMapLeaflet`: hiển thị tuyến đã lưu, chấm tuyến mới A→B (định tuyến bám đường, kéo
 * A/B để tính lại), kéo thả chip cán bộ lên tuyến để giao. Tuyến/điểm/chấm biển vẽ bằng lớp
 * WebGL trên nguồn GeoJSON; `setStyle` xoá các lớp đó nên `style.load` dựng lại từ props mới
 * nhất. Phải load qua next/dynamic({ ssr:false }).
 */
export default function RoutePickerMapGoong({
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const draftMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [layer, setLayerState] = useState<GoongLayer>('street');
  const fittedRef = useRef(false);
  // Kéo thả cán bộ: tuyến đang được rê qua + dòng gợi ý tạm khi thả trượt.
  const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  // Hệ thống → Cấu hình bản đồ: ẩn icon địa điểm của nền, chỉ còn tuyến/điểm của hệ thống.
  const { config } = useAppConfig();
  const hidePoiRef = useRef(config.mapHidePoi);
  hidePoiRef.current = config.mapHidePoi;

  // Giá trị mới nhất cho các handler MapLibre đăng ký 1 lần và cho lần dựng lại lớp sau setStyle.
  const latest = useRef({ routes, routeColors, mutedRouteIds, dots, drawing, draft, selectedRouteId, dragOverRouteId });
  latest.current = { routes, routeColors, mutedRouteIds, dots, drawing, draft, selectedRouteId, dragOverRouteId };
  const onDraftChangeRef = useRef(onDraftChange);
  const onSelectRouteRef = useRef(onSelectRoute);
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

  function setSourceData(id: string, features: Feature[]) {
    (mapRef.current?.getSource(id) as GeoJSONSource | undefined)?.setData(collection(features));
  }

  function syncRoutes() {
    const { routes: rs, routeColors: colors, mutedRouteIds: muted, selectedRouteId: sel, dragOverRouteId: over } =
      latest.current;
    const lines: Feature[] = [];
    const ends: Feature[] = [];
    for (const r of rs) {
      const hovered = r.id === over;
      const selected = r.id === sel || hovered;
      const color = colors[r.id] ?? '#475569';
      lines.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: r.path.map(lngLat) },
        properties: {
          id: r.id,
          name: r.name,
          color,
          width: hovered ? 9 : selected ? 7 : 4,
          opacity: selected ? 1 : 0.8,
          dashed: !(r.snapped && !muted?.has(r.id)),
          // Tuyến đang chọn vẽ đè lên trên (tương đương bringToFront của Leaflet).
          sortKey: selected ? 1 : 0,
        },
      });
      for (const p of [[r.startLat, r.startLng], [r.endLat, r.endLng]] as LatLng[]) {
        ends.push({ type: 'Feature', geometry: { type: 'Point', coordinates: lngLat(p) }, properties: { color } });
      }
    }
    setSourceData(SRC_ROUTES, lines);
    setSourceData(SRC_ENDS, ends);
  }

  function syncDots() {
    setSourceData(
      SRC_DOTS,
      (latest.current.dots ?? []).map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: { color: d.color, title: d.title },
      })),
    );
  }

  function syncDraftLine() {
    const { drawing: isDrawing, draft: d } = latest.current;
    const features: Feature[] = [];
    if (isDrawing && d.result) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: d.result.path.map(lngLat) },
        properties: { dashed: !d.result.snapped, width: 5, opacity: 1 },
      });
    } else if (isDrawing && d.start && d.end) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [lngLat(d.start), lngLat(d.end)] },
        properties: { dashed: true, width: 3, opacity: 0.4 },
      });
    }
    setSourceData(SRC_DRAFT, features);
  }

  const syncRef = useRef({ syncRoutes, syncDots, syncDraftLine });
  syncRef.current = { syncRoutes, syncDots, syncDraftLine };

  function baseCursor() {
    return latest.current.drawing ? 'crosshair' : '';
  }

  function showHoverPopup(lngLatPos: maplibregl.LngLatLike, text: string) {
    const map = mapRef.current;
    if (!map) return;
    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
    }
    hoverPopupRef.current.setLngLat(lngLatPos).setText(text).addTo(map);
  }

  function hideHoverPopup() {
    hoverPopupRef.current?.remove();
  }

  useEffect(() => {
    if (!GOONG_MAPTILES_KEY || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: goongStyleUrl('street'),
      center: [DEFAULT_MAP_CENTER[1], DEFAULT_MAP_CENTER[0]],
      zoom: 14,
      maxZoom: 20,
      // Tắt nút (i) ghi nguồn bản đồ mà MapLibre tự thêm ở góc dưới phải.
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('style.load', () => {
      setPoiLayersVisible(map, !hidePoiRef.current);
      removeLayers(map, ALL_LAYERS, ALL_SOURCES);
      for (const id of ALL_SOURCES) map.addSource(id, { type: 'geojson', data: collection([]) });
      const lineLayout: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' };
      // Quầng sáng (UI.md — tuyến phát sáng): 1 nét rộng mờ cùng màu nằm dưới nét chính.
      map.addLayer({
        id: LAYER_ROUTES_GLOW,
        type: 'line',
        source: SRC_ROUTES,
        layout: lineLayout,
        paint: { 'line-color': ['get', 'color'], 'line-width': ['+', ['get', 'width'], 10], 'line-opacity': 0.18 },
      });
      const routePaint: LineLayerSpecification['paint'] = {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      };
      map.addLayer({
        id: LAYER_ROUTES_SOLID,
        type: 'line',
        source: SRC_ROUTES,
        filter: ['!', ['get', 'dashed']],
        layout: { ...lineLayout, 'line-sort-key': ['get', 'sortKey'] },
        paint: routePaint,
      });
      map.addLayer({
        id: LAYER_ROUTES_DASHED,
        type: 'line',
        source: SRC_ROUTES,
        filter: ['get', 'dashed'],
        layout: { 'line-sort-key': ['get', 'sortKey'] },
        paint: { ...routePaint, 'line-dasharray': [2, 2] },
      });
      const dotPaint = (radius: number): CircleLayerSpecification['paint'] => ({
        'circle-radius': radius,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      });
      map.addLayer({ id: LAYER_ENDS, type: 'circle', source: SRC_ENDS, paint: dotPaint(5) });
      map.addLayer({ id: LAYER_DOTS, type: 'circle', source: SRC_DOTS, paint: dotPaint(6) });
      const draftPaint: LineLayerSpecification['paint'] = {
        'line-color': DRAFT_COLOR,
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity'],
      };
      map.addLayer({
        id: LAYER_DRAFT_SOLID,
        type: 'line',
        source: SRC_DRAFT,
        filter: ['!', ['get', 'dashed']],
        layout: lineLayout,
        paint: draftPaint,
      });
      map.addLayer({
        id: LAYER_DRAFT_DASHED,
        type: 'line',
        source: SRC_DRAFT,
        filter: ['get', 'dashed'],
        paint: { ...draftPaint, 'line-dasharray': [2, 2] },
      });
      syncRef.current.syncRoutes();
      syncRef.current.syncDots();
      syncRef.current.syncDraftLine();
    });

    map.on('click', (e: MapMouseEvent) => {
      // Bấm trúng tuyến = chọn tuyến (không chấm điểm), giống stopPropagation ở bản Leaflet.
      const hasRouteLayers = ROUTE_LAYERS.every((id) => map.getLayer(id));
      const hit = hasRouteLayers ? map.queryRenderedFeatures(e.point, { layers: ROUTE_LAYERS })[0] : undefined;
      if (hit) {
        onSelectRouteRef.current(hit.properties?.id as string);
        return;
      }
      if (!latest.current.drawing) return;
      const p: LatLng = [e.lngLat.lat, e.lngLat.lng];
      const d = latest.current.draft;
      if (!d.start) onDraftChangeRef.current({ ...d, start: p });
      else if (!d.end) computeRef.current(d.start, p);
    });

    // Tooltip tên tuyến / tên biển khi rê chuột (bản Leaflet dùng bindTooltip).
    for (const id of ROUTE_LAYERS) {
      map.on('mousemove', id, (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (latest.current.dragOverRouteId) return;
        showHoverPopup(e.lngLat, String(e.features?.[0]?.properties?.name ?? ''));
      });
      map.on('mouseleave', id, () => {
        map.getCanvas().style.cursor = baseCursor();
        hideHoverPopup();
      });
    }
    map.on('mousemove', LAYER_DOTS, (e) => {
      showHoverPopup(e.lngLat, String(e.features?.[0]?.properties?.title ?? ''));
    });
    map.on('mouseleave', LAYER_DOTS, hideHoverPopup);

    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      routingAbortRef.current?.abort();
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      hoverPopupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin đổi cấu hình lúc bản đồ đang mở → áp ngay (chưa nạp xong style thì `style.load` tự áp).
  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) setPoiLayersVisible(map, !config.mapHidePoi);
  }, [config.mapHidePoi]);

  // Con trỏ hình chữ thập khi đang chấm tuyến.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = drawing ? 'crosshair' : '';
  }, [drawing]);

  // Vẽ các tuyến đã lưu.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncRoutes();
    // Lần đầu có dữ liệu: canh khung vừa mọi tuyến.
    if (!fittedRef.current && routes.length > 0) {
      fittedRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      for (const r of routes) for (const p of r.path) bounds.extend(lngLat(p));
      map.fitBounds(bounds, { padding: 40, maxZoom: 17, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedRouteId, routeColors, mutedRouteIds, dragOverRouteId]);

  // Chấm biển (hiển thị phía trên tuyến).
  useEffect(() => {
    syncDots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots]);

  // Zoom tới tuyến đang chọn (khi bấm từ danh sách).
  useEffect(() => {
    const map = mapRef.current;
    const r = routes.find((x) => x.id === selectedRouteId);
    if (!map || !r || focusNonce === undefined) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of r.path) bounds.extend(lngLat(p));
    map.fitBounds(bounds, { padding: 50, maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Vẽ tuyến nháp + 2 điểm A/B kéo được (marker DOM — không bị xoá khi đổi style).
  useEffect(() => {
    syncDraftLine();
    const map = mapRef.current;
    draftMarkersRef.current.forEach((m) => m.remove());
    draftMarkersRef.current = [];
    if (!map || !drawing) return;
    const addPoint = (p: LatLng, which: 'start' | 'end') => {
      const marker = new maplibregl.Marker({
        element: pointElement(which === 'start' ? '#16a34a' : '#dc2626', which === 'start' ? 'A' : 'B'),
        draggable: true,
      })
        .setLngLat(lngLat(p))
        .addTo(map);
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        const moved: LatLng = [ll.lat, ll.lng];
        const d = latest.current.draft;
        const start = which === 'start' ? moved : d.start;
        const end = which === 'end' ? moved : d.end;
        if (start && end) computeRef.current(start, end);
        else onDraftChangeRef.current({ ...d, start });
      });
      draftMarkersRef.current.push(marker);
    };
    if (draft.start) addPoint(draft.start, 'start');
    if (draft.end) addPoint(draft.end, 'end');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, draft]);

  /** Vị trí con trỏ (pixel trong khung bản đồ) của 1 sự kiện kéo thả HTML5. */
  function eventPoint(e: React.DragEvent): maplibregl.Point | null {
    const map = mapRef.current;
    if (!map) return null;
    const rect = map.getContainer().getBoundingClientRect();
    return new maplibregl.Point(e.clientX - rect.left, e.clientY - rect.top);
  }

  /** Tuyến gần con trỏ nhất (tính theo pixel màn hình), trong ngưỡng `DROP_TOLERANCE_PX`. */
  function routeAtEvent(e: React.DragEvent): string | null {
    const map = mapRef.current;
    const p = eventPoint(e);
    if (!map || !p) return null;
    let best: { id: string; d: number } | null = null;
    for (const r of routes) {
      const pts = r.path.map((ll) => map.project(lngLat(ll)));
      for (let i = 1; i < pts.length; i++) {
        const d = pointToSegmentDistance(p, pts[i - 1], pts[i]);
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
    const p = eventPoint(e);
    const route = routes.find((r) => r.id === id);
    if (route && p && mapRef.current) showHoverPopup(mapRef.current.unproject(p), `Thả để giao: ${route.name}`);
    else hideHoverPopup();
  }

  function handleDrop(e: React.DragEvent) {
    if (!acceptsDrop(e)) return;
    e.preventDefault();
    const routeId = routeAtEvent(e);
    const assigneeId = e.dataTransfer.getData(SURVEYOR_DRAG_TYPE);
    setDragOverRouteId(null);
    hideHoverPopup();
    if (routeId && assigneeId) onDropAssignee?.(routeId, assigneeId);
    else setDropHint('Thả đúng lên một tuyến đường để giao');
  }

  useEffect(() => {
    if (!dropHint) return;
    const t = setTimeout(() => setDropHint(null), 2500);
    return () => clearTimeout(t);
  }, [dropHint]);

  function setLayer(type: GoongLayer) {
    const map = mapRef.current;
    if (!map || type === layer) return;
    // diff:false — nạp lại style hoàn toàn để chắc chắn `style.load` chạy và dựng lại các lớp tuyến.
    map.setStyle(goongStyleUrl(type), { diff: false });
    setLayerState(type);
  }

  if (!GOONG_MAPTILES_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center text-sm text-fg-subtle p-6">
        Chưa cấu hình <code className="mx-1 font-mono text-xs">NEXT_PUBLIC_GOONG_MAPTILES_KEY</code> — xem{' '}
        <code className="mx-1 font-mono text-xs">apps/web/.env</code>.
      </div>
    );
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
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragOverRouteId(null);
          hideHoverPopup();
        }
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
