'use client';

import { useEffect, useState } from 'react';
import type { Ward } from '@tayninh/shared';
import { wardsApi } from '@/lib/addresses-api';
import { useWorkingWard } from '@/lib/working-ward';

/**
 * TN-03 — bộ chọn "xã đang làm việc" trên web (góp ý khách hàng 11/09/2026).
 * Đặt ngay trên thanh header (`houses/layout.tsx`) — không chôn vào menu sâu,
 * vì khách hàng xác nhận có cán bộ phụ trách nhiều xã, cần đổi xã nhanh.
 */
export default function WardSelector() {
  const { ward, chooseWard } = useWorkingWard();
  const [wards, setWards] = useState<Ward[]>([]);

  useEffect(() => {
    wardsApi.list().then(setWards).catch(() => {});
  }, []);

  return (
    <select
      value={ward?.id ?? ''}
      onChange={(e) => {
        const selected = wards.find((w) => w.id === e.target.value);
        chooseWard(selected ? { id: selected.id, name: selected.name } : null);
      }}
      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none cursor-pointer max-w-[9.5rem] sm:max-w-[13rem]"
      title="Xã đang làm việc"
    >
      <option value="" className="text-slate-900">
        Tất cả xã (Toàn tỉnh)
      </option>
      {wards.map((w) => (
        <option key={w.id} value={w.id} className="text-slate-900">
          Xã {w.name}
        </option>
      ))}
    </select>
  );
}
