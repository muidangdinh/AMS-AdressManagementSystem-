'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  BUILDING_TYPE_LABELS,
  BuildingType,
  CreateHouseRequest,
  DEFAULT_PROVINCE_NAME,
  District,
  EDITOR_ROLES,
  formatFullAddress,
  Hamlet,
  HOUSE_STATUS_LABELS,
  HOUSE_USAGE_STATUS_LABELS,
  HouseUsageStatus,
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
  UserRole,
  Ward,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch, getApiUrl, getToken } from '@/lib/api';
import { districtsApi, hamletsApi, streetsApi, wardsApi } from '@/lib/addresses-api';
import { platesApi } from '@/lib/plates-api';
import { useWorkingWard } from '@/lib/working-ward';
import { fetchAppConfig } from '@/lib/app-config';
import type { FlyToRequest, HouseMapPoint } from '@/components/HouseMap';
import { FIELD_CLASS, FormSection, FormField } from '@/components/ui';

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
}: {
  label: string;
  required?: boolean;
  textValue: string;
  idValue: string;
  options: { id: string; name: string }[];
  onSelect: (option: { id: string; name: string } | null) => void;
  onManualText: (text: string) => void;
}) {
  const [manualMode, setManualMode] = useState(
    () => options.length === 0 || (!idValue && textValue !== ''),
  );

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {manualMode ? (
        <div className="flex gap-2">
          <input
            required={required}
            value={textValue}
            onChange={(e) => onManualText(e.target.value)}
            className={`flex-1 min-w-0 ${FIELD_CLASS}`}
          />
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap shrink-0"
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
          className={FIELD_CLASS}
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
    <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
      Đang tải bản đồ…
    </div>
  ),
});

const PAGE_SIZE = 20;
/** Cỡ mỗi lượt tải khi sắp xếp toàn bộ ở trình duyệt — bằng giới hạn pageSize tối đa của API. */
const SORT_FETCH_PAGE_SIZE = 100;
/** So sánh số nhà "tự nhiên": 2 < 10 < 12 < 12A < 12/3 (không so như chuỗi thuần "10" < "2"). */
const HOUSE_NUMBER_COLLATOR = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
/** Dưới bề rộng này (breakpoint `md` của Tailwind) danh sách cạnh bản đồ nổi đè và mặc định ẩn. */
const MOBILE_MAX_WIDTH = 768;
/** Bán kính mặc định khi bấm vào bản đồ để tra cứu số nhà xung quanh (mét). */
const NEARBY_RADIUS_METERS = 500;

const STATUS_BADGE: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [HouseStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
  [HouseStatus.NEEDS_ADJUST]: 'bg-rose-100 text-rose-800 border-rose-200',
};

/**
 * Màu badge cho `reviewStage` — ĐỘC LẬP với `status`/STATUS_BADGE ở trên (xem
 * ghi chú tại enum HouseReviewStage trong packages/shared).
 */
const REVIEW_STAGE_BADGE: Record<HouseReviewStage, string> = {
  [HouseReviewStage.PROPOSED]: 'bg-slate-100 text-slate-700 border-slate-200',
  [HouseReviewStage.CHECKED]: 'bg-sky-100 text-sky-800 border-sky-200',
  [HouseReviewStage.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [HouseReviewStage.SIGNED]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [HouseReviewStage.REJECTED]: 'bg-rose-100 text-rose-800 border-rose-200',
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
  usageStatus: HouseUsageStatus | '';
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
  usageStatus: '',
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
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));
    if (focusId && Number.isFinite(lat) && Number.isFinite(lng)) {
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
  const { user } = useAuth();
  const canEdit = !!user && EDITOR_ROLES.includes(user.role as UserRole);
  const apiUrl = getApiUrl();

  // Bộ lọc
  const [search, setSearch] = useState('');
  // TN-03 — mặc định lọc theo "xã đang làm việc" (nếu có chọn ở header),
  // vẫn đổi được bình thường qua dropdown bên dưới sau khi trang đã mở.
  const { ward: workingWard } = useWorkingWard();
  const [wardId, setWardId] = useState('');
  const [streetId, setStreetId] = useState('');
  const [status, setStatus] = useState<HouseStatus | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (workingWard) setWardId(workingWard.id);
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

  // Phase 6 — danh mục địa chỉ chuẩn hoá, dùng cho bộ lọc và dropdown trong form
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  // TN-09 — danh mục Ấp/Thôn (góp ý khách hàng 11/09/2026), lọc theo xã ở nơi dùng (giống streets/wardId).
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);

  useEffect(() => {
    districtsApi.list().then(setDistricts).catch(() => {});
    wardsApi.list().then(setWards).catch(() => {});
    streetsApi.list().then(setStreets).catch(() => {});
    hamletsApi.list().then(setHamlets).catch(() => {});
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
    url: string;
    uploadedBy: HouseUserRef | null;
    uploadedAt: string | null;
  } | null>(null);

  // Modal thêm/sửa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);

  // Bản đồ (Phase 3)
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  // Tham chiếu ổn định cho ResetToTableFromQuery — truyền hàm inline mỗi render sẽ khiến
  // effect của nó chạy lại liên tục và ép viewMode về 'table' ngay cả khi vừa chuyển sang 'map'.
  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null);
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
  // Xoá luôn flyToRequest cũ: bản đồ mount lại mỗi lần chuyển sang chế độ Bản đồ, nếu còn
  // giữ request cũ (vd vị trí GPS từ nút "Bản đồ số nhà") nó sẽ bay lại tới đó ngay lúc khởi tạo.
  const resetToTable = useCallback(() => {
    setViewMode('table');
    setFlyToRequest(null);
  }, []);
  const [mapHouses, setMapHouses] = useState<HouseMapPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
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
      const key = [search, streetId, wardId, status, sortDir].join('|');
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
        sortedCacheRef.current = { key: [search, streetId, wardId, status, sortDir].join('|'), items: all };
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
  }, [page, search, streetId, wardId, status, sortDir]);

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
      if (status) params.set('status', status);

      const token = getToken();
      const res = await fetch(`${apiUrl}/api/houses/export.xlsx?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
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

  const fetchMapHouses = useCallback(async () => {
    mapAbortRef.current?.abort();
    const controller = new AbortController();
    mapAbortRef.current = controller;

    setMapLoading(true);
    setMapError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (streetId) params.set('streetId', streetId);
      if (wardId) params.set('wardId', wardId);
      if (status) params.set('status', status);
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
    } finally {
      if (mapAbortRef.current === controller) setMapLoading(false);
    }
  }, [search, streetId, wardId, status]);

  useEffect(() => {
    if (viewMode === 'map') fetchMapHouses();
  }, [viewMode, fetchMapHouses]);

  /** Tra cứu theo tọa độ (I. "Tìm kiếm theo tọa độ") — bấm vào chỗ trống trên bản đồ. */
  async function handleMapClick(lat: number, lng: number) {
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
    selectAndFlyTo(id, lat, lng);
    if (window.innerWidth < MOBILE_MAX_WIDTH) setMapListOpen(false);
  }

  function selectAndFlyTo(id: string, lat: number, lng: number) {
    openDetail(id);
    setFlyToRequest({ lat, lng, nonce: Date.now() });
  }

  /** Đến từ Dashboard "Tra cứu nhanh" — ép sang chế độ bản đồ rồi bay tới vị trí. */
  function focusFromDashboard(id: string, lat: number, lng: number) {
    setViewMode('map');
    selectAndFlyTo(id, lat, lng);
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
    setForm(
      preset
        ? { ...emptyForm, latitude: preset.lat.toFixed(6), longitude: preset.lng.toFixed(6) }
        : emptyForm,
    );
    setFormError(null);
    setModalOpen(true);
  }

  /** Chuột phải trên bản đồ (chế độ Bản đồ) — mở form thêm số nhà, tọa độ lấy từ vị trí bấm. */
  function handleMapRightClick(lat: number, lng: number) {
    if (!canEdit) return;
    openCreateModal({ lat, lng });
  }

  function openEditModal(house: HouseSummary) {
    setEditingId(house.id);
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
      usageStatus: house.usageStatus ?? '',
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
    setSaving(true);
    setFormError(null);

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
      usageStatus: form.usageStatus || undefined,
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
      if (viewMode === 'map') await fetchMapHouses();
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
    if (!confirm('Xóa ảnh này?')) return;
    try {
      await apiFetch(`/api/houses/${selectedId}/photos/${photoId}`, { method: 'DELETE' });
      await openDetail(selectedId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Xóa ảnh thất bại');
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Nút chuyển Bảng/Bản đồ — dùng ở cả thanh bộ lọc đầy đủ lẫn dòng thu gọn.
  const viewModeSwitch = (
    <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm font-semibold">
      <button
        onClick={() => {
          setViewMode('table');
          setFlyToRequest(null);
        }}
        className={`px-3 py-2 transition ${
          viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        Bảng
      </button>
      <button
        onClick={() => {
          setViewMode('map');
          setFlyToRequest(null);
        }}
        className={`px-3 py-2 transition border-l border-slate-300 ${
          viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        Bản đồ
      </button>
    </div>
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
        <div className="bg-slate-900 px-6 py-2 flex flex-wrap gap-x-5 gap-y-1 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-slate-300">Tổng số nhà:</span>
            <span className="font-bold text-white">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-300">Đã cấp biển/QR:</span>
            <span className="font-bold text-emerald-400">{stats.approved}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-300">Chờ duyệt:</span>
            <span className="font-bold text-amber-400">{stats.pending}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-slate-300">Cần hiệu chỉnh:</span>
            <span className="font-bold text-rose-400">{stats.needsAdjust}</span>
          </div>
        </div>
      )}

      {/* Thanh bộ lọc */}
      {topBarCollapsed ? (
        <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTopBarOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            ▾ Bộ lọc &amp; thống kê
            {(search || wardId || streetId || status) && (
              <span className="w-2 h-2 rounded-full bg-blue-600" title="Đang có bộ lọc" />
            )}
          </button>
          {viewModeSwitch}
        </div>
      ) : (
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap gap-3 items-end shrink-0">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Tìm kiếm
          </label>
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            id="house-list-search"
            placeholder="Số nhà, chủ sở hữu, CCCD/CMND, mã QR..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div className="w-44">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Ấp/thôn
          </label>
          <select
            value={wardId}
            onChange={(e) => {
              setPage(1);
              setWardId(e.target.value);
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">-- Tất cả --</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Đường
          </label>
          <select
            value={streetId}
            onChange={(e) => {
              setPage(1);
              setStreetId(e.target.value);
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">-- Tất cả --</option>
            {streets
              .filter((s) => !wardId || s.wardId === wardId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
            Trạng thái
          </label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as HouseStatus | '');
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
        >
          {exporting ? 'Đang xuất…' : 'Xuất Excel'}
        </button>
        {canEdit && (
          <button
            onClick={() => openCreateModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
          >
            + Thêm số nhà
          </button>
        )}
        {viewMode === 'map' && (
          <button
            type="button"
            onClick={() => setTopBarOpen(false)}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            ▴ Thu gọn
          </button>
        )}
      </div>
      )}

      {viewMode === 'table' ? (
      /* Bảng danh sách */
      <div className="flex-1 overflow-auto p-6">
        {listError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm mb-4">
            {listError}
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Bấm lần lượt: bé → lớn, lớn → bé, bỏ sắp xếp (về thứ tự mới nhất như cũ).
                      setSortDir((d) => (d === null ? 'asc' : d === 'asc' ? 'desc' : null));
                      setPage(1);
                    }}
                    title="Sắp xếp theo số nhà"
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-800"
                  >
                    Số nhà
                    <span className={sortDir ? 'text-blue-600' : 'text-slate-300'}>
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
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Đang tải…
                  </td>
                </tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Không có hồ sơ nào phù hợp
                  </td>
                </tr>
              )}
              {!loading &&
                data?.items.map((house) => (
                  <tr
                    key={house.id}
                    onClick={() => openDetail(house.id)}
                    className="cursor-pointer hover:bg-blue-50/50"
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{house.houseNumber}</td>
                    <td className="px-4 py-3">{house.ownerName}</td>
                    <td className="px-4 py-3 text-xs">
                      {BUILDING_TYPE_LABELS[house.buildingType]}
                    </td>
                    <td className="px-4 py-3">{house.street}</td>
                    <td className="px-4 py-3">{house.ward}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {house.approvedAt ? new Date(house.approvedAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${STATUS_BADGE[house.status]}`}
                      >
                        {HOUSE_STATUS_LABELS[house.status]}
                      </span>
                      <span
                        className={`block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border w-fit ${REVIEW_STAGE_BADGE[house.reviewStage]}`}
                      >
                        {HOUSE_REVIEW_STAGE_LABELS[house.reviewStage]}
                      </span>
                    </td>
                    {/* <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {house.qrCode}
                    </td> */}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>
              Tổng {data.total} hồ sơ — Trang {data.page}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
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
                        className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Trang đầu
                      </button>
                    )}
                    {showFirstEllipsis && <span className="px-1 text-slate-400">…</span>}
                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 rounded border text-sm font-semibold ${
                          p === page
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    {showLastEllipsis && <span className="px-1 text-slate-400">…</span>}
                    {showLast && (
                      <button
                        onClick={() => setPage(totalPages)}
                        className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
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
                className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
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
            mapListOpen ? 'block' : 'hidden'
          } absolute inset-y-0 left-0 z-[1100] w-72 max-w-[85%] shadow-xl md:static md:z-auto md:w-80 md:max-w-none md:shadow-none shrink-0 border-r border-slate-200 bg-white overflow-y-auto p-3 space-y-2`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Danh sách số nhà ({(nearbyResults ?? mapHouses).length})
            </span>
            <button
              type="button"
              onClick={() => setMapListOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
            >
              Ẩn ✕
            </button>
          </div>
          {mapError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
              {mapError}
            </div>
          )}

          {nearbyResults !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-700">
                  Trong bán kính {NEARBY_RADIUS_METERS}m: {nearbyResults.length} hồ sơ
                </span>
                <button onClick={clearNearby} className="text-blue-600 hover:underline font-semibold">
                  Xóa
                </button>
              </div>
              <p className="text-blue-500">Vừa tra cứu theo tọa độ đã bấm trên bản đồ.</p>
            </div>
          )}

          {(mapLoading || nearbyLoading) && (
            <p className="text-slate-400 text-sm text-center py-4">Đang tải…</p>
          )}

          {!mapLoading && !nearbyLoading && (nearbyResults ?? mapHouses).length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">
              Không có hồ sơ nào phù hợp
            </p>
          )}

          {!mapLoading &&
            !nearbyLoading &&
            (nearbyResults
              ? nearbyResults.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => pickFromMapList(h.id, h.latitude, h.longitude)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-900">
                        Số {h.houseNumber} {h.street}
                      </h3>
                      <span className="text-[10px] font-mono text-blue-600 shrink-0 ml-2">
                        {h.distance}m
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{h.ownerName}</p>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[h.status]}`}
                    >
                      {HOUSE_STATUS_LABELS[h.status]}
                    </span>
                  </div>
                ))
              : mapHouses.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => pickFromMapList(h.id, h.latitude, h.longitude)}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <h3 className="font-bold text-sm text-slate-900">
                      Số {h.houseNumber} {h.street}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">{h.ownerName}</p>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[h.status]}`}
                    >
                      {HOUSE_STATUS_LABELS[h.status]}
                    </span>
                  </div>
                )))}
        </aside>

        <div className="flex-1 relative">
          {!mapListOpen && (
            <button
              type="button"
              onClick={() => setMapListOpen(true)}
              className="absolute top-3 left-3 z-[1000] bg-white rounded-lg shadow-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ☰ Danh sách ({(nearbyResults ?? mapHouses).length})
            </button>
          )}
          <HouseMap
            houses={mapHouses}
            onSelectHouse={openDetail}
            onMapClick={handleMapClick}
            onMapRightClick={handleMapRightClick}
            flyToRequest={flyToRequest}
          />
        </div>
      </div>
      )}

      {/* Drawer chi tiết */}
      {selectedId && (
        <div className="fixed inset-0 z-[600]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeDetail} />
          <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base">Chi Tiết Hồ Sơ Số Nhà</h2>
              <button onClick={closeDetail} className="text-slate-400 hover:text-white text-lg">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
                  {detailError}
                </div>
              )}
              {!detail && !detailError && <p className="text-slate-400 text-sm">Đang tải…</p>}
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
                    <h3 className="text-2xl font-extrabold text-slate-900">
                      Số {detail.houseNumber} {detail.street}
                    </h3>
                    {/* TN-21 — địa chỉ đầy đủ 5 cấp (góp ý khách hàng 11/09/2026): ấp, xã, tỉnh
                        (số nhà + đường đã hiện ở tiêu đề trên) — dùng chung công thức với mobile
                        qua `formatFullAddress` (truyền houseNumber/street rỗng để không lặp lại). */}
                    <p className="text-xs text-slate-500">
                      {formatFullAddress(
                        { houseNumber: '', street: '', ward: detail.ward, hamletName: detail.hamlet?.name },
                        provinceName,
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Khởi tạo bởi{' '}
                      <span className="font-medium text-slate-600">
                        {detail.createdBy
                          ? `${detail.createdBy.fullName} (${USER_ROLE_LABELS[detail.createdBy.role]})`
                          : 'Tài khoản đã xóa'}
                      </span>{' '}
                      — {new Date(detail.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                      Chủ sở hữu
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Họ tên</p>
                        <p className="font-semibold">{detail.ownerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Điện thoại</p>
                        <p className="font-semibold">{detail.ownerPhone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Số CCCD/CMND</p>
                        <p className="font-semibold">{detail.ownerIdNumber || '—'}</p>
                      </div>
                    </div>

                    <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider border-t border-slate-200 pt-3">
                      Đặc điểm công trình
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Loại nhà</p>
                        <p className="font-semibold text-xs">
                          {BUILDING_TYPE_LABELS[detail.buildingType]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Số tầng</p>
                        <p className="font-semibold">{detail.floors ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Diện tích</p>
                        <p className="font-semibold">
                          {detail.area ? `${detail.area} m²` : '—'}
                        </p>
                      </div>
                    </div>
                    {(detail.soTo || detail.soThua) && (
                      <p className="text-xs text-slate-500">
                        Thửa {detail.soThua ?? '—'} / Tờ {detail.soTo ?? '—'}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-sm border-t border-slate-200 pt-3">
                      <div>
                        <p className="text-xs text-slate-400">Hiện trạng nhà</p>
                        <p className="font-semibold text-xs">
                          {detail.usageStatus ? HOUSE_USAGE_STATUS_LABELS[detail.usageStatus] : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Nhu cầu gắn biển</p>
                        <p className="font-semibold text-xs">
                          {detail.plateNeed ? PLATE_NEED_LABELS[detail.plateNeed] : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Phía đường</p>
                        <p className="font-semibold text-xs">{NUMBERING_SIDE_LABELS[detail.side]}</p>
                      </div>
                    </div>
                    {detail.note && (
                      <p className="text-xs text-slate-500 border-t border-slate-200 pt-3">
                        Ghi chú: {detail.note}
                      </p>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
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
                            <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                              {group.label}
                            </h4>
                            {canEdit && (
                              <label className="text-xs text-blue-600 font-semibold cursor-pointer hover:underline">
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
                                    onClick={() =>
                                      setLightbox({
                                        url: `${apiUrl}${photo.url}`,
                                        uploadedBy: findUploader(photo.url),
                                        uploadedAt: photo.createdAt,
                                      })
                                    }
                                    className="w-full h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                  />
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeletePhoto(photo.id)}
                                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 mt-1">Chưa có ảnh</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                      Tọa độ GPS & Mã QR
                    </h4>
                    <div className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${apiUrl}/api/houses/${detail.id}/qrcode.png`}
                        alt="Mã QR"
                        className="w-16 h-16"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-slate-800 truncate">
                          {detail.qrCode}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          GPS: {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                        </p>
                        <a
                          href={`/lookup/${detail.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline"
                        >
                          Xem trang tra cứu công khai →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Phase 8 — Biển số nhà (tách khỏi qrCode ở trên, xem module house-plates) */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                      Biển số nhà
                    </h4>
                    {plateActionError && (
                      <p className="text-rose-600 text-xs">{plateActionError}</p>
                    )}
                    {(() => {
                      const activePlate = plates.find(
                        (p) => p.status === PlateStatus.ISSUED || p.status === PlateStatus.INSTALLED,
                      );
                      const pastPlates = plates.filter((p) => p.id !== activePlate?.id);
                      return (
                        <>
                          {activePlate ? (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                              <div className="flex items-center space-x-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`${apiUrl}/api/house-plates/${activePlate.id}/qrcode.png`}
                                  alt="Mã QR biển số"
                                  className="w-14 h-14"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-xs font-bold text-slate-800 truncate">
                                    {activePlate.plateCode}
                                  </p>
                                  <span
                                    className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      activePlate.status === PlateStatus.INSTALLED
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        : 'bg-amber-100 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    {PLATE_STATUS_LABELS[activePlate.status]}
                                  </span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {PLATE_ISSUE_REASON_LABELS[activePlate.issueReason]} lúc{' '}
                                    {new Date(activePlate.issuedAt).toLocaleString('vi-VN')}
                                  </p>
                                  {activePlate.notInstalledReason && (
                                    <p className="text-[10px] text-amber-600 mt-0.5">
                                      Chưa gắn được: {activePlate.notInstalledReason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {!!user && activePlate.status === PlateStatus.ISSUED && (
                                <button
                                  onClick={() => handleInstallPlate(activePlate.id)}
                                  disabled={plateActionLoading}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold py-1.5 rounded-lg"
                                >
                                  Xác nhận đã gắn
                                </button>
                              )}
                              {canEdit && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleIssuePlate(PlateIssueReason.REPLACEMENT)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Cấp đổi
                                  </button>
                                  <button
                                    onClick={() => handleIssuePlate(PlateIssueReason.REISSUE)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Cấp lại
                                  </button>
                                  <button
                                    onClick={() => handleRevokePlate(activePlate.id)}
                                    disabled={plateActionLoading}
                                    className="flex-1 border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-60 text-xs font-semibold py-1.5 rounded-lg"
                                  >
                                    Thu hồi
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-2">
                              <p className="text-xs text-slate-400 mb-2">Chưa cấp biển số</p>
                              {canEdit && (
                                <button
                                  onClick={() => handleIssuePlate(PlateIssueReason.NEW)}
                                  disabled={plateActionLoading}
                                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                                >
                                  Cấp biển mới
                                </button>
                              )}
                            </div>
                          )}

                          {pastPlates.length > 0 && (
                            <details className="text-xs">
                              <summary className="text-slate-500 cursor-pointer select-none">
                                Lịch sử biển số ({pastPlates.length})
                              </summary>
                              <ul className="mt-2 space-y-1">
                                {pastPlates.map((p) => (
                                  <li key={p.id} className="text-slate-500 font-mono">
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
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                      <h4 className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                        Lịch sử thay đổi
                      </h4>
                      <ul className="space-y-2 text-xs">
                        {history.map((h) => (
                          <li key={h.id} className="border-b border-slate-200 pb-2 last:border-0">
                            <span className="font-semibold">
                              {HISTORY_ACTION_LABELS[h.action] ?? h.action}
                            </span>{' '}
                            <span className="text-slate-400">
                              — {new Date(h.createdAt).toLocaleString('vi-VN')}
                            </span>
                            {' '}
                            <span className="text-slate-500">
                              bởi{' '}
                              <span className="font-medium text-slate-700">
                                {h.changedBy
                                  ? `${h.changedBy.fullName} (${USER_ROLE_LABELS[h.changedBy.role]})`
                                  : 'Tài khoản đã xóa'}
                              </span>
                            </span>
                            {h.action === 'UPDATE' && Array.isArray(h.changes) && (
                              <ul className="mt-1 space-y-0.5 text-slate-500">
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
                                    <span className="text-slate-500">
                                      {PHOTO_TYPE_LABELS[value.type] ?? value.type}
                                    </span>
                                    {h.action === 'PHOTO_ADD' && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={`${apiUrl}${value.url}`}
                                        alt=""
                                        onClick={() =>
                                          setLightbox({
                                            url: `${apiUrl}${value.url}`,
                                            uploadedBy: h.changedBy,
                                            uploadedAt: h.createdAt,
                                          })
                                        }
                                        className="w-10 h-10 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-90 transition"
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
              <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-2">
                <a
                  href={`/houses/${detail.id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-slate-700 hover:bg-slate-800 text-white py-2 rounded-lg text-sm font-bold text-center"
                >
                  In Tem QR
                </a>
                {canEdit && (
                  <button
                    onClick={() => openEditModal(detail)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold"
                  >
                    Cập Nhật Thông Tin
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal thêm/sửa */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-soft w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">
                {editingId ? 'Cập Nhật Hồ Sơ' : 'Thêm Số Nhà Mới'}
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto bg-slate-50">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
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
                      value={form.usageStatus}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, usageStatus: e.target.value as HouseUsageStatus | '' }))
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="">— Chưa xác định —</option>
                      {Object.values(HouseUsageStatus).map((s) => (
                        <option key={s} value={s}>
                          {HOUSE_USAGE_STATUS_LABELS[s]}
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

                <h4 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider border-t border-slate-200 pt-3">
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
                      value={form.houseNumber}
                      onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
                      className={FIELD_CLASS}
                    />
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
                      className={FIELD_CLASS}
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
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition shadow-soft flex items-center gap-2"
                >
                  {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
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
          className="fixed inset-0 z-[2000] bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-slate-300"
            aria-label="Đóng"
          >
            ×
          </button>
          <div
            className="flex flex-col items-center gap-3 max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt="Ảnh phóng to"
              className="max-w-full min-h-0 flex-1 rounded-lg shadow-2xl object-contain"
            />
            {(lightbox.uploadedBy || lightbox.uploadedAt) && (
              <div className="shrink-0 bg-slate-900/90 text-slate-200 rounded-lg px-4 py-2 text-xs text-center">
                Tải lên bởi{' '}
                <span className="font-semibold text-white">
                  {lightbox.uploadedBy
                    ? `${lightbox.uploadedBy.fullName} (${USER_ROLE_LABELS[lightbox.uploadedBy.role]})`
                    : 'không rõ'}
                </span>
                {lightbox.uploadedAt && (
                  <> — {new Date(lightbox.uploadedAt).toLocaleString('vi-VN')}</>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
