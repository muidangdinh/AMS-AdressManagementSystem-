'use client';

import HouseMapGoogle from './HouseMapGoogle';
import HouseMapGoong from './HouseMapGoong';
import HouseMapLeaflet from './HouseMapLeaflet';
import type { HouseMapProps } from './map-types';

export type { HouseMapPoint, FlyToRequest } from './map-types';

/**
 * Bản đồ GIS hiển thị số nhà (Phase 3 — I) — wrapper chọn implementation qua
 * `NEXT_PUBLIC_MAP_PROVIDER`:
 *   - `google` → `HouseMapGoogle` (Google Maps JS API — cần key + billing Google Cloud
 *     đã kích hoạt, xem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` trong `apps/web/.env`).
 *   - `goong` → `HouseMapGoong` (MapLibre GL + style vector Goong — cần
 *     `NEXT_PUBLIC_GOONG_MAPTILES_KEY`, xem `lib/goong.ts`).
 *   - còn lại (mặc định, kể cả bỏ trống) → `HouseMapLeaflet` (Esri ArcGIS công khai,
 *     KHÔNG cần key/thẻ thanh toán — dùng để demo ngay trong lúc chưa kích hoạt billing
 *     Google, hoặc không muốn dùng Google).
 * Đổi provider chỉ cần sửa 1 dòng trong `.env`, không cần sửa code.
 */
export default function HouseMap(props: HouseMapProps) {
  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER;
  if (provider === 'google') return <HouseMapGoogle {...props} />;
  if (provider === 'goong') return <HouseMapGoong {...props} />;
  return <HouseMapLeaflet {...props} />;
}
