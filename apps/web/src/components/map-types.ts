import { HouseStatus } from '@tayninh/shared';

export interface HouseMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  houseNumber: string;
  street: string;
  ownerName: string;
  status: HouseStatus;
  qrCode: string;
}

/** Yêu cầu bay tới 1 vị trí — đổi `nonce` để bắn lại flyTo dù tọa độ trùng lần trước. */
export interface FlyToRequest {
  lat: number;
  lng: number;
  nonce: number;
  /** true khi đây là vị trí GPS hiện tại của người dùng — vẽ thêm marker "vị trí của bạn". */
  myLocation?: boolean;
}

export interface HouseMapProps {
  houses: HouseMapPoint[];
  onSelectHouse: (id: string) => void;
  /** Click vào bản đồ ở nơi không có marker — dùng cho tra cứu theo tọa độ/bán kính. */
  onMapClick?: (lat: number, lng: number) => void;
  /** Chuột phải vào bản đồ — mở form thêm số nhà mới với tọa độ điền sẵn. */
  onMapRightClick?: (lat: number, lng: number) => void;
  /**
   * Điều khiển bay-tới-vị-trí bằng prop thay vì ref/useImperativeHandle:
   * component này được load qua next/dynamic({ ssr:false }), mà LoadableComponent
   * của Next không tự chuyển tiếp ref tới component forwardRef bên trong
   * (gây warning "Function components cannot be given refs"). Dùng prop
   * tránh hoàn toàn vấn đề đó — theo đúng khuyến nghị của Next.js.
   */
  flyToRequest?: FlyToRequest | null;
}

export const STATUS_COLOR: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: '#10b981',
  [HouseStatus.PENDING]: '#f59e0b',
  [HouseStatus.NEEDS_ADJUST]: '#f43f5e',
};

/** Tâm UBND xã Thạnh Hóa, tỉnh Tây Ninh (trung tâm thị trấn Thạnh Hóa cũ) — [lat, lng]. */
const THANH_HOA_CENTER: [number, number] = [10.65528, 106.18222];

/** Đọc `NEXT_PUBLIC_MAP_DEFAULT_CENTER="lat,lng"` (mỗi bản triển khai một tâm riêng); sai định dạng → bỏ qua. */
function parseCenter(raw: string | undefined): [number, number] | null {
  const [lat, lng] = (raw ?? '').split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lat, lng];
}

/** Tâm bản đồ lúc mới mở (mọi bản đồ web) — mặc định UBND xã Thạnh Hóa. */
export const DEFAULT_MAP_CENTER: [number, number] =
  parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER) ?? THANH_HOA_CENTER;
