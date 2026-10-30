'use client';

import RoutePickerMapGoong from './RoutePickerMapGoong';
import RoutePickerMapLeaflet from './RoutePickerMapLeaflet';
import type { RoutePickerMapProps } from './route-map-types';

export * from './route-map-types';

/**
 * Bản đồ tuyến đường khảo sát/thi công — wrapper chọn implementation theo
 * `NEXT_PUBLIC_MAP_PROVIDER` giống `HouseMap.tsx`: `goong` → `RoutePickerMapGoong` (MapLibre +
 * nền Goong), còn lại → `RoutePickerMapLeaflet` (Esri). Bản Google chưa có tuyến nên dùng Leaflet.
 */
export default function RoutePickerMap(props: RoutePickerMapProps) {
  if (process.env.NEXT_PUBLIC_MAP_PROVIDER === 'goong') return <RoutePickerMapGoong {...props} />;
  return <RoutePickerMapLeaflet {...props} />;
}
