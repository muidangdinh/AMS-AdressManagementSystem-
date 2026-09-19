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

/** Trung tâm mặc định: TP. Tây Ninh — dùng khi chưa có điểm nào để canh giữa. */
export const TAYNINH_CENTER: [number, number] = [11.3151, 106.098];
