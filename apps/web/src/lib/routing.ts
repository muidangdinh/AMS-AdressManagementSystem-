/**
 * Định tuyến giữa 2 điểm cho tuyến đường khảo sát — gọi OSRM (`NEXT_PUBLIC_ROUTING_URL`,
 * mặc định máy chủ demo công khai, chỉ để thử). Lỗi/timeout/không tìm được đường → trả
 * về đường thẳng nối 2 điểm (`snapped: false`) để người dùng vẫn lưu được tuyến.
 */

export type LatLng = [number, number];

export interface RouteResult {
  /** Polyline [[lat,lng],...], luôn bắt đầu ở điểm A và kết thúc ở điểm B. */
  path: LatLng[];
  /** Độ dài (mét). */
  lengthM: number;
  /** true = bám đường thực tế; false = đường thẳng dự phòng. */
  snapped: boolean;
}

const ROUTING_URL = (process.env.NEXT_PUBLIC_ROUTING_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
const ROUTING_TIMEOUT_MS = 8000;

/** Khoảng cách mặt cầu giữa 2 điểm (mét). */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function straightLine(a: LatLng, b: LatLng): RouteResult {
  return { path: [a, b], lengthM: haversineM(a, b), snapped: false };
}

export async function snapRoute(a: LatLng, b: LatLng, signal?: AbortSignal): Promise<RouteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    // OSRM nhận toạ độ theo thứ tự lng,lat.
    const url = `${ROUTING_URL}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return straightLine(a, b);
    const data = (await res.json()) as {
      code: string;
      routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
    if (!route || route.geometry.coordinates.length < 2) return straightLine(a, b);
    const snappedPath = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng);
    // OSRM bắt điểm vào mặt đường gần nhất — nối thêm 2 điểm đã chấm ở 2 đầu để tuyến
    // hiển thị đúng vị trí người dùng chọn.
    return { path: [a, ...snappedPath, b], lengthM: route.distance, snapped: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    return straightLine(a, b);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function formatLength(m?: number | null): string {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
