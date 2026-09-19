'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';
import { STATUS_COLOR, TAYNINH_CENTER, type HouseMapProps } from './map-types';

const TAYNINH_CENTER_OBJ = { lat: TAYNINH_CENTER[0], lng: TAYNINH_CENTER[1] };

/** Mảng rỗng khai báo NGOÀI component — `useJsApiLoader` cảnh báo/re-init script nếu prop
 * `libraries` đổi tham chiếu mỗi lần render. */
const GOOGLE_MAPS_LIBRARIES: Libraries = [];

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

/** SVG chấm tròn viền trắng theo màu trạng thái — dùng làm icon marker, số nhà hiển thị qua `label`. */
function buildMarkerIcon(color: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">` +
    `<circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2" />` +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(28, 28),
    anchor: new google.maps.Point(14, 14),
  };
}

/**
 * Bản đồ GIS hiển thị số nhà (Phase 3 — I) — bản Google Maps JavaScript API
 * (`@react-google-maps/api`). Cần `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` VÀ billing account
 * Google Cloud đã kích hoạt (xem `apps/web/.env`) — chọn provider này bằng
 * `NEXT_PUBLIC_MAP_PROVIDER=google` (xem `HouseMap.tsx`, wrapper chọn provider).
 */
export default function HouseMapGoogle({
  houses,
  onSelectHouse,
  onMapClick,
  onMapRightClick,
  flyToRequest,
}: HouseMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [layer, setLayer] = useState<'street' | 'satellite'>('street');
  const [activeHouseId, setActiveHouseId] = useState<string | null>(null);

  const onMapClickRef = useRef(onMapClick);
  const onMapRightClickRef = useRef(onMapRightClick);
  onMapClickRef.current = onMapClick;
  onMapRightClickRef.current = onMapRightClick;

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    setActiveHouseId(null);
    if (e.latLng) onMapClickRef.current?.(e.latLng.lat(), e.latLng.lng());
  }, []);

  const handleMapRightClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) onMapRightClickRef.current?.(e.latLng.lat(), e.latLng.lng());
  }, []);

  // Bay tới vị trí khi flyToRequest đổi (click danh sách trong chế độ bản đồ)
  useEffect(() => {
    if (!flyToRequest || !mapRef.current) return;
    mapRef.current.panTo({ lat: flyToRequest.lat, lng: flyToRequest.lng });
    mapRef.current.setZoom(18);
  }, [flyToRequest]);

  function toggleLayer(type: 'street' | 'satellite') {
    mapRef.current?.setMapTypeId(type === 'satellite' ? 'satellite' : 'roadmap');
    setLayer(type);
  }

  const activeHouse = houses.find((h) => h.id === activeHouseId) ?? null;

  return (
    <div className="relative h-full w-full">
      {!apiKey && (
        <div className="h-full w-full flex items-center justify-center text-center text-sm text-slate-400 p-6">
          Chưa cấu hình <code className="mx-1 font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{' '}
          — xem hướng dẫn lấy key trong <code className="mx-1 font-mono text-xs">apps/web/.env</code>.
        </div>
      )}

      {apiKey && loadError && (
        <div className="h-full w-full flex items-center justify-center text-center text-sm text-rose-500 p-6">
          Không tải được Google Maps — kiểm tra API key và kết nối mạng.
        </div>
      )}

      {apiKey && !loadError && !isLoaded && (
        <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
          Đang tải bản đồ…
        </div>
      )}

      {apiKey && isLoaded && (
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={TAYNINH_CENTER_OBJ}
          zoom={15}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          onRightClick={handleMapRightClick}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
            clickableIcons: false,
            mapTypeId: 'roadmap',
          }}
        >
          {houses.map((h) => (
            <MarkerF
              key={h.id}
              position={{ lat: h.latitude, lng: h.longitude }}
              icon={buildMarkerIcon(STATUS_COLOR[h.status] ?? '#64748b')}
              label={{ text: h.houseNumber, color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
              onClick={() => {
                setActiveHouseId(h.id);
                onSelectHouse(h.id);
              }}
            />
          ))}

          {activeHouse && (
            <InfoWindowF
              position={{ lat: activeHouse.latitude, lng: activeHouse.longitude }}
              onCloseClick={() => setActiveHouseId(null)}
            >
              <div style={{ fontSize: 12, minWidth: 160 }}>
                <div style={{ fontWeight: 'bold', color: '#1d4ed8', textTransform: 'uppercase', fontSize: 10 }}>
                  {activeHouse.street}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Số {activeHouse.houseNumber}</div>
                <div style={{ color: '#475569', marginTop: 2 }}>{activeHouse.ownerName}</div>
                <div style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                  {activeHouse.qrCode}
                </div>
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      )}

      <div className="absolute top-3 right-3 z-[500] bg-white rounded-lg shadow-md p-1 border border-slate-200 flex space-x-1 text-xs">
        <button
          onClick={() => toggleLayer('street')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${layer === 'street' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          Giao thông
        </button>
        <button
          onClick={() => toggleLayer('satellite')}
          className={`px-2.5 py-1.5 rounded font-semibold transition ${layer === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
          Vệ tinh
        </button>
      </div>
    </div>
  );
}
