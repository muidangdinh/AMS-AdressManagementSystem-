'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  List,
  Map as MapIcon,
  Plus,
  Search,
  Zap,
} from 'lucide-react';
import {
  BUILDING_TYPE_LABELS,
  BuildingType,
  CreateHouseRequest,
  DEFAULT_PROVINCE_NAME,
  District,
  HOUSE_NUMBER_EDIT_WINDOW_MS,
  PERMISSIONS,
  formatFullAddress,
  Hamlet,
  UsageStatusItem,
  HOUSE_STATUS_LABELS,
  PLATE_NEED_LABELS,
  PlateNeed,
  NUMBERING_SIDE_LABELS,
  NumberingSide,
  HOUSE_REVIEW_STAGE_LABELS,
  HouseReviewStage,
  HouseHistoryEntry,
  HousePhotoChangeValue,
  HousePlate,
  HouseUserRef,
  HouseStatus,
  HouseSummary,
  PaginatedResult,
  PHOTO_TYPE_LABELS,
  PLATE_ISSUE_REASON_LABELS,
  PLATE_STATUS_LABELS,
  PhotoType,
  PlateIssueReason,
  PlateStatus,
  Street,
  USER_ROLE_LABELS,
  UserLevel,
  UserRole,
  Ward,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { useConfirmDialog } from '@/components/ConfirmDialogProvider';
import { ApiError, apiFetch, apiFetchBlob, getApiUrl } from '@/lib/api';
import { districtsApi, hamletsApi, streetsApi, usageStatusesApi, wardsApi } from '@/lib/addresses-api';
import { platesApi } from '@/lib/plates-api';
import { useWorkingWard } from '@/lib/working-ward';
import { fetchAppConfig } from '@/lib/app-config';
import type { FlyToRequest, HouseLocationAdjustment, HouseMapPoint, MapBounds } from '@/components/HouseMap';
import { Button, FIELD_CLASS, FormSection, FormField, KpiPill, SegmentedControl } from '@/components/ui';

/**
 * Phase 6 — chọn địa chỉ từ danh mục chuẩn hoá thay vì gõ tự do, với lối
 * thoát "+ Nhập tên khác…" cho địa chỉ chưa có trong danh mục (cán bộ vẫn
 * cần tạo nhà mới ở nơi chưa kịp thêm danh mục). Khi danh mục rỗng (chưa
 * ai thêm gì) mặc định vào chế độ nhập tay, tránh khóa cứng form.
 */
function AddressComboField({
  label,
  required,
  textValue,
  idValue,
  options,
  onSelect,
  onManualText,
  disabled,
}: {
  label: string;
  required?: boolean;
  textValue: string;
  idValue: string;
  options: { id: string; name: string }[];
  onSelect: (option: { id: string; name: string } | null) => void;
  onManualText: (text: string) => void;
  /** Khóa ô (vd nhân sự ấp/thôn: xã cố định theo tài khoản). */
  disabled?: boolean;
}) {
  const [manualMode, setManualMode] = useState(
    () => options.length === 0 || (!idValue && textValue !== ''),
  );

  return (
    <div>
      <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {manualMode ? (
        <div className="flex gap-2">
          <input
            required={required}
            value={textValue}
            onChange={(e) => onManualText(e.target.value)}
            disabled={disabled}
            className={`flex-1 min-w-0 ${FIELD_CLASS} disabled:bg-surface-2`}
          />
          {options.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="text-xs text-accent hover:underline whitespace-nowrap shrink-0"
            >
              Chọn danh mục
            </button>
          )}
        </div>
      ) : (
        <select
          required={required}
          value={idValue}
          onChange={(e) => {
            if (e.target.value === '__manual__') {
              setManualMode(true);
              onManualText('');
              return;
            }
            const opt = options.find((o) => o.id === e.target.value) ?? null;
            onSelect(opt);
          }}
          disabled={disabled}
          className={`${FIELD_CLASS} disabled:bg-surface-2`}
        >
          <option value="" disabled={required}>
            -- Chọn --
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="__manual__">+ Nhập tên khác…</option>
        </select>
      )}
    </div>
  );
}

// Leaflet cần `window`/`document` — chỉ load ở client, không SSR.
const HouseMap = dynamic(() => import('@/components/HouseMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-fg-subtle text-sm">
      Đang tải bản đồ…
    </div>
  ),
});

const PAGE_SIZE = 20;

/** Ô nhập/lọc trên thanh bộ lọc (card kính mờ) — cùng token với FIELD_CLASS nhưng nền trong suốt hơn. */
const FILTER_FIELD =
  'w-full border border-line rounded-lg px-3 py-2 text-sm bg-surface-2/50 text-fg placeholder:text-fg-subtle focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition';
/** Cỡ mỗi lượt tải khi sắp xếp toàn bộ ở trình duyệt — bằng giới hạn pageSize tối đa của API. */
const SORT_FETCH_PAGE_SIZE = 100;
/** So sánh số nhà "tự nhiên": 2 < 10 < 12 < 12A < 12/3 (không so như chuỗi thuần "10" < "2"). */
const HOUSE_NUMBER_COLLATOR = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
/** Dưới bề rộng này (breakpoint `md` của Tailwind) danh sách cạnh bản đồ nổi đè và mặc định ẩn. */
const MOBILE_MAX_WIDTH = 768;
/** Bán kính mặc định khi bấm vào bản đồ để tra cứu số nhà xung quanh (mét). */
const NEARBY_RADIUS_METERS = 500;

const STATUS_BADGE: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: 'bg-ok/15 text-ok border-ok/30',
  [HouseStatus.PENDING]: 'bg-warn/15 text-warn border-warn/30',
  [HouseStatus.NEEDS_ADJUST]: 'bg-danger/15 text-danger border-danger/30',
};

/**
 * Màu badge cho `reviewStage` — ĐỘC LẬP với `status`/STATUS_BADGE ở trên (xem
 * ghi chú tại enum HouseReviewStage trong packages/shared).
 */
const REVIEW_STAGE_BADGE: Record<HouseReviewStage, string> = {
  [HouseReviewStage.PROPOSED]: 'bg-surface-2 text-fg border-line',
  [HouseReviewStage.CHECKED]: 'bg-accent/15 text-accent border-accent/30',
  [HouseReviewStage.APPROVED]: 'bg-ok/15 text-ok border-ok/30',
  [HouseReviewStage.SIGNED]: 'bg-info/15 text-info border-info/30',
  [HouseReviewStage.REJECTED]: 'bg-danger/15 text-danger border-danger/30',
};

const HISTORY_ACTION_LABELS: Record<HouseHistoryEntry['action'], string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  PHOTO_ADD: 'Thêm ảnh',
  PHOTO_DELETE: 'Xóa ảnh',
};

interface HouseGeoJson {
  type: 'FeatureCollection';
  truncated: boolean;
  features: {
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      id: string;
      houseNumber: string;
      street: string;
      ward: string;
      district: string | null;
      ownerName: string;
      buildingType: BuildingType;
      status: HouseStatus;
      qrCode: string;
    };
  }[];
}

type NearbyHouse = HouseSummary & { distance: number };

interface HouseStats {
  total: number;
  approved: number;
  pending: number;
  needsAdjust: number;
}

interface FormState {
  houseNumber: string;
  street: string;
  streetId: string;
  ward: string;
  wardId: string;
  /** TN-09 — Ấp/Thôn (chỉ FK, không có cột chữ tự do song song như ward/street). */
  hamletId: string;
  district: string;
  districtId: string;
  ownerName: string;
  ownerPhone: string;
  ownerIdNumber: string;
  buildingType: BuildingType;
  floors: string;
  area: string;
  status: HouseStatus;
  latitude: string;
  longitude: string;
  soTo: string;
  soThua: string;
  usageStatusId: string;
  plateNeed: PlateNeed | '';
  side: NumberingSide;
  reviewStage: HouseReviewStage;
  note: string;
}

const emptyForm: FormState = {
  houseNumber: '',
  street: '',
  streetId: '',
  ward: '',
  wardId: '',
  hamletId: '',
  district: '',
  districtId: '',
  ownerName: '',
  ownerPhone: '',
  ownerIdNumber: '',
  buildingType: BuildingType.SINGLE_HOUSE,
  floors: '',
  area: '',
  status: HouseStatus.PENDING,
  latitude: '',
  longitude: '',
  soTo: '',
  soThua: '',
  usageStatusId: '',
  plateNeed: '',
  side: NumberingSide.NONE,
  reviewStage: HouseReviewStage.PROPOSED,
  note: '',
};

/** Tính cửa sổ 3 số trang liên tiếp quanh trang hiện tại (kẹp về biên khi gần đầu/cuối),
 *  cùng cờ có cần hiện nút "Trang đầu"/"Trang cuối" và dấu "…" hay không. */
function getPageWindow(current: number, total: number) {
  let start: number;
  let end: number;
  if (total <= 3) {
    start = 1;
    end = total;
  } else if (current <= 2) {
    start = 1;
    end = 3;
  } else if (current >= total - 1) {
    start = total - 2;
    end = total;
  } else {
    start = current - 1;
    end = current + 1;
  }
  return {
    pages: Array.from({ length: end - start + 1 }, (_, i) => start + i),
    showFirst: start > 1,
    showFirstEllipsis: start > 2,
    showLast: end < total,
    showLastEllipsis: end < total - 1,
  };
}

/**
 * Đọc `?focusId=&lat=&lng=` từ URL (đến từ Dashboard "Tra cứu nhanh") và bay
 * thẳng tới vị trí đó trên bản đồ. Tách riêng vì Next.js yêu cầu component
 * dùng `useSearchParams()` phải nằm trong 1 <Suspense> boundary.
 */
function FocusFromQuery({ onFocus }: { onFocus: (id: string, lat: number, lng: number) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const focusId = searchParams.get('focusId');
    const latRaw = searchParams.get('lat');
    const lngRaw = searchParams.get('lng');
    // Phải kiểm tra null/rỗng trước: Number(null) === 0 sẽ lọt qua isFinite và bay tới (0,0).
    if (!focusId || !latRaw || !lngRaw) return;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onFocus(focusId, lat, lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * Đọc `?myLat=&myLng=&t=` từ URL (đến từ nút "Bản đồ số nhà" trên thanh nav —
 * `houses/layout.tsx`) và bay tới vị trí GPS hiện tại của người dùng.
 * Khác với `FocusFromQuery`: effect ở đây PHẢI phụ thuộc vào giá trị query
 * (không chạy 1 lần lúc mount) vì nút bấm có thể được bấm nhiều lần ngay cả
 * khi trang `/houses` không remount — `t` (nonce theo timestamp) đảm bảo bắn
 * lại flyTo mỗi lần bấm dù toạ độ trùng lần trước.
 */
function LocateFromQuery({ onLocate }: { onLocate: (lat: number, lng: number, nonce: number) => void }) {
  const searchParams = useSearchParams();
  const myLat = searchParams.get('myLat');
  const myLng = searchParams.get('myLng');
  const t = searchParams.get('t');

  useEffect(() => {
    // Không có tham số (vd tới từ Dashboard với ?focusId=…) thì bỏ qua — Number(null) === 0
    // sẽ lọt qua isFinite và bay tới (0,0) giữa biển, vẽ chấm xanh "Vị trí của bạn" ở đó.
    if (!myLat || !myLng || !t) return;
    const lat = Number(myLat);
    const lng = Number(myLng);
    const nonce = Number(t);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(nonce)) {
      onLocate(lat, lng, nonce);
    }
  }, [myLat, myLng, t, onLocate]);

  return null;
}

/**
 * Đọc `?view=table` từ URL (đến từ link "Hồ sơ nhà" trên thanh nav —
 * `houses/layout.tsx`) và ép về chế độ Bảng. Cần thiết vì đang đứng sẵn ở
 * `/houses` (chế độ Bản đồ, do vừa bấm "Bản đồ số nhà"/tra cứu nhanh Dashboard)
 * rồi bấm "Hồ sơ nhà" thì Next.js không remount trang (cùng route) — nếu không
 * có tín hiệu này, `viewMode` cũ vẫn giữ nguyên là 'map' dù URL đã sạch query.
 */
function ResetToTableFromQuery({ onReset }: { onReset: () => void }) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');

  useEffect(() => {
    if (view === 'table') onReset();
  }, [view, onReset]);

  return null;
}

export default function HousesPage() {
  const { user, hasPermission } = useAuth();
  const { confirm, prompt: confirmText } = useConfirmDialog();
  // Nhân sự ấp/thôn: API chỉ trả nhà trong ấp của họ (cộng nhà thuộc nhiệm vụ được giao), nên bộ lọc
  // ấp chỉ hiển thị; hồ sơ mới mặc định thuộc ấp của họ.
  const hamletScoped = user?.level === UserLevel.HAMLET;
  const canEdit = hasPermission(PERMISSIONS.HOUSE_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.HOUSE_DELETE);
  const canAdjustLocation = hasPermission(PERMISSIONS.HOUSE_LOCATION_UPDATE);
  const canUpdateNumber = hasPermission(PERMISSIONS.HOUSE_NUMBER_UPDATE);
  const canManageCases = hasPermission(PERMISSIONS.CASE_MANAGE);
  const isAdminUser = user?.role === UserRole.ADMIN || !!user?.roles?.some((r) => r.code === 'admin');
  const apiUrl = getApiUrl();

  // Bộ lọc
  const [search, setSearch] = useState('');
  // TN-03 — mặc định lọc theo "xã đang làm việc" (nếu có chọn ở header),
  // vẫn đổi được bình thường qua dropdown bên dưới sau khi trang đã mở.
  const { ward: workingWard } = useWorkingWard();
  const [wardId, setWardId] = useState('');
  const [hamletId, setHamletId] = useState('');
  const [streetId, setStreetId] = useState('');
  const [streetSearch, setStreetSearch] = useState('');
  const [status, setStatus] = useState<HouseStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (workingWard) {
      setWardId(workingWard.id);
      setHamletId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingWard?.id]);

  // TN-21 — tên tỉnh cho địa chỉ đầy đủ 5 cấp ở ngăn chi tiết hồ sơ.
  const [provinceName, setProvinceName] = useState(DEFAULT_PROVINCE_NAME);
  useEffect(() => {
    fetchAppConfig()
      .then((cfg) => setProvinceName(cfg.provinceName))
      .catch(() => {});
  }, []);

  const [data, setData] = useState<PaginatedResult<HouseSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedHouseIds, setSelectedHouseIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Phase 6 — danh mục địa chỉ chuẩn hoá, dùng cho bộ lọc và dropdown trong form
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  // TN-09 — danh mục Ấp/Thôn (góp ý khách hàng 11/09/2026), lọc theo xã ở nơi dùng (giống streets/wardId).
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [usageStatuses, setUsageStatuses] = useState<UsageStatusItem[]>([]);

  // Gợi ý cho ô lọc "Đường" — chỉ hiện tên đường.
  const streetFilterOptions = streets
    .filter((s) => !wardId || s.wardId === wardId)
    .map((s) => ({ id: s.id, label: s.name }));

  useEffect(() => {
    districtsApi.list().then(setDistricts).catch(() => {});
    wardsApi.list().then(setWards).catch(() => {});
    streetsApi.list().then(setStreets).catch(() => {});
    hamletsApi.list().then(setHamlets).catch(() => {});
    usageStatusesApi.list().then(setUsageStatuses).catch(() => {});
  }, []);

  // Thống kê dashboard (Phase 5)
  const [stats, setStats] = useState<HouseStats | null>(null);
  const [exporting, setExporting] = useState(false);

  // Drawer chi tiết
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HouseSummary | null>(null);
  const [history, setHistory] = useState<HouseHistoryEntry[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Phase 8 — biển số nhà (trong panel chi tiết House)
  const [plates, setPlates] = useState<HousePlate[]>([]);
  const [plateActionLoading, setPlateActionLoading] = useState(false);
  const [plateActionError, setPlateActionError] = useState<string | null>(null);

  // Popup xem ảnh phóng to (click vào ảnh hiện trạng hoặc ảnh trong lịch sử) —
  // kèm người upload + thời điểm upload để hiện chú thích dưới ảnh.
  const [lightbox, setLightbox] = useState<{
    images: {
      url: string;
      uploadedBy: HouseUserRef | null;
      uploadedAt: string | null;
    }[];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!lightbox) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setLightbox((current) =>
          current
            ? { ...current, index: (current.index + 1) % current.images.length }
            : current,
        );
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setLightbox((current) =>
          current
            ? {
                ...current,
                index: (current.index - 1 + current.images.length) % current.images.length,
              }
            : current,
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  // Modal thêm/sửa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [editingOriginalNumber, setEditingOriginalNumber] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Non-admin chỉ sửa được số nhà trong 48 giờ đầu kể từ lúc hồ sơ lên hệ thống.
  const numberExpired =
    !!editingCreatedAt &&
    Date.now() - new Date(editingCreatedAt).getTime() >= HOUSE_NUMBER_EDIT_WINDOW_MS;
  const numberLocked = !!editingId && !isAdminUser && (!canUpdateNumber || numberExpired);
  const numberLockMessage = !numberLocked
    ? ''
    : !canUpdateNumber
      ? 'Bạn không có quyền sửa số nhà.'
      : 'Đã quá 48 giờ kể từ khi hồ sơ lên hệ thống — chỉ Quản trị viên được sửa số nhà.';
  const numberChanged = !!editingId && form.houseNumber !== editingOriginalNumber;

  const [uploading, setUploading] = useState(false);

  // Bản đồ (Phase 3)
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  useEffect(() => {
    setSelectedHouseIds([]);
  }, [page, search, wardId, hamletId, streetId, status, viewMode]);
  // Tham chiếu ổn định cho ResetToTableFromQuery — truyền hàm inline mỗi render sẽ khiến
  // effect của nó chạy lại liên tục và ép viewMode về 'table' ngay cả khi vừa chuyển sang 'map'.
  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null);
  // Chỉnh GPS trên bản đồ — đóng drawer để kéo marker, mở lại sau khi lưu/hủy.
  const [adjustLocation, setAdjustLocation] = useState<HouseLocationAdjustment | null>(null);
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  // Danh sách số nhà bên trái bản đồ — bật/tắt được; điện thoại (< md) mặc định ẩn vì chiếm gần hết màn hình.
  const [mapListOpen, setMapListOpen] = useState(true);
  // Thanh thống kê + bộ lọc phía trên — ở chế độ Bản đồ thu gọn được thành 1 dòng mảnh; điện
  // thoại mặc định thu gọn (2 thanh xuống nhiều dòng, chiếm gần nửa màn hình).
  const [topBarOpen, setTopBarOpen] = useState(true);
  useEffect(() => {
    if (window.innerWidth < MOBILE_MAX_WIDTH) {
      setMapListOpen(false);
      setTopBarOpen(false);
    }
  }, []);
  const topBarCollapsed = viewMode === 'map' && !topBarOpen;
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  // Xoá luôn flyToRequest cũ: bản đồ mount lại mỗi lần chuyển sang chế độ Bản đồ, nếu còn
  // giữ request cũ (vd vị trí GPS từ nút "Bản đồ số nhà") nó sẽ bay lại tới đó ngay lúc khởi tạo.
  const resetToTable = useCallback(() => {
    setViewMode('table');
    setFlyToRequest(null);
    setAdjustLocation(null);
    setAdjustError(null);
    setMapBounds(null);
  }, []);
  const [mapHouses, setMapHouses] = useState<HouseMapPoint[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [nearbyResults, setNearbyResults] = useState<NearbyHouse[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const housesAbortRef = useRef<AbortController | null>(null);

  // Sắp xếp theo số nhà — API chưa hỗ trợ sắp xếp nên khi bật sẽ tải hết các nhà khớp bộ lọc
  // (nhiều lượt × SORT_FETCH_PAGE_SIZE), sắp ở trình duyệt rồi tự chia trang. Kết quả được nhớ
  // theo bộ lọc + chiều sắp → chuyển trang không phải tải lại.
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const sortedCacheRef = useRef<{ key: string; items: HouseSummary[] } | null>(null);

  const fetchHouses = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (sortDir) {
      const key = [search, streetId, wardId, hamletId, status, sortDir].join('|');
      const cached = sortedCacheRef.current;
      if (!force && cached?.key === key) {
        setData({
          items: cached.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          total: cached.items.length,
          page,
          pageSize: PAGE_SIZE,
        });
        return;
      }
    }

    // Hủy request trước đó — tránh race condition khi gõ/xóa search nhanh
    // khiến response của filter cũ trả về sau và đè lên danh sách đúng.
    housesAbortRef.current?.abort();
    const controller = new AbortController();
    housesAbortRef.current = controller;

    setLoading(true);
    setListError(null);
    try {
      if (sortDir) {
        const fetchPage = (p: number) => {
          const qs = new URLSearchParams();
          qs.set('page', String(p));
          qs.set('pageSize', String(SORT_FETCH_PAGE_SIZE));
          if (search) qs.set('search', search);
          if (streetId) qs.set('streetId', streetId);
          if (wardId) qs.set('wardId', wardId);
          if (hamletId) qs.set('hamletId', hamletId);
          if (status) qs.set('status', status);
          return apiFetch<PaginatedResult<HouseSummary>>(`/api/houses?${qs.toString()}`, {
            signal: controller.signal,
          });
        };
        const first = await fetchPage(1);
        const pageCount = Math.ceil(first.total / SORT_FETCH_PAGE_SIZE);
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => fetchPage(i + 2)),
        );
        const all = [first, ...rest].flatMap((r) => r.items);
        const dir = sortDir === 'asc' ? 1 : -1;
        all.sort(
          (a, b) =>
            dir * HOUSE_NUMBER_COLLATOR.compare(a.houseNumber, b.houseNumber) ||
            HOUSE_NUMBER_COLLATOR.compare(a.street, b.street),
        );
        sortedCacheRef.current = { key: [search, streetId, wardId, hamletId, status, sortDir].join('|'), items: all };
        setData({
          items: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          total: all.length,
          page,
          pageSize: PAGE_SIZE,
        });
        return;
      }

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (streetId) params.set('streetId', streetId);
      if (wardId) params.set('wardId', wardId);
      if (hamletId) params.set('hamletId', hamletId);
      if (status) params.set('status', status);
      const res = await apiFetch<PaginatedResult<HouseSummary>>(
        `/api/houses?${params.toString()}`,
        { signal: controller.signal },
      );
      setData(res);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setListError(err instanceof ApiError ? err.message : 'Không tải được danh sách');
    } finally {
      if (housesAbortRef.current === controller) setLoading(false);
    }
  }, [page, search, streetId, wardId, hamletId, status, sortDir]);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch<HouseStats>('/api/houses/stats');
      setStats(res);
    } catch {
      // Thống kê lỗi thì chỉ ẩn thanh dashboard, không chặn thao tác chính
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function handleExportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (streetId) params.set('streetId', streetId);
      if (wardId) params.set('wardId', wardId);
      if (hamletId) params.set('hamletId', hamletId);
      if (status) params.set('status', status);

      const blob = await apiFetchBlob(`/api/houses/export.xlsx?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danh-sach-so-nha-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Xuất Excel thất bại. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  }

  const mapAbortRef = useRef<AbortController | null>(null);

  const handleMapBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds((prev) =>
      prev &&
      prev.west === bounds.west &&
      prev.south === bounds.south &&
      prev.east === bounds.east &&
      prev.north === bounds.north
        ? prev
        : bounds,
    );
  }, []);

  const fetchMapHouses = useCallback(
    async (bounds: MapBounds) => {
      mapAbortRef.current?.abort();
      const controller = new AbortController();
      mapAbortRef.current = controller;

      setMapError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (streetId) params.set('streetId', streetId);
        if (wardId) params.set('wardId', wardId);
        if (hamletId) params.set('hamletId', hamletId);
        if (status) params.set('status', status);
        params.set('west', String(bounds.west));
        params.set('south', String(bounds.south));
        params.set('east', String(bounds.east));
        params.set('north', String(bounds.north));
        const res = await apiFetch<HouseGeoJson>(`/api/houses/geojson?${params.toString()}`, {
          signal: controller.signal,
        });
        setMapHouses(
          res.features.map((f) => ({
            id: f.properties.id,
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
            houseNumber: f.properties.houseNumber,
            street: f.properties.street,
            ownerName: f.properties.ownerName,
            status: f.properties.status,
            qrCode: f.properties.qrCode,
          })),
        );
        setNearbyResults(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setMapError(err instanceof ApiError ? err.message : 'Không tải được lớp bản đồ');
      }
    },
    [search, streetId, wardId, hamletId, status],
  );

  useEffect(() => {
    if (viewMode !== 'map' || !mapBounds || adjustLocation) return;
    void fetchMapHouses(mapBounds);
  }, [viewMode, mapBounds, adjustLocation, fetchMapHouses]);

  /** Tra cứu theo tọa độ (I. "Tìm kiếm theo tọa độ") — bấm vào chỗ trống trên bản đồ. */
  async function handleMapClick(lat: number, lng: number) {
    if (adjustLocation) return;
    setNearbyLoading(true);
    try {
      const res = await apiFetch<NearbyHouse[]>(
        `/api/houses/nearby?lat=${lat}&lng=${lng}&radius=${NEARBY_RADIUS_METERS}`,
      );
      setNearbyResults(res);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Tra cứu theo tọa độ thất bại');
    } finally {
      setNearbyLoading(false);
    }
  }

  function clearNearby() {
    setNearbyResults(null);
  }

  /** Bấm 1 dòng trong danh sách cạnh bản đồ — trên điện thoại đóng danh sách để thấy bản đồ bay tới. */
  function pickFromMapList(id: string, lat: number, lng: number) {
    if (adjustLocation) return;
    selectAndFlyTo(id, lat, lng);
    if (window.innerWidth < MOBILE_MAX_WIDTH) setMapListOpen(false);
  }

  function selectAndFlyTo(id: string, lat: number, lng: number) {
    openDetail(id);
    setFlyToRequest({ lat, lng, nonce: Date.now() });
  }

  function handleMapSelect(id: string) {
    if (adjustLocation) return;
    void openDetail(id);
  }

  /**
   * Đến từ Dashboard "Tra cứu nhanh" — ép sang chế độ bản đồ rồi bay tới vị trí. Không tự mở drawer
   * chi tiết: lớp phủ tối của drawer che mất bản đồ vừa tới (người dùng bấm marker để xem chi tiết).
   */
  function focusFromDashboard(_id: string, lat: number, lng: number) {
    setViewMode('map');
    setFlyToRequest({ lat, lng, nonce: Date.now() });
  }

  /** Đến từ nút "Bản đồ số nhà" trên thanh nav — ép sang chế độ bản đồ, bay tới vị trí GPS hiện tại, vẽ marker. */
  const focusMyLocation = useCallback((lat: number, lng: number, nonce: number) => {
    setViewMode('map');
    setFlyToRequest({ lat, lng, nonce, myLocation: true });
  }, []);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setHistory([]);
    setPlates([]);
    setDetailError(null);
    try {
      const [houseRes, historyRes, platesRes] = await Promise.all([
        apiFetch<HouseSummary>(`/api/houses/${id}`),
        apiFetch<HouseHistoryEntry[]>(`/api/houses/${id}/history`),
        platesApi.listForHouse(id),
      ]);
      setDetail(houseRes);
      setHistory(historyRes);
      setPlates(platesRes);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Không tải được chi tiết hồ sơ');
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setHistory([]);
    setPlates([]);
  }

  function startAdjustLocation(house: HouseSummary) {
    mapAbortRef.current?.abort();
    setAdjustLocation({
      id: house.id,
      houseNumber: house.houseNumber,
      status: house.status,
      latitude: house.latitude,
      longitude: house.longitude,
    });
    setAdjustError(null);
    closeDetail();
    setViewMode('map');
    setMapListOpen(false);
    setFlyToRequest({ lat: house.latitude, lng: house.longitude, nonce: Date.now() });
  }

  function cancelAdjustLocation() {
    const id = adjustLocation?.id;
    setAdjustLocation(null);
    setAdjustError(null);
    if (id) void openDetail(id);
  }

  async function saveAdjustLocation() {
    if (!adjustLocation || savingAdjust) return;
    const { id, latitude, longitude } = adjustLocation;
    setSavingAdjust(true);
    setAdjustError(null);
    try {
      await apiFetch<HouseSummary>(`/api/houses/${id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude, longitude }),
      });
      setMapHouses((prev) =>
        prev.map((h) => (h.id === id ? { ...h, latitude, longitude } : h)),
      );
      setAdjustLocation(null);
      await openDetail(id);
    } catch (err) {
      setAdjustError(err instanceof ApiError ? err.message : 'Không lưu được vị trí mới');
    } finally {
      setSavingAdjust(false);
    }
  }

  async function refreshPlates() {
    if (!selectedId) return;
    try {
      setPlates(await platesApi.listForHouse(selectedId));
    } catch {
      // giữ danh sách cũ nếu tải lại lỗi — không chặn thao tác chính
    }
  }

  async function handleIssuePlate(reason: PlateIssueReason) {
    if (!selectedId) return;
    setPlateActionLoading(true);
    setPlateActionError(null);
    try {
      await platesApi.issue({ houseId: selectedId, reason });
      await refreshPlates();
      if (reason !== PlateIssueReason.NEW) {
        // Cấp đổi/cấp lại không đổi status House qua bước này (chỉ install mới đổi) —
        // nhưng vẫn refetch chi tiết để đồng bộ nếu sau này logic đổi.
      }
    } catch (err) {
      setPlateActionError(err instanceof ApiError ? err.message : 'Không cấp được biển số');
    } finally {
      setPlateActionLoading(false);
    }
  }

  async function handleInstallPlate(plateId: string) {
    setPlateActionLoading(true);
    setPlateActionError(null);
    try {
      await platesApi.install(plateId);
      await refreshPlates();
      if (selectedId) {
        const updated = await apiFetch<HouseSummary>(`/api/houses/${selectedId}`);
        setDetail(updated);
        await fetchHouses({ force: true });
        await fetchStats();
      }
    } catch (err) {
      setPlateActionError(err instanceof ApiError ? err.message : 'Không xác nhận gắn biển được');
    } finally {
      setPlateActionLoading(false);
    }
  }

  async function handleRevokePlate(plateId: string) {
    const reason = prompt('Lý do thu hồi biển số:');
    if (!reason) return;
    setPlateActionLoading(true);
    setPlateActionError(null);
    try {
      await platesApi.revoke(plateId, reason);
      await refreshPlates();
    } catch (err) {
      setPlateActionError(err instanceof ApiError ? err.message : 'Không thu hồi được biển số');
    } finally {
      setPlateActionLoading(false);
    }
  }

  function openCreateModal(preset?: { lat: number; lng: number }) {
    setEditingId(null);
    setEditingCreatedAt(null);
    setEditingOriginalNumber(null);
    const base: FormState =
      hamletScoped && user?.hamletId
        ? {
            ...emptyForm,
            hamletId: user.hamletId,
            wardId: user.wardId ?? '',
            ward: wards.find((w) => w.id === user.wardId)?.name ?? user.ward?.name ?? '',
          }
        : emptyForm;
    setForm(
      preset ? { ...base, latitude: preset.lat.toFixed(6), longitude: preset.lng.toFixed(6) } : base,
    );
    setFormError(null);
    setModalOpen(true);
  }

  /** Chuột phải trên bản đồ (chế độ Bản đồ) — mở form thêm số nhà, tọa độ lấy từ vị trí bấm. */
  function handleMapRightClick(lat: number, lng: number) {
    if (!canEdit || adjustLocation) return;
    openCreateModal({ lat, lng });
  }

  function openEditModal(house: HouseSummary) {
    setEditingId(house.id);
    setEditingCreatedAt(house.createdAt);
    setEditingOriginalNumber(house.houseNumber);
    setForm({
      houseNumber: house.houseNumber,
      street: house.street,
      streetId: house.streetId ?? '',
      ward: house.ward,
      wardId: house.wardId ?? '',
      hamletId: house.hamletId ?? '',
      district: house.district ?? '',
      districtId: house.districtId ?? '',
      ownerName: house.ownerName,
      ownerPhone: house.ownerPhone ?? '',
      ownerIdNumber: house.ownerIdNumber ?? '',
      buildingType: house.buildingType,
      floors: house.floors?.toString() ?? '',
      area: house.area?.toString() ?? '',
      status: house.status,
      latitude: house.latitude.toString(),
      longitude: house.longitude.toString(),
      soTo: house.soTo ?? '',
      soThua: house.soThua ?? '',
      usageStatusId: house.usageStatusId ?? '',
      plateNeed: house.plateNeed ?? '',
      side: house.side ?? NumberingSide.NONE,
      reviewStage: house.reviewStage ?? HouseReviewStage.PROPOSED,
      note: house.note ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (numberLocked && numberChanged) {
      setFormError(numberLockMessage);
      return;
    }
    setSaving(true);

    const payload: CreateHouseRequest & { reviewStage?: HouseReviewStage } = {
      houseNumber: form.houseNumber,
      street: form.street,
      streetId: form.streetId || undefined,
      ward: form.ward,
      wardId: form.wardId || undefined,
      hamletId: form.hamletId || undefined,
      district: form.district || undefined,
      districtId: form.districtId || undefined,
      ownerName: form.ownerName,
      ownerPhone: form.ownerPhone || undefined,
      ownerIdNumber: form.ownerIdNumber || undefined,
      buildingType: form.buildingType,
      floors: form.floors ? Number(form.floors) : undefined,
      area: form.area ? Number(form.area) : undefined,
      status: form.status,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      soTo: form.soTo || undefined,
      soThua: form.soThua || undefined,
      usageStatusId: form.usageStatusId || undefined,
      plateNeed: form.plateNeed || undefined,
      side: form.side !== NumberingSide.NONE ? form.side : undefined,
      note: form.note || undefined,
      // Chỉ gửi lúc sửa — tạo mới luôn khởi tạo PROPOSED server-side (CreateHouseDto
      // không có field này, whitelist:true ở ValidationPipe sẽ tự bỏ qua nếu có gửi).
      ...(editingId ? { reviewStage: form.reviewStage } : {}),
    };

    try {
      let house: HouseSummary;
      if (editingId) {
        house = await apiFetch<HouseSummary>(`/api/houses/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        house = await apiFetch<HouseSummary>('/api/houses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await fetchHouses({ force: true });
      await fetchStats();
      if (viewMode === 'map' && mapBounds) await fetchMapHouses(mapBounds);
      await openDetail(house.id);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Tra người upload 1 ảnh từ lịch sử đã tải (khớp mục PHOTO_ADD theo URL ảnh).
   * Trả null khi không tra được — ảnh cũ, hoặc hồ sơ có nhiều thay đổi nên mục
   * PHOTO_ADD đã rơi khỏi 20 bản ghi gần nhất mà API lịch sử trả về.
   */
  function findUploader(photoUrl: string): HouseUserRef | null {
    const entry = history.find(
      (h) =>
        h.action === 'PHOTO_ADD' &&
        h.changes?.some((c) => (c.new as HousePhotoChangeValue | null)?.url === photoUrl),
    );
    return entry?.changedBy ?? null;
  }

  function openLightbox(
    photoUrl: string,
    metadata?: { uploadedBy: HouseUserRef | null; uploadedAt: string | null },
  ) {
    const imagesByUrl = new Map<
      string,
      { url: string; uploadedBy: HouseUserRef | null; uploadedAt: string | null }
    >();

    for (const photo of detail?.photos ?? []) {
      const url = `${apiUrl}${photo.url}`;
      imagesByUrl.set(url, {
        url,
        uploadedBy: findUploader(photo.url),
        uploadedAt: photo.createdAt,
      });
    }

    for (const entry of history) {
      if (entry.action !== 'PHOTO_ADD' || !Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        const photo = (change.new ?? change.old) as HousePhotoChangeValue | null;
        if (!photo) continue;
        const url = `${apiUrl}${photo.url}`;
        if (!imagesByUrl.has(url)) {
          imagesByUrl.set(url, {
            url,
            uploadedBy: entry.changedBy,
            uploadedAt: entry.createdAt,
          });
        }
      }
    }

    if (!imagesByUrl.has(photoUrl)) {
      imagesByUrl.set(photoUrl, {
        url: photoUrl,
        uploadedBy: metadata?.uploadedBy ?? null,
        uploadedAt: metadata?.uploadedAt ?? null,
      });
    }

    const images = [...imagesByUrl.values()];
    const index = images.findIndex((image) => image.url === photoUrl);
    if (index >= 0) setLightbox({ images, index });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, type: PhotoType) {
    if (!selectedId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      await apiFetch(`/api/houses/${selectedId}/photos`, { method: 'POST', body: fd });
      await openDetail(selectedId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Tải ảnh thất bại');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!selectedId) return;
    if (!(await confirm('Xóa ảnh này?'))) return;
    try {
      await apiFetch(`/api/houses/${selectedId}/photos/${photoId}`, { method: 'DELETE' });
      await openDetail(selectedId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Xóa ảnh thất bại');
    }
  }

  async function refreshAfterHouseDelete(deletedCount = 1) {
    if (page > 1 && (data?.items.length ?? 0) <= deletedCount) {
      setPage((current) => current - 1);
    } else {
      await fetchHouses({ force: true });
    }
    await fetchStats();
    if (viewMode === 'map' && mapBounds) await fetchMapHouses(mapBounds);
  }

  async function handleDeleteHouse(house: HouseSummary) {
    const label = `số ${house.houseNumber} ${house.street}`;
    if (
      !(await confirm(
        `Xóa hẳn hồ sơ ${label}? Ảnh, biển số, lịch sử và dòng trong phương án đánh số sẽ bị xóa. Hồ sơ hành chính liên quan chỉ mất liên kết.`,
      ))
    )
      return;
    const confirmation = await confirmText('Để xác nhận xóa hồ sơ, nhập chính xác:', 'DELETE');
    if (confirmation === null) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/houses/${house.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      });
      closeDetail();
      await refreshAfterHouseDelete();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Xóa hồ sơ thất bại');
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    const ids = selectedHouseIds;
    if (ids.length === 0) return;
    if (
      !(await confirm(
        `Xóa hẳn ${ids.length} hồ sơ đã chọn? Ảnh, biển số, lịch sử và dòng trong phương án đánh số sẽ bị xóa. Hồ sơ hành chính liên quan chỉ mất liên kết.`,
      ))
    )
      return;
    const confirmation = await confirmText('Để xác nhận xóa hàng loạt, nhập chính xác:', 'DELETE');
    if (confirmation === null) return;
    setDeleting(true);
    try {
      await apiFetch('/api/houses', {
        method: 'DELETE',
        body: JSON.stringify({ ids, confirmation }),
      });
      if (selectedId && ids.includes(selectedId)) closeDetail();
      setSelectedHouseIds([]);
      await refreshAfterHouseDelete(ids.length);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Xóa hồ sơ thất bại');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageHouseIds = data?.items.map((house) => house.id) ?? [];
  const selectedHouseIdSet = new Set(selectedHouseIds);
  const allPageSelected =
    pageHouseIds.length > 0 && pageHouseIds.every((id) => selectedHouseIdSet.has(id));
  const activeLightboxImage = lightbox?.images[lightbox.index] ?? null;

  // Nút chuyển Bảng/Bản đồ — dùng ở cả thanh bộ lọc đầy đủ lẫn dòng thu gọn.
  // Ctrl/⌘ + K: nhảy tới ô tìm kiếm (mở lại thanh bộ lọc nếu đang thu gọn ở chế độ Bản đồ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTopBarOpen(true);
        requestAnimationFrame(() => document.getElementById('house-list-search')?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const viewModeSwitch = (
    <SegmentedControl
      value={viewMode}
      onChange={(v) => {
        setViewMode(v);
        setMapBounds(null);
        setFlyToRequest(null);
        if (v !== 'map') {
          setAdjustLocation(null);
          setAdjustError(null);
        }
      }}
      options={[
        { value: 'table', label: <><List className="w-4 h-4" /> Bảng</> },
        { value: 'map', label: <><MapIcon className="w-4 h-4" /> Bản đồ</> },
      ]}
    />
  );

  return (
    <div className="h-full flex flex-col">
      <Suspense fallback={null}>
        <FocusFromQuery onFocus={focusFromDashboard} />
        <LocateFromQuery onLocate={focusMyLocation} />
        <ResetToTableFromQuery onReset={resetToTable} />
      </Suspense>

      {/* Thanh thống kê dashboard (Phase 5 — IX) — ở chế độ Bản đồ có thể thu gọn cùng thanh bộ lọc. */}
      {stats && !topBarCollapsed && (
        <div className="px-3 sm:px-6 pt-3 flex flex-wrap gap-2 shrink-0">
          <KpiPill tone="accent" label="Tổng số nhà" value={stats.total} />
          <KpiPill tone="ok" label="Đã cấp biển/QR" value={stats.approved} />
          <KpiPill tone="warn" label="Chờ duyệt" value={stats.pending} />
          <KpiPill tone="danger" label="Cần hiệu chỉnh" value={stats.needsAdjust} />
        </div>
      )}

      {/* Thanh bộ lọc */}
      {topBarCollapsed ? (
        <div className="glass mx-3 sm:mx-6 mt-3 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTopBarOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg px-2 py-1.5 rounded-lg hover:bg-surface-2"
          >
            <Filter className="w-4 h-4" /> Bộ lọc &amp; thống kê
            {(search || wardId || hamletId || streetId || status) && (
              <span className="w-2 h-2 rounded-full bg-brand" title="Đang có bộ lọc" />
            )}
          </button>
          {viewModeSwitch}
        </div>
      ) : (
      <div className="glass mx-3 sm:mx-6 mt-3 px-4 py-3 flex flex-wrap gap-3 items-end shrink-0">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-1">
            Tìm kiếm
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              id="house-list-search"
              placeholder="Số nhà, chủ sở hữu, CCCD/CMND, mã QR..."
              className={`${FILTER_FIELD} pl-9 pr-16`}
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded border border-line bg-surface-2/70 px-1.5 py-0.5 text-[10px] font-semibold text-fg-subtle">
              Ctrl K
            </kbd>
          </div>
        </div>
        <div className="w-44">
          <label className="block text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-1">
            Ấp/thôn
          </label>
          <select
            value={hamletId}
            onChange={(e) => {
              setPage(1);
              setHamletId(e.target.value);
            }}
            disabled={hamletScoped}
            title={hamletScoped ? 'Tài khoản ấp/thôn chỉ xem được dữ liệu của ấp mình' : undefined}
            className={`${FILTER_FIELD} disabled:bg-surface-2`}
          >
            <option value="">{hamletScoped ? (user?.hamlet?.name ?? 'Chưa gán ấp/thôn') : '-- Tất cả --'}</option>
            {hamlets
              .filter((h) => !wardId || h.wardId === wardId)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
        </div>
        <div className="w-52">
          <label className="block text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-1">
            Đường
          </label>
          <input
            list="house-street-filter-options"
            value={streetSearch}
            onChange={(e) => {
              const value = e.target.value;
              setPage(1);
              setStreetSearch(value);
              const match = streetFilterOptions.find(
                (o) => o.label.toLocaleLowerCase('vi') === value.trim().toLocaleLowerCase('vi'),
              );
              setStreetId(match?.id ?? '');
            }}
            placeholder="Tìm đường…"
            aria-label="Lọc theo đường"
            className={FILTER_FIELD}
          />
          <datalist id="house-street-filter-options">
            {streetFilterOptions.map((o) => (
              <option key={o.id} value={o.label} />
            ))}
          </datalist>
        </div>
        <div className="w-48">
          <label className="block text-[11px] font-bold text-fg-subtle uppercase tracking-wider mb-1">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as HouseStatus | '');
            }}
            className={FILTER_FIELD}
          >
            <option value="">-- Tất cả --</option>
            {Object.values(HouseStatus).map((s) => (
              <option key={s} value={s}>
                {HOUSE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {viewModeSwitch}
        <Button variant="success" onClick={handleExportExcel} disabled={exporting}>
          <Zap className="w-4 h-4" />
          {exporting ? 'Đang xuất…' : 'Xuất Excel'}
        </Button>
        {canDelete && selectedHouseIds.length > 0 && (
          <Button variant="danger" onClick={handleBulkDelete} disabled={deleting}>
            {deleting ? 'Đang xóa…' : `Xóa đã chọn (${selectedHouseIds.length})`}
          </Button>
        )}
        {canEdit && (
          <Button variant="primary" onClick={() => openCreateModal()}>
            <Plus className="w-4 h-4" />
            Thêm số nhà
          </Button>
        )}
        {canManageCases && (
          <Link
            href="/houses/cases"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-300 bg-warn text-white shadow-glow-warn hover:brightness-110"
          >
            Nhập liệu
          </Link>
        )}
        {viewMode === 'map' && (
          <button
            type="button"
            onClick={() => setTopBarOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-fg-muted hover:text-fg hover:bg-surface-2"
          >
            <ChevronUp className="w-4 h-4 inline -mt-0.5" /> Thu gọn
          </button>
        )}
      </div>
      )}

      {viewMode === 'table' ? (
      /* Bảng danh sách */
      <div className="flex-1 min-h-0 px-3 sm:px-6 py-4 flex flex-col">
        {listError && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4 shrink-0">
            {listError}
          </div>
        )}
        <div className="glass overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/60 text-fg-subtle text-[11px] uppercase tracking-wider">
              <tr>
                {canDelete && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedHouseIds((prev) => [...new Set([...prev, ...pageHouseIds])]);
                        } else {
                          setSelectedHouseIds((prev) => prev.filter((id) => !pageHouseIds.includes(id)));
                        }
                      }}
                      aria-label="Chọn tất cả hồ sơ trên trang"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Bấm lần lượt: bé → lớn, lớn → bé, bỏ sắp xếp (về thứ tự mới nhất như cũ).
                      setSortDir((d) => (d === null ? 'asc' : d === 'asc' ? 'desc' : null));
                      setPage(1);
                    }}
                    title="Sắp xếp theo số nhà"
                    className="inline-flex items-center gap-1 uppercase hover:text-fg"
                  >
                    Số nhà
                    <span className={sortDir ? 'text-accent' : 'text-fg-subtle'}>
                      {sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '⇅'}
                    </span>
                  </button>
                </th>
                <th className="text-left px-4 py-3">Chủ sở hữu</th>
                <th className="text-left px-4 py-3">Loại</th>
                <th className="text-left px-4 py-3">Đường</th>
                <th className="text-left px-4 py-3">Phường/Xã</th>
                <th className="text-left px-4 py-3">Ngày cấp</th>
                <th className="text-left px-4 py-3">Trạng thái</th>
                {/* <th className="text-left px-4 py-3">Mã QR</th> */}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="text-center py-8 text-fg-subtle">
                    Đang tải…
                  </td>
                </tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="text-center py-8 text-fg-subtle">
                    Không có hồ sơ nào phù hợp
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((house) => (
                  <tr
                    key={house.id}
                    onClick={() => openDetail(house.id)}
                    className="cursor-pointer transition-colors duration-200 hover:bg-surface-2/50"
                  >
                    {canDelete && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedHouseIdSet.has(house.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedHouseIds((prev) =>
                              checked
                                ? prev.includes(house.id)
                                  ? prev
                                  : [...prev, house.id]
                                : prev.filter((id) => id !== house.id),
                            );
                          }}
                          aria-label={`Chọn hồ sơ số ${house.houseNumber}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-bold text-fg">{house.houseNumber}</td>
                    <td className="px-4 py-3">{house.ownerName}</td>
                    <td className="px-4 py-3 text-xs">
                      {BUILDING_TYPE_LABELS[house.buildingType]}
                    </td>
                    <td className="px-4 py-3">{house.street}</td>
                    <td className="px-4 py-3">{house.ward}</td>
                    <td className="px-4 py-3 text-xs text-fg-muted">
                      {house.approvedAt ? new Date(house.approvedAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[house.status]}`}
                      >
                        {HOUSE_STATUS_LABELS[house.status]}
                      </span>
                      <span
                        className={`block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border w-fit ${REVIEW_STAGE_BADGE[house.reviewStage]}`}
                      >
                        {HOUSE_REVIEW_STAGE_LABELS[house.reviewStage]}
                      </span>
                    </td>
                    {/* <td className="px-4 py-3 font-mono text-xs text-fg-subtle">
                      {house.qrCode}
                    </td> */}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-fg-muted shrink-0">
            <span>
              Tổng {data.total} hồ sơ — Trang {data.page}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-line disabled:opacity-40"
              >
                Trước
              </button>

              {(() => {
                const { pages, showFirst, showFirstEllipsis, showLast, showLastEllipsis } =
                  getPageWindow(page, totalPages);
                return (
                  <>
                    {showFirst && (
                      <button
                        onClick={() => setPage(1)}
                        className="px-3 py-1.5 rounded border border-line text-fg-muted hover:bg-surface-2"
                      >
                        Trang đầu
                      </button>
                    )}
                    {showFirstEllipsis && <span className="px-1 text-fg-subtle">…</span>}
                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 rounded border text-sm font-semibold ${
                          p === page
                            ? 'bg-accent/15 border-accent text-accent shadow-glow-accent'
                            : 'border-line text-fg-muted hover:bg-surface-2'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    {showLastEllipsis && <span className="px-1 text-fg-subtle">…</span>}
                    {showLast && (
                      <button
                        onClick={() => setPage(totalPages)}
                        className="px-3 py-1.5 rounded border border-line text-fg-muted hover:bg-surface-2"
                      >
                        Trang cuối
                      </button>
                    )}
                  </>
                );
              })()}

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-line disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
      ) : (
      /* Bản đồ GIS (Phase 3) — danh sách gọn bên trái + bản đồ bên phải */
      <div className="flex-1 flex overflow-hidden relative">
        {/* Màn hình nhỏ (< md): danh sách nổi đè lên bản đồ và mặc định ẩn — nếu để cột cố định
            320px thì chiếm gần hết bề ngang điện thoại. Từ md trở lên là cột bên trái như cũ. */}
        <aside
          className={`${
            mapListOpen && !adjustLocation ? 'block' : 'hidden'
          } absolute top-3 bottom-3 left-3 z-[1100] w-72 max-w-[85%] md:w-80 glass !bg-surface/75 shadow-2xl overflow-y-auto p-3 space-y-2`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fg-muted uppercase">
              Danh sách số nhà ({adjustLocation ? 0 : nearbyResults?.length ?? data?.total ?? 0})
            </span>
            <button
              type="button"
              onClick={() => setMapListOpen(false)}
              className="text-xs font-semibold text-fg-muted hover:text-fg px-2 py-1 rounded hover:bg-surface-2"
            >
              Ẩn ✕
            </button>
          </div>
          {mapError && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
              {mapError}
            </div>
          )}
          {listError && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
              {listError}
            </div>
          )}

          {nearbyResults !== null && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-accent">
                  Trong bán kính {NEARBY_RADIUS_METERS}m: {nearbyResults.length} hồ sơ
                </span>
                <button onClick={clearNearby} className="text-accent hover:underline font-semibold">
                  Xóa
                </button>
              </div>
              <p className="text-accent">Vừa tra cứu theo tọa độ đã bấm trên bản đồ.</p>
            </div>
          )}

          {(loading || nearbyLoading) && (
            <p className="text-fg-subtle text-sm text-center py-4">Đang tải…</p>
          )}

          {!loading &&
            !nearbyLoading &&
            (nearbyResults ?? data?.items ?? []).length === 0 && (
              <p className="text-fg-subtle text-sm text-center py-4">
                Không có hồ sơ nào phù hợp
              </p>
            )}

          {!loading &&
            !nearbyLoading &&
            (nearbyResults
              ? nearbyResults.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => pickFromMapList(h.id, h.latitude, h.longitude)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      h.id === selectedId
                        ? 'border-2 border-purple-500 bg-purple-500/15 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                        : 'border-line hover:border-accent/30 hover:bg-accent/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-fg">
                        Số {h.houseNumber} {h.street}
                      </h3>
                      <span className="text-[10px] font-mono text-accent shrink-0 ml-2">
                        {h.distance}m
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted truncate">{h.ownerName}</p>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[h.status]}`}
                    >
                      {HOUSE_STATUS_LABELS[h.status]}
                    </span>
                  </div>
                ))
              : (data?.items ?? []).map((h) => (
                  <div
                    key={h.id}
                    onClick={() => pickFromMapList(h.id, h.latitude, h.longitude)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      h.id === selectedId
                        ? 'border-2 border-purple-500 bg-purple-500/15 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                        : 'border-line hover:border-accent/30 hover:bg-accent/10'
                    }`}
                  >
                    <h3 className="font-bold text-sm text-fg">
                      Số {h.houseNumber} {h.street}
                    </h3>
                    <p className="text-xs text-fg-muted truncate">{h.ownerName}</p>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[h.status]}`}
                    >
                      {HOUSE_STATUS_LABELS[h.status]}
                    </span>
                  </div>
                )))}

          {nearbyResults === null && data && data.total > PAGE_SIZE && (
            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-line bg-surface/95 p-2 text-xs">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded border border-line px-2 py-1 text-fg disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-fg-muted">
                Trang {page}/{totalPages} · {data.total} hồ sơ
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded border border-line px-2 py-1 text-fg disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 relative">
          {!mapListOpen && !adjustLocation && (
            <button
              type="button"
              onClick={() => setMapListOpen(true)}
              className="absolute top-3 left-3 z-[1000] bg-surface rounded-lg shadow-md border border-line px-3 py-1.5 text-xs font-semibold text-fg hover:bg-surface-2"
            >
              ☰ Danh sách ({nearbyResults?.length ?? data?.total ?? 0})
            </button>
          )}
          <HouseMap
            houses={
              adjustLocation
                ? mapHouses.filter((house) => house.id !== adjustLocation.id)
                : mapHouses
            }
            selectedHouseId={selectedId}
            onSelectHouse={handleMapSelect}
            onMapClick={handleMapClick}
            onMapRightClick={handleMapRightClick}
            flyToRequest={flyToRequest}
            adjustLocation={adjustLocation}
            onBoundsChange={handleMapBoundsChange}
            onAdjustLocationChange={(lat, lng) =>
              setAdjustLocation((prev) => (prev ? { ...prev, latitude: lat, longitude: lng } : prev))
            }
          />
          {adjustLocation && (
            <div
              role="dialog"
              aria-label="Điều chỉnh vị trí GPS"
              className="absolute inset-x-3 bottom-4 z-[1200] mx-auto max-w-md space-y-2 rounded-xl border border-line bg-surface p-3 shadow-2xl"
            >
              <p className="text-xs leading-relaxed text-fg-muted">
                Kéo chấm số{' '}
                <span className="font-bold text-fg">{adjustLocation.houseNumber}</span> đến đúng vị
                trí căn nhà, sau đó bấm Lưu vị trí.
              </p>
              {adjustError && (
                <p className="text-xs font-semibold text-danger" role="alert">
                  {adjustError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelAdjustLocation}
                  disabled={savingAdjust}
                  className="flex-1 rounded-lg border border-line py-2 text-sm font-bold text-fg-muted hover:bg-surface-2 disabled:opacity-60"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={saveAdjustLocation}
                  disabled={savingAdjust}
                  className="flex-1 rounded-lg bg-brand py-2 text-sm font-bold text-white hover:bg-brand/90 disabled:opacity-60"
                >
                  {savingAdjust ? 'Đang lưu…' : 'Lưu vị trí'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Drawer chi tiết */}
      {selectedId && (
        <div className="fixed inset-0 z-[600]">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] bg-surface shadow-2xl flex flex-col">
            <div className="p-4 bg-shell text-fg border-b border-line flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base">Chi Tiết Hồ Sơ Số Nhà</h2>
              <button onClick={closeDetail} className="text-fg-subtle hover:text-fg text-lg">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
                  {detailError}
                </div>
              )}
              {!detail && !detailError && <p className="text-fg-subtle text-sm">Đang tải…</p>}
              {detail && (
                <>
                  <div className="space-y-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[detail.status]}`}
                    >
                      {HOUSE_STATUS_LABELS[detail.status]}
                    </span>{' '}
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${REVIEW_STAGE_BADGE[detail.reviewStage]}`}
                    >
                      {HOUSE_REVIEW_STAGE_LABELS[detail.reviewStage]}
                    </span>
                    <h3 className="text-2xl font-extrabold text-fg">
                      Số {detail.houseNumber} {detail.street}
                    </h3>
                    {/* TN-21 — địa chỉ đầy đủ 5 cấp (góp ý khách hàng 11/09/2026): ấp, xã, tỉnh
                        (số nhà + đường đã hiện ở tiêu đề trên) — dùng chung công thức với mobile
                        qua `formatFullAddress` (truyền houseNumber/street rỗng để không lặp lại). */}
                    <p className="text-xs text-fg-muted">
                      {formatFullAddress(
                        { houseNumber: '', street: '', ward: detail.ward, hamletName: detail.hamlet?.name },
                        provinceName,
                      )}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      Khởi tạo bởi{' '}
                      <span className="font-medium text-fg-muted">
                        {detail.createdBy
                          ? `${detail.createdBy.fullName} (${USER_ROLE_LABELS[detail.createdBy.role]})`
                          : 'Tài khoản đã xóa'}
                      </span>{' '}
                      — {new Date(detail.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="bg-surface-2 rounded-xl p-4 border border-line space-y-3">
                    <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider">
                      Chủ sở hữu
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-fg-subtle">Họ tên</p>
                        <p className="font-semibold">{detail.ownerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Điện thoại</p>
                        <p className="font-semibold">{detail.ownerPhone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Số CCCD/CMND</p>
                        <p className="font-semibold">{detail.ownerIdNumber || '—'}</p>
                      </div>
                    </div>

                    <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider border-t border-line pt-3">
                      Đặc điểm công trình
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-fg-subtle">Loại nhà</p>
                        <p className="font-semibold text-xs">
                          {BUILDING_TYPE_LABELS[detail.buildingType]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Số tầng</p>
                        <p className="font-semibold">{detail.floors ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Diện tích</p>
                        <p className="font-semibold">
                          {detail.area ? `${detail.area} m²` : '—'}
                        </p>
                      </div>
                    </div>
                    {(detail.soTo || detail.soThua) && (
                      <p className="text-xs text-fg-muted">
                        Thửa {detail.soThua ?? '—'} / Tờ {detail.soTo ?? '—'}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-sm border-t border-line pt-3">
                      <div>
                        <p className="text-xs text-fg-subtle">Hiện trạng nhà</p>
                        <p className="font-semibold text-xs">
                          {detail.usageStatus?.name ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Nhu cầu gắn biển</p>
                        <p className="font-semibold text-xs">
                          {detail.plateNeed ? PLATE_NEED_LABELS[detail.plateNeed] : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-fg-subtle">Phía đường</p>
                        <p className="font-semibold text-xs">{NUMBERING_SIDE_LABELS[detail.side]}</p>
                      </div>
                    </div>
                    {detail.note && (
                      <p className="text-xs text-fg-muted border-t border-line pt-3">
                        Ghi chú: {detail.note}
                      </p>
                    )}
                  </div>

                  <div className="bg-surface-2 rounded-xl p-4 border border-line space-y-4">
                    {(
                      [
                        { type: PhotoType.FACADE, label: 'Ảnh mặt tiền', uploadId: 'house-photo-upload-facade' },
                        { type: PhotoType.PLATE, label: 'Ảnh biển số nhà', uploadId: 'house-photo-upload-plate' },
                        { type: PhotoType.CONDITION, label: 'Ảnh khác', uploadId: 'house-photo-upload-condition' },
                      ] as const
                    ).map((group) => {
                      const photos = detail.photos?.filter((p) => p.type === group.type) ?? [];
                      return (
                        <div key={group.type}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider">
                              {group.label}
                            </h4>
                            {canEdit && (
                              <label className="text-xs text-accent font-semibold cursor-pointer hover:underline">
                                {uploading ? 'Đang tải...' : '+ Tải ảnh lên'}
                                <input
                                  id={group.uploadId}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleUpload(e, group.type)}
                                  disabled={uploading}
                                />
                              </label>
                            )}
                          </div>
                          {photos.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {photos.map((photo) => (
                                <div key={photo.id} className="relative group">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`${apiUrl}${photo.url}`}
                                    alt="Ảnh công trình"
                                    onClick={() => openLightbox(`${apiUrl}${photo.url}`)}
                                    className="w-full h-20 object-cover rounded-lg border border-line cursor-pointer hover:opacity-90 transition"
                                  />
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeletePhoto(photo.id)}
                                      className="absolute top-1 right-1 bg-danger text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-fg-subtle mt-1">Chưa có ảnh</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-surface-2 rounded-xl p-4 border border-line space-y-3">
                    <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider">
                      Tọa độ GPS & Mã QR
                    </h4>
                    <div className="flex items-center space-x-3 bg-surface p-3 rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${apiUrl}/api/houses/${detail.id}/qrcode.png`}
                        alt="Mã QR"
                        className="w-16 h-16"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-fg truncate">
                          {detail.qrCode}
                        </p>
                        <p className="text-[11px] text-fg-muted font-mono">
                          GPS: {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                        </p>
                        <a
                          href={`/lookup/${detail.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-accent hover:underline"
                        >
                          Xem trang tra cứu công khai →
                        </a>
                      </div>
                    </div>
                    {canAdjustLocation && (
                      <button
                        type="button"
                        onClick={() => startAdjustLocation(detail)}
                        className="w-full rounded-lg bg-brand py-2 text-sm font-bold text-white hover:bg-brand/90"
                      >
                        Điều chỉnh vị trí GPS
                      </button>
                    )}
                  </div>

                  {/* Phase 8 — Biển số nhà (tách khỏi qrCode ở trên, xem module house-plates) */}
                  <div className="bg-surface-2 rounded-xl p-4 border border-line space-y-3">
                    <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider">
                      Biển số nhà
                    </h4>
                    {plateActionError && (
                      <p className="text-danger text-xs">{plateActionError}</p>
                    )}
                    {(() => {
                      const activePlate = plates.find(
                        (p) => p.status === PlateStatus.ISSUED || p.status === PlateStatus.INSTALLED,
                      );
                      const pastPlates = plates.filter((p) => p.id !== activePlate?.id);
                      return (
                        <>
                          {activePlate ? (
                            <div className="bg-surface p-3 rounded-lg border border-line space-y-2">
                              <div className="flex items-center space-x-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`${apiUrl}/api/house-plates/${activePlate.id}/qrcode.png`}
                                  alt="Mã QR biển số"
                                  className="w-14 h-14"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-xs font-bold text-fg truncate">
                                    {activePlate.plateCode}
                                  </p>
                                  <span
                                    className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      activePlate.status === PlateStatus.INSTALLED
                                        ? 'bg-ok/15 text-ok border-ok/30'
                                        : 'bg-warn/15 text-warn border-warn/30'
                                    }`}
                                  >
                                    {PLATE_STATUS_LABELS[activePlate.status]}
                                  </span>
                                  <p className="text-[10px] text-fg-subtle mt-0.5">
                                    {PLATE_ISSUE_REASON_LABELS[activePlate.issueReason]} lúc{' '}
                                    {new Date(activePlate.issuedAt).toLocaleString('vi-VN')}
                                  </p>
                                  {activePlate.notInstalledReason && (
                                    <p className="text-[10px] text-warn mt-0.5">
                                      Chưa gắn được: {activePlate.notInstalledReason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {activePlate.installPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openLightbox(`${apiUrl}${activePlate.installPhotoUrl}`, {
                                      uploadedBy: null,
                                      uploadedAt: activePlate.installedAt ?? null,
                                    })
                                  }
                                  className="block w-full text-left"
                                  title="Ảnh gắn biển — bấm để xem lớn"
                                >
                                  <p className="text-[10px] text-fg-subtle mb-1">
                                    Ảnh gắn biển
                                    {activePlate.installedAt
                                      ? ` • ${new Date(activePlate.installedAt).toLocaleString('vi-VN')}`
                                      : ''}
                                  </p>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`${apiUrl}${activePlate.installPhotoUrl}`}
                                    alt="Ảnh gắn biển số nhà"
                                    className="w-full max-h-48 object-cover rounded-lg border border-line"
                                  />
                                </button>
                              )}
                              {!!user && activePlate.status === PlateStatus.ISSUED && (
                                <button
                                  onClick={() => handleInstallPlate(activePlate.id)}
                                  disabled={plateActionLoading}
                                  className="w-full bg-ok hover:bg-ok/90 disabled:opacity-60 text-white text-xs font-semibold py-1.5 rounded-lg"
                                >
                                  Xác nhận đã gắn
                                </button>
                              )}
                              {canEdit && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleIssuePlate(PlateIssueReason.REPLACEMENT)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-line text-fg-muted hover:bg-surface-2 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Cấp đổi
                                  </button>
                                  <button
                                    onClick={() => handleIssuePlate(PlateIssueReason.REISSUE)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-line text-fg-muted hover:bg-surface-2 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Cấp lại
                                  </button>
                                  <button
                                    onClick={() => handleRevokePlate(activePlate.id)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-danger/30 text-danger hover:bg-danger/10 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Thu hồi
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <p className="text-xs text-fg-subtle mb-2">Chưa cấp biển số</p>
                              {canEdit && (
                                <button
                                  onClick={() => handleIssuePlate(PlateIssueReason.NEW)}
                                  disabled={plateActionLoading}
                                  className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                                >
                                  Cấp biển mới
                                </button>
                              )}
                            </div>
                          )}

                          {pastPlates.length > 0 && (
                            <details className="text-xs">
                              <summary className="text-fg-muted cursor-pointer select-none">
                                Lịch sử biển số ({pastPlates.length})
                              </summary>
                              <ul className="mt-2 space-y-1">
                                {pastPlates.map((p) => (
                                  <li key={p.id} className="text-fg-muted font-mono">
                                    {p.plateCode} — {PLATE_STATUS_LABELS[p.status]}
                                    {p.revokedReason ? ` (${p.revokedReason})` : ''}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {history.length > 0 && (
                    <div className="bg-surface-2 rounded-xl p-4 border border-line space-y-2">
                      <h4 className="font-bold text-xs uppercase text-fg-muted tracking-wider">
                        Lịch sử thay đổi
                      </h4>
                      <ul className="space-y-2 text-xs">
                        {history.map((h) => (
                          <li key={h.id} className="border-b border-line pb-2 last:border-0">
                            <span className="font-semibold">
                              {HISTORY_ACTION_LABELS[h.action] ?? h.action}
                            </span>{' '}
                            <span className="text-fg-subtle">
                              — {new Date(h.createdAt).toLocaleString('vi-VN')}
                            </span>
                            {' '}
                            <span className="text-fg-muted">
                              bởi{' '}
                              <span className="font-medium text-fg">
                                {h.changedBy
                                  ? `${h.changedBy.fullName} (${USER_ROLE_LABELS[h.changedBy.role]})`
                                  : 'Tài khoản đã xóa'}
                              </span>
                            </span>
                            {h.action === 'UPDATE' && Array.isArray(h.changes) && (
                              <ul className="mt-1 space-y-0.5 text-fg-muted">
                                {h.changes.map((c, i) => (
                                  <li key={i}>
                                    <span className="font-medium">{c.field}</span>:{' '}
                                    {String(c.old)} → {String(c.new)}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(h.action === 'PHOTO_ADD' || h.action === 'PHOTO_DELETE') &&
                              Array.isArray(h.changes) &&
                              h.changes.map((c, i) => {
                                const value = (c.new ?? c.old) as HousePhotoChangeValue | null;
                                if (!value) return null;
                                return (
                                  <div key={i} className="mt-1 flex items-center gap-2">
                                    <span className="text-fg-muted">
                                      {PHOTO_TYPE_LABELS[value.type] ?? value.type}
                                    </span>
                                    {h.action === 'PHOTO_ADD' && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={`${apiUrl}${value.url}`}
                                        alt=""
                                        onClick={() => openLightbox(`${apiUrl}${value.url}`)}
                                        className="w-10 h-10 object-cover rounded border border-line cursor-pointer hover:opacity-90 transition"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {detail && (
              <div className="p-4 bg-surface-2 border-t border-line shrink-0 space-y-2">
                <div className="flex gap-2">
                  <a
                    href={`/houses/${detail.id}/label`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-surface-2 hover:bg-line text-fg border border-line py-2 rounded-lg text-sm font-bold text-center"
                  >
                    In Tem QR
                  </a>
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(detail)}
                      className="flex-1 bg-brand hover:bg-brand/90 text-white py-2 rounded-lg text-sm font-bold"
                    >
                      Cập Nhật Thông Tin
                    </button>
                  )}
                </div>
                {canDelete && (
                  <button
                    onClick={() => handleDeleteHouse(detail)}
                    disabled={deleting}
                    className="w-full bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
                  >
                    {deleting ? 'Đang xóa…' : 'Xóa hồ sơ'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal thêm/sửa */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-soft w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-shell text-fg border-b border-line flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">
                {editingId ? 'Cập Nhật Hồ Sơ' : 'Thêm Số Nhà Mới'}
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2 transition"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto bg-surface-2">
              {formError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">
                  {formError}
                </div>
              )}

              <FormSection title="Chủ sở hữu & Đặc điểm công trình">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Chủ sở hữu" required>
                    <input
                      id="house-form-ownerName"
                      required
                      value={form.ownerName}
                      onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Số điện thoại">
                    <input
                      id="house-form-ownerPhone"
                      value={form.ownerPhone}
                      onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Số CCCD/CMND">
                    <input
                      id="house-form-ownerIdNumber"
                      value={form.ownerIdNumber}
                      onChange={(e) => setForm((f) => ({ ...f, ownerIdNumber: e.target.value }))}
                      placeholder="9 hoặc 12 chữ số"
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Hiện trạng nhà">
                    <select
                      id="house-form-usageStatus"
                      value={form.usageStatusId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, usageStatusId: e.target.value }))
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="">— Chưa xác định —</option>
                      {usageStatuses
                        .filter((u) => u.isActive || u.id === form.usageStatusId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Nhu cầu gắn biển">
                    <select
                      id="house-form-plateNeed"
                      value={form.plateNeed}
                      onChange={(e) => setForm((f) => ({ ...f, plateNeed: e.target.value as PlateNeed | '' }))}
                      className={FIELD_CLASS}
                    >
                      <option value="">— Chưa xác định —</option>
                      {Object.values(PlateNeed).map((p) => (
                        <option key={p} value={p}>
                          {PLATE_NEED_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <h4 className="text-[11px] font-bold text-accent uppercase tracking-wider border-t border-line pt-3">
                  Đặc điểm công trình
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Loại công trình">
                    <select
                      id="house-form-buildingType"
                      value={form.buildingType}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, buildingType: e.target.value as BuildingType }))
                      }
                      className={FIELD_CLASS}
                    >
                      {Object.values(BuildingType).map((t) => (
                        <option key={t} value={t}>
                          {BUILDING_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Số tầng">
                    <input
                      id="house-form-floors"
                      type="number"
                      min="0"
                      value={form.floors}
                      onChange={(e) => setForm((f) => ({ ...f, floors: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Diện tích (m²)">
                    <input
                      id="house-form-area"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.area}
                      onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Địa chỉ & Vị trí">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Số nhà" required>
                    <input
                      id="house-form-houseNumber"
                      required
                      disabled={numberLocked}
                      value={form.houseNumber}
                      onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
                      className={numberLocked ? `${FIELD_CLASS} opacity-60 cursor-not-allowed` : FIELD_CLASS}
                    />
                    {numberLocked ? (
                      <p className="text-danger text-xs mt-1">{numberLockMessage}</p>
                    ) : editingId ? (
                      <p className="text-fg-subtle text-xs mt-1">
                        Chỉ được sửa số nhà trong 48 giờ đầu.
                      </p>
                    ) : null}
                  </FormField>
                  <AddressComboField
                    label="Đường/Phố"
                    required
                    textValue={form.street}
                    idValue={form.streetId}
                    options={streets
                      .filter((s) => !form.wardId || s.wardId === form.wardId)
                      .map((s) => ({ id: s.id, name: s.name }))}
                    onSelect={(opt) =>
                      setForm((f) => ({
                        ...f,
                        streetId: opt?.id ?? '',
                        street: opt?.name ?? f.street,
                      }))
                    }
                    onManualText={(text) => setForm((f) => ({ ...f, streetId: '', street: text }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <AddressComboField
                    label="Phường/Xã"
                    required
                    disabled={hamletScoped}
                    textValue={form.ward}
                    idValue={form.wardId}
                    options={wards.map((w) => ({ id: w.id, name: w.name }))}
                    onSelect={(opt) =>
                      setForm((f) => ({ ...f, wardId: opt?.id ?? '', ward: opt?.name ?? f.ward }))
                    }
                    onManualText={(text) => setForm((f) => ({ ...f, wardId: '', ward: text }))}
                  />
                  {/* TN-09 — Ấp/Thôn (góp ý khách hàng 11/09/2026). Chỉ có FK (không có cột chữ tự
                      do song song như Đường/Phường ở schema.prisma) nên dùng select đơn giản, lọc
                      theo Phường/Xã đã chọn — giống cách `streets` đang lọc theo `form.wardId`. */}
                  <FormField label="Ấp/Thôn">
                    <select
                      value={form.hamletId}
                      onChange={(e) => setForm((f) => ({ ...f, hamletId: e.target.value }))}
                      disabled={hamletScoped}
                      title={hamletScoped ? 'Nhân sự ấp/thôn chỉ ghi nhận nhà trong ấp của mình' : undefined}
                      className={`${FIELD_CLASS} disabled:bg-surface-2`}
                    >
                      <option value="">-- Chọn --</option>
                      {hamlets
                        .filter((h) => !form.wardId || h.wardId === form.wardId)
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                    </select>
                  </FormField>
                </div>

                {/* <div className="grid grid-cols-2 gap-3">
                  <AddressComboField
                    label="Quận/Huyện/TP"
                    textValue={form.district}
                    idValue={form.districtId}
                    options={districts.map((d) => ({ id: d.id, name: d.name }))}
                    onSelect={(opt) =>
                      setForm((f) => ({
                        ...f,
                        districtId: opt?.id ?? '',
                        district: opt?.name ?? f.district,
                      }))
                    }
                    onManualText={(text) =>
                      setForm((f) => ({ ...f, districtId: '', district: text }))
                    }
                  />
                </div> */}

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Vĩ độ (Latitude)" required>
                    <input
                      id="house-form-latitude"
                      required
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                      className={`${FIELD_CLASS} font-mono`}
                    />
                  </FormField>
                  <FormField label="Kinh độ (Longitude)" required>
                    <input
                      id="house-form-longitude"
                      required
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                      className={`${FIELD_CLASS} font-mono`}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Số tờ bản đồ">
                    <input
                      id="house-form-soTo"
                      value={form.soTo}
                      onChange={(e) => setForm((f) => ({ ...f, soTo: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Số thửa đất">
                    <input
                      id="house-form-soThua"
                      value={form.soThua}
                      onChange={(e) => setForm((f) => ({ ...f, soThua: e.target.value }))}
                      className={FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Phía đường">
                    <select
                      id="house-form-side"
                      value={form.side}
                      onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as NumberingSide }))}
                      className={FIELD_CLASS}
                    >
                      {Object.values(NumberingSide).map((s) => (
                        <option key={s} value={s}>
                          {NUMBERING_SIDE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Trạng thái & Ghi chú">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Trạng thái">
                    <select
                      id="house-form-status"
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, status: e.target.value as HouseStatus }))
                      }
                      className={FIELD_CLASS}
                    >
                      {Object.values(HouseStatus).map((s) => (
                        <option key={s} value={s}>
                          {HOUSE_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  {editingId && (
                    <FormField label="Giai đoạn duyệt">
                      <select
                        id="house-form-reviewStage"
                        value={form.reviewStage}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, reviewStage: e.target.value as HouseReviewStage }))
                        }
                        className={FIELD_CLASS}
                      >
                        {Object.values(HouseReviewStage).map((s) => (
                          <option key={s} value={s}>
                            {HOUSE_REVIEW_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                </div>

                <FormField label="Ghi chú">
                  <textarea
                    id="house-form-note"
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className={FIELD_CLASS}
                  />
                </FormField>
              </FormSection>

              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-surface border border-line text-fg rounded-xl text-sm font-semibold hover:bg-surface-2 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-brand hover:bg-brand/90 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition shadow-soft flex items-center gap-2"
                >
                  {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-line/40 border-t-white animate-spin" />}
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup xem ảnh phóng to — kèm người upload & thời điểm upload */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[2000] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-fg-subtle"
            aria-label="Đóng"
            title="Đóng (Esc)"
          >
            ×
          </button>
          {lightbox.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox((current) =>
                    current
                      ? {
                          ...current,
                          index:
                            (current.index - 1 + current.images.length) % current.images.length,
                        }
                      : current,
                  );
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Ảnh trước"
                title="Ảnh trước (←)"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightbox((current) =>
                    current
                      ? { ...current, index: (current.index + 1) % current.images.length }
                      : current,
                  );
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                aria-label="Ảnh tiếp theo"
                title="Ảnh tiếp theo (→)"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <div
            className="flex flex-col items-center gap-3 max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {activeLightboxImage && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightboxImage.url}
                  alt="Ảnh phóng to"
                  className="max-w-full min-h-0 flex-1 rounded-lg shadow-2xl object-contain"
                />
              </>
            )}
            {(activeLightboxImage?.uploadedBy || activeLightboxImage?.uploadedAt) && (
              <div className="shrink-0 bg-black/70 text-white/80 rounded-lg px-4 py-2 text-xs text-center">
                Tải lên bởi{' '}
                <span className="font-semibold text-white">
                  {activeLightboxImage.uploadedBy
                    ? `${activeLightboxImage.uploadedBy.fullName} (${USER_ROLE_LABELS[activeLightboxImage.uploadedBy.role]})`
                    : 'không rõ'}
                </span>
                {activeLightboxImage.uploadedAt && (
                  <>
                    {' '}
                    —{' '}
                    {new Date(activeLightboxImage.uploadedAt).toLocaleString('vi-VN')}
                  </>
                )}
              </div>
            )}
            {lightbox.images.length > 1 && (
              <span className="shrink-0 rounded bg-black/60 px-3 py-1 text-xs text-white">
                {lightbox.index + 1} / {lightbox.images.length} · Dùng ←/→ để chuyển ảnh
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
