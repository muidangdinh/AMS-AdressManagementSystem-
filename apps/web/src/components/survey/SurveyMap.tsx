'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  X,
} from 'lucide-react';
import {
  BUILDING_TYPE_LABELS,
  HOUSE_STATUS_LABELS,
  PERMISSIONS,
  PHOTO_TYPE_LABELS,
  formatFullAddress,
  HouseStatus,
  type Hamlet,
  type HouseSummary,
  type NearbyHouseItem,
  type Street,
  type Ward,
} from '@tayninh/shared';
import { ApiError, apiFetch, getApiUrl } from '@/lib/api';
import { hamletsApi, streetsApi, wardsApi } from '@/lib/addresses-api';
import { useAppConfig } from '@/lib/app-config';
import { useAuth } from '@/lib/auth-context';
import { ButtonSpinner, FIELD_CLASS, StatusBadge } from '@/components/ui';
import type {
  FlyToRequest,
  HouseLocationAdjustment,
  HouseMapPoint,
  MapBounds,
} from '@/components/HouseMap';
import type { HouseMapLayer } from '@/components/map-types';

const HouseMap = dynamic(() => import('@/components/HouseMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-surface-2/40 text-sm text-fg-muted gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Đang tải bản đồ…
    </div>
  ),
});

const API_BASE = getApiUrl().replace(/\/$/, '');
const NEARBY_RADIUS_METERS = 500;
const NEARBY_LIMIT = 30;

const STATUS_CHIPS: { value: HouseStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: HouseStatus.APPROVED, label: 'Đã cấp biển' },
  { value: HouseStatus.PENDING, label: 'Chờ duyệt' },
  { value: HouseStatus.NEEDS_ADJUST, label: 'Cần hiệu chỉnh' },
];

const LAYER_OPTIONS: { value: HouseMapLayer; label: string }[] = [
  { value: 'street', label: 'Giao thông' },
  { value: 'satellite', label: 'Vệ tinh' },
];

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
      ownerName: string;
      status: HouseStatus;
      qrCode: string;
    };
  }[];
}

interface MapFilters {
  wardId: string;
  hamletId: string;
  streetId: string;
}

const EMPTY_FILTERS: MapFilters = { wardId: '', hamletId: '', streetId: '' };

function statusTone(status: HouseStatus): 'ok' | 'warn' | 'danger' {
  if (status === HouseStatus.APPROVED) return 'ok';
  if (status === HouseStatus.NEEDS_ADJUST) return 'danger';
  return 'warn';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDistance(distance: number) {
  return distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`;
}

function photoUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${API_BASE}${url}`;
}

export default function SurveyMap() {
  const { config } = useAppConfig();
  const { hasPermission } = useAuth();
  const canAdjustLocation = hasPermission(PERMISSIONS.HOUSE_LOCATION_UPDATE);

  const [houses, setHouses] = useState<HouseMapPoint[]>([]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [truncated, setTruncated] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HouseStatus | ''>('');
  const [filters, setFilters] = useState<MapFilters>(EMPTY_FILTERS);
  const activeFilterCount = [filters.wardId, filters.hamletId, filters.streetId].filter(Boolean).length;
  const [mapLayer, setMapLayer] = useState<HouseMapLayer>('street');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  const [wards, setWards] = useState<Ward[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [catalogError, setCatalogError] = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<MapFilters>(EMPTY_FILTERS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HouseSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [nearby, setNearby] = useState<NearbyHouseItem[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState('');

  const [adjustLocation, setAdjustLocation] = useState<HouseLocationAdjustment | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [photoIndex, setPhotoIndex] = useState<number | null>(null);

  const mapAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const nearbyAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void Promise.all([wardsApi.list(), hamletsApi.list(), streetsApi.list()])
      .then(([wardRows, hamletRows, streetRows]) => {
        setWards(wardRows);
        setHamlets(hamletRows);
        setStreets(streetRows);
      })
      .catch(() => setCatalogError('Không tải được danh mục địa chỉ.'));
  }, []);

  const fetchMapHouses = useCallback(
    async (nextBounds: MapBounds) => {
      mapAbortRef.current?.abort();
      const controller = new AbortController();
      mapAbortRef.current = controller;
      setMapLoading(true);
      setMapError('');

      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        if (filters.wardId) params.set('wardId', filters.wardId);
        if (filters.hamletId) params.set('hamletId', filters.hamletId);
        if (filters.streetId) params.set('streetId', filters.streetId);
        params.set('west', String(nextBounds.west));
        params.set('south', String(nextBounds.south));
        params.set('east', String(nextBounds.east));
        params.set('north', String(nextBounds.north));

        const res = await apiFetch<HouseGeoJson>(`/api/houses/geojson?${params.toString()}`, {
          signal: controller.signal,
        });
        setHouses(
          res.features.map((feature) => ({
            id: feature.properties.id,
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            houseNumber: feature.properties.houseNumber,
            street: feature.properties.street,
            ownerName: feature.properties.ownerName,
            status: feature.properties.status,
            qrCode: feature.properties.qrCode,
          })),
        );
        setTruncated(res.truncated);
        setNearby(null);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMapError(errorMessage(error, 'Không tải được lớp bản đồ.'));
      } finally {
        if (mapAbortRef.current === controller) setMapLoading(false);
      }
    },
    [search, status, filters.wardId, filters.hamletId, filters.streetId],
  );

  useEffect(() => {
    if (!bounds || adjustLocation) return;
    void fetchMapHouses(bounds);
  }, [bounds, adjustLocation, fetchMapHouses]);

  useEffect(() => {
    detailAbortRef.current?.abort();
    nearbyAbortRef.current?.abort();
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    setPhotoIndex(null);
    setNearby(null);
    setNearbyLoading(false);
  }, [search, status, filters.wardId, filters.hamletId, filters.streetId]);

  useEffect(
    () => () => {
      mapAbortRef.current?.abort();
      detailAbortRef.current?.abort();
      nearbyAbortRef.current?.abort();
    },
    [],
  );

  const handleBoundsChange = useCallback((nextBounds: MapBounds) => {
    setBounds((previous) =>
      previous &&
      previous.west === nextBounds.west &&
      previous.south === nextBounds.south &&
      previous.east === nextBounds.east &&
      previous.north === nextBounds.north
        ? previous
        : nextBounds,
    );
  }, []);

  async function openDetail(id: string) {
    detailAbortRef.current?.abort();
    nearbyAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    setSelectedId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    setNearby(null);
    setNearbyLoading(false);

    try {
      const house = await apiFetch<HouseSummary>(`/api/houses/${id}`, { signal: controller.signal });
      setDetail(house);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setDetailError(errorMessage(error, 'Không tải được hồ sơ nhà.'));
    } finally {
      if (detailAbortRef.current === controller) setDetailLoading(false);
    }
  }

  function closeDetail() {
    detailAbortRef.current?.abort();
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
    setDetailLoading(false);
    setPhotoIndex(null);
  }

  async function handleMapClick(lat: number, lng: number) {
    if (adjustLocation) return;
    detailAbortRef.current?.abort();
    nearbyAbortRef.current?.abort();
    const controller = new AbortController();
    nearbyAbortRef.current = controller;
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError('');
    setPhotoIndex(null);
    setNearbyLoading(true);
    try {
      const rows = await apiFetch<NearbyHouseItem[]>(
        `/api/houses/nearby?lat=${lat}&lng=${lng}&radius=${NEARBY_RADIUS_METERS}&limit=${NEARBY_LIMIT}`,
        { signal: controller.signal },
      );
      setNearby(rows);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast(errorMessage(error, 'Tra cứu nhà gần vị trí thất bại.'));
      setNearby(null);
    } finally {
      if (nearbyAbortRef.current === controller) setNearbyLoading(false);
    }
  }

  function pickNearby(house: NearbyHouseItem) {
    setNearby(null);
    setFlyToRequest({ lat: house.latitude, lng: house.longitude, nonce: Date.now() });
    void openDetail(house.id);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setToast('Thiết bị không hỗ trợ định vị GPS.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setFlyToRequest({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          nonce: Date.now(),
          myLocation: true,
        });
      },
      (error) => {
        setLocating(false);
        setToast(
          error.code === error.PERMISSION_DENIED
            ? 'Bạn chưa cấp quyền vị trí cho trình duyệt.'
            : 'Không lấy được vị trí hiện tại.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  }

  function openFilter() {
    nearbyAbortRef.current?.abort();
    setNearbyLoading(false);
    setDraftFilters(filters);
    setNearby(null);
    setFilterOpen(true);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setFilterOpen(false);
  }

  function draftWardChanged(wardId: string) {
    setDraftFilters({ wardId, hamletId: '', streetId: '' });
  }

  function startAdjustLocation() {
    if (!detail) return;
    setAdjustLocation({
      id: detail.id,
      latitude: detail.latitude,
      longitude: detail.longitude,
      houseNumber: detail.houseNumber,
      status: detail.status,
    });
    setPhotoIndex(null);
    setFlyToRequest({ lat: detail.latitude, lng: detail.longitude, nonce: Date.now() });
  }

  function cancelAdjustLocation() {
    setAdjustLocation(null);
  }

  async function saveAdjustLocation() {
    if (!adjustLocation) return;
    setSavingLocation(true);
    try {
      const updated = await apiFetch<HouseSummary>(`/api/houses/${adjustLocation.id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: adjustLocation.latitude,
          longitude: adjustLocation.longitude,
        }),
      });
      setHouses((current) =>
        current.map((house) =>
          house.id === updated.id
            ? { ...house, latitude: updated.latitude, longitude: updated.longitude }
            : house,
        ),
      );
      setDetail((current) =>
        current && current.id === updated.id
          ? { ...current, latitude: updated.latitude, longitude: updated.longitude }
          : current,
      );
      setAdjustLocation(null);
      setToast('Đã cập nhật vị trí nhà.');
      if (bounds) void fetchMapHouses(bounds);
    } catch (error) {
      setToast(errorMessage(error, 'Không lưu được vị trí nhà.'));
    } finally {
      setSavingLocation(false);
    }
  }

  const draftHamlets = useMemo(
    () => (draftFilters.wardId ? hamlets.filter((item) => item.wardId === draftFilters.wardId) : hamlets),
    [draftFilters.wardId, hamlets],
  );
  const draftStreets = useMemo(
    () =>
      draftFilters.wardId
        ? streets.filter((item) => item.wardId === draftFilters.wardId)
        : streets,
    [draftFilters.wardId, streets],
  );

  const photos = detail?.photos ?? [];
  const viewerPhoto = photoIndex !== null ? photos[photoIndex] : null;

  return (
    <div
      className="relative w-full overflow-hidden bg-surface-2/40"
      style={{ height: 'calc(100dvh - 3.5rem - 4rem - env(safe-area-inset-bottom))' }}
    >
      <HouseMap
        houses={houses}
        selectedHouseId={selectedId}
        onSelectHouse={openDetail}
        onMapClick={handleMapClick}
        flyToRequest={flyToRequest}
        adjustLocation={adjustLocation}
        onAdjustLocationChange={(lat, lng) =>
          setAdjustLocation((current) =>
            current ? { ...current, latitude: lat, longitude: lng } : current,
          )
        }
        onBoundsChange={handleBoundsChange}
        layer={mapLayer}
        onLayerChange={setMapLayer}
        showLayerToggle={false}
      />

      {!adjustLocation && (
        <div className="absolute inset-x-0 top-2 z-[500] px-2 space-y-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm số nhà, chủ hộ, SĐT, mã QR…"
                aria-label="Tìm nhà trên bản đồ"
                enterKeyHint="search"
                className="w-full h-10 rounded-xl border border-line bg-surface/95 pl-9 pr-9 text-sm text-fg shadow-card outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={openFilter}
              aria-label="Bộ lọc bản đồ"
              className="relative h-10 w-10 shrink-0 rounded-xl border border-line bg-surface/95 text-fg-muted shadow-card flex items-center justify-center active:scale-95 transition"
            >
              <Filter className="w-[18px] h-[18px]" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-0.5">
            {STATUS_CHIPS.map((chip) => {
              const active = status === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setStatus(chip.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-card transition ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-surface/95 text-fg-muted hover:text-fg'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!adjustLocation && (
        <div className="absolute left-3 bottom-4 z-[500] flex items-center gap-2">
          <div className="rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted shadow-card backdrop-blur">
            {mapLoading ? 'Đang tải…' : `${houses.length} nhà`}
            {truncated && !mapLoading ? ' · tối đa 2.000 điểm' : ''}
          </div>
        </div>
      )}

      {mapError && !adjustLocation && (
        <div className="absolute inset-x-3 top-32 z-[500] rounded-xl border border-danger/30 bg-danger/95 px-3 py-2 text-xs font-semibold text-white shadow-card">
          <div className="flex items-center gap-2">
            <span className="flex-1">{mapError}</span>
            <button
              type="button"
              onClick={() => bounds && void fetchMapHouses(bounds)}
              className="shrink-0 rounded-md bg-white/15 px-2 py-1"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {!adjustLocation && (
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label="Vị trí hiện tại"
          className="absolute right-3 bottom-4 z-[500] h-11 w-11 rounded-full border border-line bg-surface/95 text-accent shadow-card backdrop-blur flex items-center justify-center active:scale-95 transition disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
        </button>
      )}

      {!adjustLocation && (
        <div className="absolute right-3 bottom-20 z-[600]">
          {layerMenuOpen && (
            <div
              className="fixed inset-0 z-[550]"
              onClick={() => setLayerMenuOpen(false)}
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={() => setLayerMenuOpen((open) => !open)}
            aria-label="Lớp bản đồ"
            aria-expanded={layerMenuOpen}
            aria-haspopup="menu"
            className={`relative z-[600] h-11 w-11 rounded-full border shadow-card backdrop-blur flex items-center justify-center active:scale-95 transition ${
              layerMenuOpen || mapLayer === 'satellite'
                ? 'border-accent/40 bg-surface/95 text-accent'
                : 'border-line bg-surface/95 text-fg-muted'
            }`}
          >
            <Layers className="w-5 h-5" />
            {mapLayer === 'satellite' && !layerMenuOpen && (
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
          {layerMenuOpen && (
            <div
              role="menu"
              aria-label="Lớp bản đồ"
              className="absolute bottom-full right-0 z-[600] mb-2 w-40 overflow-hidden rounded-xl border border-line bg-surface/95 shadow-card backdrop-blur"
            >
              {LAYER_OPTIONS.map((option) => {
                const active = mapLayer === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setMapLayer(option.value);
                      setLayerMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                      active ? 'bg-accent/10 text-accent' : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    {option.label}
                    {active && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {adjustLocation && (
        <>
          <div className="absolute inset-x-3 top-3 z-[600] rounded-xl border border-accent/30 bg-surface/95 px-3 py-2 text-xs text-fg shadow-card backdrop-blur">
            <p className="font-bold text-accent">Điều chỉnh vị trí nhà số {adjustLocation.houseNumber}</p>
            <p className="text-fg-muted">Kéo marker trên bản đồ đến đúng vị trí rồi bấm Lưu.</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[600] border-t border-line bg-shell/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-lg gap-2">
              <button
                type="button"
                onClick={cancelAdjustLocation}
                disabled={savingLocation}
                className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveAdjustLocation}
                disabled={savingLocation}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingLocation && <ButtonSpinner light />}
                Lưu vị trí
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] font-mono text-fg-subtle">
              {adjustLocation.latitude.toFixed(6)}, {adjustLocation.longitude.toFixed(6)}
            </p>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed left-1/2 top-20 z-[1200] -translate-x-1/2 rounded-lg bg-fg px-3 py-2 text-xs font-semibold text-canvas shadow-lg">
          {toast}
        </div>
      )}

      {nearbyLoading && (
        <div className="fixed inset-0 z-[900] bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-semibold shadow-card">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            Đang tìm nhà gần đây…
          </div>
        </div>
      )}

      {nearby && (
        <Sheet title={`Nhà trong ${NEARBY_RADIUS_METERS}m`} onClose={() => setNearby(null)}>
          {nearby.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">
              Không có hồ sơ nhà trong bán kính {NEARBY_RADIUS_METERS}m.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-fg-muted">
                Chạm vào một dòng để xem chi tiết và bay tới vị trí.
              </p>
              {nearby.map((house) => (
                <button
                  key={house.id}
                  type="button"
                  onClick={() => pickNearby(house)}
                  className="w-full rounded-xl border border-line bg-surface-2/40 p-3 text-left hover:border-accent/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">Số {house.houseNumber} · {house.street}</p>
                      <p className="text-xs text-fg-muted truncate">{house.ownerName || 'Chưa rõ chủ hộ'}</p>
                      {house.hamletName && (
                        <p className="text-[11px] text-fg-subtle truncate">{house.hamletName}, {house.ward}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                      {formatDistance(house.distance)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}

      {filterOpen && (
        <Sheet title="Bộ lọc bản đồ" onClose={() => setFilterOpen(false)}>
          <div className="space-y-3">
            {catalogError && <p className="text-xs font-semibold text-danger">{catalogError}</p>}
            <div>
              <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
                Xã / Phường
              </label>
              <select
                value={draftFilters.wardId}
                onChange={(event) => draftWardChanged(event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Tất cả xã / phường</option>
                {wards.map((ward) => (
                  <option key={ward.id} value={ward.id}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
                Ấp / Thôn
              </label>
              <select
                value={draftFilters.hamletId}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, hamletId: event.target.value }))
                }
                className={FIELD_CLASS}
              >
                <option value="">Tất cả ấp / thôn</option>
                {draftHamlets.map((hamlet) => (
                  <option key={hamlet.id} value={hamlet.id}>
                    {hamlet.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
                Đường / Phố
              </label>
              <select
                value={draftFilters.streetId}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, streetId: event.target.value }))
                }
                className={FIELD_CLASS}
              >
                <option value="">Tất cả đường / phố</option>
                {draftStreets.map((street) => (
                  <option key={street.id} value={street.id}>
                    {street.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={clearFilters}
                className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg"
              >
                Xóa lọc
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="flex-1 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {(detailLoading || detailError || (detail && !adjustLocation)) && (
        <Sheet
          title={detail ? `Số ${detail.houseNumber} · ${detail.street}` : 'Chi tiết nhà'}
          onClose={closeDetail}
        >
          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-fg-muted">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              Đang tải hồ sơ…
            </div>
          ) : detailError ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-danger">{detailError}</p>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => void openDetail(selectedId)}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold"
                >
                  Thử lại
                </button>
              )}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
                    {detail.street}
                  </p>
                  <h3 className="text-xl font-extrabold">Số {detail.houseNumber}</h3>
                </div>
                <StatusBadge tone={statusTone(detail.status)}>
                  {HOUSE_STATUS_LABELS[detail.status]}
                </StatusBadge>
              </div>

              <p className="text-sm text-fg-muted">
                {formatFullAddress(
                  {
                    houseNumber: '',
                    street: '',
                    ward: detail.ward,
                    hamletName: detail.hamlet?.name,
                  },
                  config.provinceName,
                )}
              </p>

              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${detail.latitude},${detail.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-sm font-semibold text-fg hover:border-accent/50"
                >
                  <Navigation className="w-4 h-4 text-accent" />
                  Chỉ đường
                </a>
                {canAdjustLocation && (
                  <button
                    type="button"
                    onClick={startAdjustLocation}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-3 py-2.5 text-sm font-bold text-white"
                  >
                    <MapPin className="w-4 h-4" />
                    Điều chỉnh vị trí
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE}/api/houses/${detail.id}/qrcode.png`}
                  alt={`Mã QR nhà số ${detail.houseNumber}`}
                  className="h-24 w-24 shrink-0 rounded-lg bg-white p-1"
                />
                <div className="min-w-0 text-xs text-fg-muted space-y-1">
                  <p className="font-bold uppercase tracking-wide text-fg-subtle">Mã QR</p>
                  <p className="break-all font-mono font-semibold text-fg">{detail.qrCode}</p>
                  <p className="font-bold uppercase tracking-wide text-fg-subtle pt-1">Tọa độ GPS</p>
                  <p className="font-mono">
                    {detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}
                  </p>
                </div>
              </div>

              <section className="space-y-2 border-t border-line pt-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">Chủ hộ</h4>
                <p className="text-sm font-semibold">{detail.ownerName || '-'}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
                  {detail.ownerPhone ? (
                    <a href={`tel:${detail.ownerPhone}`} className="inline-flex items-center gap-1.5 text-accent">
                      <Phone className="w-3.5 h-3.5" />
                      {detail.ownerPhone}
                    </a>
                  ) : (
                    <span>Chưa có SĐT</span>
                  )}
                  <span>CCCD/CMND: {detail.ownerIdNumber || '-'}</span>
                </div>
              </section>

              <section className="space-y-2 border-t border-line pt-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">Công trình</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <p className="text-[11px] text-fg-subtle">Loại công trình</p>
                    <p className="font-semibold">{BUILDING_TYPE_LABELS[detail.buildingType]}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle">Số tầng</p>
                    <p className="font-semibold">{detail.floors ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle">Diện tích</p>
                    <p className="font-semibold">{detail.area ? `${detail.area} m²` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle">Thửa / Tờ</p>
                    <p className="font-semibold">
                      {detail.soThua || '-'} / {detail.soTo || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-fg-subtle">Hiện trạng</p>
                    <p className="font-semibold">{detail.usageStatus?.name ?? '-'}</p>
                  </div>
                </div>
              </section>

              {photos.length > 0 && (
                <section className="space-y-2 border-t border-line pt-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
                    Ảnh ({photos.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setPhotoIndex(index)}
                        className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl(photo.url)}
                          alt={PHOTO_TYPE_LABELS[photo.type]}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          {PHOTO_TYPE_LABELS[photo.type]}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </Sheet>
      )}

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-[1100] bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 text-white">
            <p className="text-sm font-semibold">{PHOTO_TYPE_LABELS[viewerPhoto.type]}</p>
            <button
              type="button"
              onClick={() => setPhotoIndex(null)}
              aria-label="Đóng ảnh"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(viewerPhoto.url)}
              alt={PHOTO_TYPE_LABELS[viewerPhoto.type]}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {photos.length > 1 && (
            <div className="shrink-0 flex items-center justify-between gap-3 p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() =>
                  setPhotoIndex((current) =>
                    current === null ? 0 : (current - 1 + photos.length) % photos.length,
                  )
                }
                aria-label="Ảnh trước"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-xs font-semibold text-white/80">
                {(photoIndex ?? 0) + 1} / {photos.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPhotoIndex((current) =>
                    current === null ? 0 : (current + 1) % photos.length,
                  )
                }
                aria-label="Ảnh sau"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-surface border border-line"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-map-sheet-title"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <h2 id="survey-map-sheet-title" className="text-sm font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-fg-subtle hover:text-fg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

