'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HouseSummary } from '@tayninh/shared';
import { ApiError, apiFetch, getApiUrl } from '@/lib/api';

/**
 * Trang in tem QR số nhà (Phase 5 — IV. "Quản lý in biển số", mức đơn giản).
 * Khổ tem thật (kích thước biển vật lý, loại vật liệu...) thuộc phân hệ IV
 * đầy đủ — nằm ngoài phạm vi MVP. Trang này chỉ in đơn giản 1 tem A6-ish
 * đủ dùng cho thí điểm; điều chỉnh @page bên dưới nếu đổi khổ giấy/tem thật.
 */
export default function HouseLabelPage() {
  const params = useParams<{ id: string }>();
  const apiUrl = getApiUrl();
  const [house, setHouse] = useState<HouseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<HouseSummary>(`/api/houses/${params.id}`)
      .then(setHouse)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ'));
  }, [params.id]);

  return (
    <div className="min-h-full bg-app-shell flex flex-col items-center py-10 px-4 print:bg-white print:py-0">
      <style>{`
        @page {
          size: 100mm 70mm;
          margin: 5mm;
        }
      `}</style>

      <div className="print:hidden flex gap-2 mb-6">
        <a
          href={`/houses`}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
        >
          ← Quay lại
        </a>
        <button
          onClick={() => window.print()}
          disabled={!house}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition shadow-soft"
        >
          In ngay
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm print:hidden">
          {error}
        </div>
      )}

      {!house && !error && (
        <div className="flex items-center gap-2 text-slate-400 text-sm print:hidden">
          <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          Đang tải…
        </div>
      )}

      {house && (
        <div className="bg-white border-2 border-slate-800 rounded-xl shadow-lg p-6 w-[380px] print:w-full print:shadow-none print:border-black">
          <div className="text-center border-b-2 border-slate-800 pb-2 mb-3">
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              Tỉnh Tây Ninh
            </p>
            <p className="text-xs font-semibold text-slate-600">SỐ NHÀ</p>
          </div>

          <div className="text-center mb-3">
            <p className="text-5xl font-extrabold text-slate-900 leading-none">
              {house.houseNumber}
            </p>
            <p className="text-base font-semibold text-slate-700 mt-1">{house.street}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {house.ward}
              {house.district ? ` • ${house.district}` : ''}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 border-t-2 border-slate-800 pt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${apiUrl}/api/houses/${house.id}/qrcode.png`}
              alt="Mã QR số nhà"
              className="w-24 h-24"
            />
            <p className="font-mono text-xs text-slate-500">{house.qrCode}</p>
          </div>
        </div>
      )}

      {house && (
        <a
          href={`/lookup/${house.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="print:hidden mt-4 text-xs text-blue-600 hover:underline"
        >
          Xem trang tra cứu công khai →
        </a>
      )}
    </div>
  );
}
