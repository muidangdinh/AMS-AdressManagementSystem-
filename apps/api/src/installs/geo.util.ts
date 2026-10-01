/**
 * Khoảng cách ngắn nhất (mét) từ 1 điểm tới đường gấp khúc [[lat,lng],...]. Phép chiếu phẳng xấp xỉ
 * quanh điểm — đủ chính xác ở phạm vi vài km. Bản sao của `distanceToPathM` trong packages/shared
 * (API không import shared lúc runtime).
 */
export function distanceToPathM(lat: number, lng: number, path: [number, number][]): number {
  if (path.length === 0) return Infinity;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const toXY = ([pLat, pLng]: [number, number]): [number, number] => [
    (pLng - lng) * mPerDegLng,
    (pLat - lat) * mPerDegLat,
  ];
  if (path.length === 1) {
    const [x, y] = toXY(path[0]);
    return Math.hypot(x, y);
  }
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = toXY(path[i - 1]);
    const [bx, by] = toXY(path[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
