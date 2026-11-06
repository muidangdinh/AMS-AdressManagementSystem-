'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { HouseStatus } from '@tayninh/shared';

const HouseMap = dynamic(() => import('@/components/HouseMap'), { ssr: false });

export default function MapPickerModal({
  lat,
  lng,
  onConfirm,
  onClose,
}: {
  lat: number;
  lng: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const [point, setPoint] = useState({ lat, lng });
  const [fly] = useState({ lat, lng, nonce: 1 });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 h-14 px-3 flex items-center gap-3 border-b border-line bg-shell">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-fg-muted"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-bold">Chọn vị trí nhà</p>
          <p className="text-[11px] text-fg-subtle">Chạm vào bản đồ để đặt điểm</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 relative">
        <HouseMap
          houses={[
            {
              id: 'pick',
              latitude: point.lat,
              longitude: point.lng,
              houseNumber: '•',
              street: '',
              ownerName: '',
              status: HouseStatus.PENDING,
              qrCode: '',
            },
          ]}
          selectedHouseId="pick"
          onSelectHouse={() => {}}
          onMapClick={(nextLat, nextLng) => setPoint({ lat: nextLat, lng: nextLng })}
          flyToRequest={fly}
        />
        <div className="absolute left-3 right-3 bottom-3 z-[500] rounded-xl border border-line bg-surface/95 backdrop-blur px-3 py-2 shadow-card">
          <p className="text-[11px] text-fg-subtle">Tọa độ đã chọn</p>
          <p className="text-sm font-mono font-semibold">
            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </p>
        </div>
      </div>

      <footer className="shrink-0 p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] border-t border-line bg-shell">
        <button
          type="button"
          onClick={() => onConfirm(point.lat, point.lng)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-3 text-sm font-bold text-white"
        >
          <Check className="w-4 h-4" />
          Dùng vị trí này
        </button>
      </footer>
    </div>
  );
}
