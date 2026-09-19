'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { PublicHouseSummary } from '@tayninh/shared';
import { BUILDING_TYPE_LABELS, HOUSE_STATUS_LABELS, HouseStatus } from '@tayninh/shared';
import { ApiError, getApiUrl } from '@/lib/api';
import { fetchPublicHouse } from '@/lib/cases-api';

const STATUS_BADGE: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [HouseStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
  [HouseStatus.NEEDS_ADJUST]: 'bg-rose-100 text-rose-800 border-rose-200',
};

/**
 * Tra cứu công khai bằng mã QR trên biển số nhà (Phase 10 — XI.11.6).
 * KHÔNG cần đăng nhập — nằm ngoài layout `/houses` (không có auth guard).
 * Chỉ hiển thị thông tin không nhạy cảm, xem `housesService.findPublicSummary()`.
 */
export default function PublicLookupPage() {
  const params = useParams<{ id: string }>();
  const houseId = params.id;
  const apiUrl = getApiUrl();

  const [house, setHouse] = useState<PublicHouseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicHouse(houseId)
      .then(setHouse)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tra cứu được'))
      .finally(() => setLoading(false));
  }, [houseId]);

  return (
    <div className="min-h-screen bg-app-shell flex items-center justify-center p-4 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-blue-100/60 blur-3xl"
      />

      <div className="w-full max-w-sm bg-white/90 backdrop-blur rounded-2xl shadow-soft border border-slate-200/70 overflow-hidden relative">
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="w-11 h-11 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-soft mb-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-5.5 h-5.5 text-white">
              <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-base font-bold text-slate-900">Tây Ninh GIS</h1>
          <p className="text-xs text-slate-500 mt-0.5">Tra cứu số nhà công khai</p>
        </div>

        <div className="px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
              <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
              Đang tra cứu…
            </div>
          )}
          {!loading && error && (
            <div className="text-center py-8">
              <p className="text-sm text-rose-600">
                {error === 'Không tìm thấy hồ sơ số nhà'
                  ? 'Không tìm thấy hồ sơ số nhà này.'
                  : error}
              </p>
            </div>
          )}
          {!loading && house && (
            <div className="space-y-4">
              <div className="flex justify-center pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${apiUrl}/api/houses/${house.id}/qrcode.png`}
                    alt="Mã QR"
                    className="w-28 h-28"
                  />
                </div>
              </div>
              <div className="text-center">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_BADGE[house.status]}`}
                >
                  {HOUSE_STATUS_LABELS[house.status]}
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 mt-2">
                  Số {house.houseNumber}
                </h2>
                <p className="text-sm text-slate-600">
                  {house.street}, {house.ward}
                  {house.district ? `, ${house.district}` : ''}
                </p>
              </div>
              <div className="border-t border-slate-100 pt-3 text-sm text-slate-500 space-y-1">
                <p>
                  Loại công trình:{' '}
                  <span className="font-semibold text-slate-700">
                    {BUILDING_TYPE_LABELS[house.buildingType]}
                  </span>
                </p>
                <p className="font-mono text-xs text-slate-400">{house.qrCode}</p>
              </div>
              <p className="text-[11px] text-slate-400 text-center pt-2">
                Đây là kết quả tra cứu công khai — không hiển thị thông tin chủ hộ.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
