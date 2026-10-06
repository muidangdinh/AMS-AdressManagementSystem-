'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATUS_COLOR, TAYNINH_CENTER, type HouseMapProps } from './map-types';
import { createSatelliteLayer, createStreetLayer } from '@/lib/map-tiles';

/**
 * Bản đồ GIS hiển thị số nhà (Phase 3 — I) — bản Leaflet dùng tile REST công khai của Esri
 * ArcGIS (`server.arcgisonline.com`), KHÔNG cần đăng ký/API key/thẻ thanh toán nào — dùng
 * làm phương án dự phòng khi chưa/không muốn kích hoạt billing Google Maps (xem
 * `HouseMap.tsx`, wrapper chọn provider qua `NEXT_PUBLIC_MAP_PROVIDER`). Phải load qua
 * next/dynamic({ ssr:false }) ở nơi gọi vì Leaflet cần `window`/`document`.
 */
export default function HouseMapLeaflet({
  houses,
  onSelectHouse,
  onMapClick,
  onMapRightClick,
  flyToRequest,
}: HouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  // true từ lúc map vừa tạo tới lần chạy đầu của effect flyTo — request đến ngay lúc mount thì
  // đặt view thẳng (không animation), vì flyTo trên map chưa có tile nào dễ để lại nền trống.
  const justCreatedRef = useRef(false);
  const onSelectRef = useRef(onSelectHouse);
  const onMapClickRef = useRef(onMapClick);
  const onMapRightClickRef = useRef(onMapRightClick);
  const [layer, setLayerState] = useState<'street' | 'satellite'>('street');

  onSelectRef.current = onSelectHouse;
  onMapClickRef.current = onMapClick;
  onMapRightClickRef.current = onMapRightClick;

  // Khởi tạo bản đồ đúng 1 lần
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      TAYNINH_CENTER,
      15,
    );

    const streetLayer = createStreetLayer().addTo(map);
    const satelliteLayer = createSatelliteLayer();

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    // Chuột phải: chặn menu ngữ cảnh mặc định của trình duyệt, mở form thêm số nhà thay vào đó.
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent);
      onMapRightClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;
    justCreatedRef.current = true;

    // Leaflet không tự biết khi container đổi kích thước (map mount lúc layout chưa ổn định,
    // sidebar/menu co giãn…) — nếu không invalidateSize thì chỉ tải tile cho vùng cũ, nền bị xám.
    const frame = requestAnimationFrame(() => map.invalidateSize());
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Đồng bộ marker mỗi khi danh sách số nhà thay đổi.
  // Luôn xóa sạch rồi tạo lại toàn bộ (thay vì diff tăng dần): ở React 18
  // Strict Mode (dev), effect khởi tạo map chạy 2 lần (mount giả lập →
  // cleanup → mount thật), phá hủy rồi tạo lại instance map. Nếu chỉ diff
  // theo id, markersRef sẽ giữ marker cũ trỏ vào map ĐÃ BỊ HỦY và code sẽ
  // tưởng nhầm marker "đã tồn tại" nên bỏ qua .addTo(map mới) — marker biến
  // mất trên map thật dù dữ liệu vẫn đúng. Rebuild toàn bộ tránh triệt để lỗi này.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => {
      try {
        m.remove();
      } catch {
        // Marker có thể đã gắn vào 1 map instance khác đã bị hủy — bỏ qua an toàn.
      }
    });
    markersRef.current = {};

    houses.forEach((h) => {
      const color = STATUS_COLOR[h.status] ?? '#64748b';
      const icon = L.divIcon({
        className: 'custom-house-marker',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:white;font-weight:bold;font-size:11px;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 0 2px rgba(11,17,32,0.55),0 0 14px ${color};">${h.houseNumber}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([h.latitude, h.longitude], { icon }).addTo(map);
      marker.on('click', () => onSelectRef.current(h.id));
      marker.bindPopup(
        `<div style="font-size:12px;min-width:160px">` +
        `<div style="font-weight:bold;color:#1d4ed8;text-transform:uppercase;font-size:10px">${h.street}</div>` +
        `<div style="font-weight:800;font-size:14px">Số ${h.houseNumber}</div>` +
        `<div style="color:#475569;margin-top:2px">${h.ownerName}</div>` +
        `<div style="font-family:monospace;color:#94a3b8;font-size:10px;margin-top:2px">${h.qrCode}</div>` +
        `</div>`,
      );
      markersRef.current[h.id] = marker;
    });
  }, [houses]);

  // Bay tới vị trí khi flyToRequest đổi (click danh sách trong chế độ bản đồ)
  useEffect(() => {
    const justCreated = justCreatedRef.current;
    justCreatedRef.current = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    if (!flyToRequest || !mapRef.current) return;
    if (justCreated) {
      // Map vừa mount (vd tới từ Dashboard): khung có thể chưa có kích thước ổn định nên phải
      // invalidateSize trước khi đặt view, và đặt lại 1 lần nữa sau khi layout xong — nếu không
      // Leaflet tính vùng tile theo kích thước sai → nền xám, không tải tile.
      const map = mapRef.current;
      const { lat, lng } = flyToRequest;
      // Zoom tới nhà bị chặn theo lớp đang bật (đường phố hết dữ liệu sau zoom 17 → ô xám).
      const zoom = Math.min(18, map.getMaxZoom());
      map.invalidateSize();
      map.setView([lat, lng], zoom, { animate: false });
      settleTimer = setTimeout(() => {
        if (mapRef.current !== map) return;
        map.invalidateSize();
        map.setView([lat, lng], zoom, { animate: false });
      }, 150);
    } else {
      mapRef.current.flyTo([flyToRequest.lat, flyToRequest.lng], Math.min(18, mapRef.current.getMaxZoom()), {
        animate: true,
        duration: 1,
      });
    }

    if (flyToRequest.myLocation) {
      myLocationMarkerRef.current?.remove();
      const icon = L.divIcon({
        className: 'my-location-marker',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb, 0 2px 6px rgba(0,0,0,0.4);"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([flyToRequest.lat, flyToRequest.lng], {
        icon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current);
      marker.bindTooltip('Vị trí của bạn', { direction: 'top' });
      myLocationMarkerRef.current = marker;
    }
    return () => {
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [flyToRequest]);

  function setLayer(type: 'street' | 'satellite') {
    const map = mapRef.current;
    if (!map || !streetLayerRef.current || !satelliteLayerRef.current) return;
    if (type === 'satellite') {
      map.removeLayer(streetLayerRef.current);
      map.addLayer(satelliteLayerRef.current);
    } else {
      map.removeLayer(satelliteLayerRef.current);
      map.addLayer(streetLayerRef.current);
      // Lớp đường phố chỉ có dữ liệu tới zoom 17 — đang zoom sâu hơn (từ vệ tinh) thì lùi lại để khỏi xám.
      if (map.getZoom() > map.getMaxZoom()) map.setZoom(map.getMaxZoom());
    }
    setLayerState(type);
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
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
