'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { STATUS_COLOR, DEFAULT_MAP_CENTER, type HouseMapPoint, type HouseMapProps } from './map-types';
import { useAppConfig } from '@/lib/app-config';
import {
  GOONG_MAPTILES_KEY,
  findStyleTextFont,
  goongStyleUrl,
  removeLayers,
  setPoiLayersVisible,
  type GoongLayer,
} from '@/lib/goong';

const SOURCE_ID = 'houses';
const LAYER_GLOW = 'houses-glow';
const LAYER_CIRCLE = 'houses-circle';
const LAYER_LABEL = 'houses-label';

function toFeatureCollection(houses: HouseMapPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: houses.map((h) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] },
      properties: { id: h.id, houseNumber: h.houseNumber, color: STATUS_COLOR[h.status] ?? '#64748b' },
    })),
  };
}

/** Nội dung popup dựng bằng DOM + textContent — dữ liệu người dùng nhập không bao giờ bị chèn như HTML. */
function popupContent(h: HouseMapPoint): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'font-size:12px;min-width:160px;color:#0f172a';
  const line = (text: string, css: string) => {
    const el = document.createElement('div');
    el.style.cssText = css;
    el.textContent = text;
    root.appendChild(el);
  };
  line(h.street, 'font-weight:bold;color:#1d4ed8;text-transform:uppercase;font-size:10px');
  line(`Số ${h.houseNumber}`, 'font-weight:800;font-size:14px');
  line(h.ownerName, 'color:#475569;margin-top:2px');
  line(h.qrCode, 'font-family:monospace;color:#94a3b8;font-size:10px;margin-top:2px');
  return root;
}

/**
 * Bản đồ GIS hiển thị số nhà — bản Goong (MapLibre GL + style vector của Goong), chọn bằng
 * `NEXT_PUBLIC_MAP_PROVIDER=goong` (xem `HouseMap.tsx`). Khác bản Leaflet: số nhà được vẽ bằng
 * WebGL (lớp circle + symbol trên 1 nguồn GeoJSON) thay vì mỗi nhà 1 thẻ HTML, nên vẫn mượt với
 * hàng nghìn điểm. `setStyle` (đổi Giao thông ⇄ Vệ tinh) xoá mọi lớp tự thêm, nên lớp số nhà được
 * dựng lại trong `style.load`. Phải load qua next/dynamic({ ssr:false }) ở nơi gọi.
 */
export default function HouseMapGoong({
  houses,
  onSelectHouse,
  onMapClick,
  onMapRightClick,
  flyToRequest,
}: HouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const myLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const justCreatedRef = useRef(false);
  const housesRef = useRef(houses);
  const onSelectRef = useRef(onSelectHouse);
  const onMapClickRef = useRef(onMapClick);
  const onMapRightClickRef = useRef(onMapRightClick);
  const [layer, setLayerState] = useState<GoongLayer>('street');
  const [loadError, setLoadError] = useState<string | null>(null);
  // Hệ thống → Cấu hình bản đồ: ẩn icon địa điểm của nền, chỉ còn marker số nhà.
  const { config } = useAppConfig();
  const hidePoiRef = useRef(config.mapHidePoi);
  hidePoiRef.current = config.mapHidePoi;

  housesRef.current = houses;
  onSelectRef.current = onSelectHouse;
  onMapClickRef.current = onMapClick;
  onMapRightClickRef.current = onMapRightClick;

  // Khởi tạo bản đồ đúng 1 lần
  useEffect(() => {
    if (!GOONG_MAPTILES_KEY || !containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: goongStyleUrl('street'),
      center: [DEFAULT_MAP_CENTER[1], DEFAULT_MAP_CENTER[0]],
      zoom: 15,
      maxZoom: 20,
      // Tắt nút (i) ghi nguồn bản đồ mà MapLibre tự thêm ở góc dưới phải.
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Chạy cả lần nạp style đầu tiên lẫn sau mỗi lần setStyle.
    map.on('style.load', () => {
      setPoiLayersVisible(map, !hidePoiRef.current);
      removeLayers(map, [LAYER_LABEL, LAYER_CIRCLE, LAYER_GLOW], [SOURCE_ID]);
      map.addSource(SOURCE_ID, { type: 'geojson', data: toFeatureCollection(housesRef.current) });
      // Quầng sáng cùng màu dưới chấm (giống box-shadow phát sáng của bản Leaflet).
      map.addLayer({
        id: LAYER_GLOW,
        type: 'circle',
        source: SOURCE_ID,
        paint: { 'circle-radius': 20, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25, 'circle-blur': 0.8 },
      });
      map.addLayer({
        id: LAYER_CIRCLE,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.9)',
        },
      });
      const font = findStyleTextFont(map);
      if (font) {
        map.addLayer({
          id: LAYER_LABEL,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'houseNumber'],
            'text-font': font,
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': '#ffffff' },
        });
      }
    });

    map.on('error', (e) => {
      // 401/403 khi tải style/tile = sai key, nhầm loại key (API Key thay vì Maptiles Key) hoặc key bị khoá.
      const status = (e.error as { status?: number } | undefined)?.status;
      if (status === 401 || status === 403) setLoadError('Goong từ chối Maptiles Key (403) — kiểm tra key/loại key/giới hạn domain.');
    });

    map.on('click', (e: MapMouseEvent) => {
      const hit = map.getLayer(LAYER_CIRCLE)
        ? map.queryRenderedFeatures(e.point, { layers: [LAYER_CIRCLE] })[0]
        : undefined;
      if (!hit) {
        onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
        return;
      }
      const id = hit.properties?.id as string;
      const house = housesRef.current.find((h) => h.id === id);
      if (!house) return;
      onSelectRef.current(id);
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 16 })
        .setLngLat([house.longitude, house.latitude])
        .setDOMContent(popupContent(house))
        .addTo(map);
    });

    // Chuột phải: chặn menu ngữ cảnh mặc định của trình duyệt, mở form thêm số nhà thay vào đó.
    map.on('contextmenu', (e: MapMouseEvent) => {
      e.preventDefault();
      e.originalEvent.preventDefault();
      onMapRightClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('mouseenter', LAYER_CIRCLE, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', LAYER_CIRCLE, () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;
    justCreatedRef.current = true;

    // MapLibre chỉ tự theo dõi resize của cửa sổ, không theo khung chứa (sidebar co giãn…).
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Đồng bộ dữ liệu số nhà — chỉ thay data của nguồn, không dựng lại lớp.
  useEffect(() => {
    const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(houses));
    popupRef.current?.remove();
  }, [houses]);

  // Admin đổi cấu hình lúc bản đồ đang mở → áp ngay (chưa nạp xong style thì `style.load` tự áp).
  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) setPoiLayersVisible(map, !config.mapHidePoi);
  }, [config.mapHidePoi]);

  // Bay tới vị trí khi flyToRequest đổi (click danh sách trong chế độ bản đồ)
  useEffect(() => {
    const justCreated = justCreatedRef.current;
    justCreatedRef.current = false;
    const map = mapRef.current;
    if (!flyToRequest || !map) return;
    const center: [number, number] = [flyToRequest.lng, flyToRequest.lat];
    if (justCreated) map.jumpTo({ center, zoom: 18 });
    else map.flyTo({ center, zoom: 18, duration: 1000 });

    if (flyToRequest.myLocation) {
      myLocationMarkerRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb, 0 2px 6px rgba(0,0,0,0.4);';
      el.title = 'Vị trí của bạn';
      myLocationMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(map);
    }
  }, [flyToRequest]);

  function setLayer(type: GoongLayer) {
    const map = mapRef.current;
    if (!map || type === layer) return;
    // diff:false — nạp lại style hoàn toàn để chắc chắn `style.load` chạy và dựng lại lớp số nhà.
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loadError && (
        <div className="absolute top-3 left-3 z-[500] max-w-xs rounded-lg bg-danger/90 px-3 py-2 text-xs font-semibold text-white shadow">
          {loadError}
        </div>
      )}
      <div className="absolute top-3 right-3 z-[500] glass !rounded-lg !bg-surface/80 p-1 flex space-x-1 text-xs">
        <button
          onClick={() => setLayer('street')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${layer === 'street' ? 'bg-brand text-white' : 'text-fg-muted hover:bg-surface-2'
            }`}
        >
          Giao thông
        </button>
        <button
          onClick={() => setLayer('satellite')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${layer === 'satellite' ? 'bg-brand text-white' : 'text-fg-muted hover:bg-surface-2'
            }`}
        >
          Vệ tinh
        </button>
      </div>
    </div>
  );
}
