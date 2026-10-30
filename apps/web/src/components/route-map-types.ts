import type { SurveyRoute } from '@tayninh/shared';
import type { LatLng, RouteResult } from '@/lib/routing';

// Kiểu & hằng số dùng chung cho mọi bản RoutePickerMap (Leaflet / Goong) và nơi gọi.

/** Tuyến vừa chấm, chưa lưu. `result` null khi mới có điểm A hoặc đang tính tuyến. */
export interface RouteDraft {
  start: LatLng | null;
  end: LatLng | null;
  result: RouteResult | null;
  computing: boolean;
}

/** Điểm đánh dấu thêm trên bản đồ (vd biển cần gắn của đợt thi công). */
export interface MapDot {
  id: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
}

export const EMPTY_DRAFT: RouteDraft = { start: null, end: null, result: null, computing: false };

/** Kiểu dữ liệu HTML5 drag mang id cán bộ — chip cán bộ ở `SurveyRoutesPanel` đặt giá trị này. */
export const SURVEYOR_DRAG_TYPE = 'application/x-surveyor-id';

/** Khoảng cách tối đa (pixel màn hình) từ con trỏ tới tuyến để tính là "thả trúng tuyến". */
export const DROP_TOLERANCE_PX = 18;

export interface RoutePickerMapProps {
  routes: SurveyRoute[];
  /** Màu từng tuyến (routeId → màu) — panel tự tính theo phân vùng hoặc theo cán bộ. */
  routeColors: Record<string, string>;
  /** Tuyến vẽ nét đứt dù đã bám đường (vd tuyến chưa giao khi tô màu theo cán bộ). */
  mutedRouteIds?: Set<string>;
  /** Thả chip cán bộ lên 1 tuyến. Bỏ trống = không nhận kéo thả. */
  onDropAssignee?: (routeId: string, assigneeId: string) => void;
  /** Đang ở chế độ chấm tuyến mới. */
  drawing: boolean;
  draft: RouteDraft;
  onDraftChange: (draft: RouteDraft) => void;
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  /** Đổi `nonce` để zoom tới tuyến đang chọn. */
  focusNonce?: number;
  /** Chấm tròn bổ sung (biển cần gắn…) — chỉ hiển thị, không tương tác. */
  dots?: MapDot[];
}

export const DRAFT_COLOR = '#2563eb';
