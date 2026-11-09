'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ImagePlus,
  Loader2,
  MapPinned,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  BUILDING_TYPE_LABELS,
  BuildingType,
  AssignmentStatus,
  NUMBERING_SIDE_LABELS,
  NumberingSide,
  PLATE_NEED_LABELS,
  PlateNeed,
  PhotoType,
  distanceToPathM,
  type Hamlet,
  type HouseSummary,
  type NearbyHouseItem,
  type OwnerSearchResult,
  type Street,
  type SurveyAssignment,
  type UsageStatusItem,
  type Ward,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { hamletsApi, streetsApi, usageStatusesApi, wardsApi } from '@/lib/addresses-api';
import { ApiError } from '@/lib/api';
import { compressPhoto, photoKey } from '@/lib/browser-photos';
import {
  MAX_PHOTOS,
  ROUTE_WARN_DISTANCE_M,
  createHouse,
  fetchHouse,
  fetchNearbyHouses,
  getAssignment,
  resurveyHouse as resurveyHouseApi,
  searchOwners,
  uploadHousePhoto,
} from '@/lib/survey-field-api';
import { clearActiveAssignmentId, getActiveAssignmentId } from '@/lib/survey-session';
import { FIELD_CLASS, FormField } from '@/components/ui';
import MapPickerModal from './MapPickerModal';

const DEFAULT_LAT = 11.3151;
const DEFAULT_LNG = 106.098;
const BUILDING_TYPES = Object.values(BuildingType);
const PLATE_NEEDS = Object.values(PlateNeed);
const SIDES = [NumberingSide.EVEN, NumberingSide.ODD];

type LocationSource = 'default' | 'gps' | 'map';

interface FormState {
  houseNumber: string;
  street: string;
  streetId: string;
  ward: string;
  wardId: string;
  hamletId: string;
  hamletName: string;
  side: NumberingSide | '';
  ownerName: string;
  ownerPhone: string;
  ownerIdNumber: string;
  usageStatusId: string;
  usageStatusName: string;
  plateNeed: PlateNeed | '';
  soTo: string;
  soThua: string;
  buildingType: BuildingType;
  floors: string;
  area: string;
  note: string;
  lat: number;
  lng: number;
  locationSource: LocationSource;
}

interface PhotoGroups {
  facade: File[];
  plate: File[];
  condition: File[];
}

interface OwnerFill {
  name: string;
  prev: Pick<
    FormState,
    | 'ownerName'
    | 'ownerPhone'
    | 'ownerIdNumber'
    | 'street'
    | 'streetId'
    | 'ward'
    | 'wardId'
    | 'hamletId'
    | 'hamletName'
  >;
}

function emptyForm(ward?: { id: string; name: string } | null): FormState {
  return {
    houseNumber: '',
    street: '',
    streetId: '',
    ward: ward?.name ?? '',
    wardId: ward?.id ?? '',
    hamletId: '',
    hamletName: '',
    side: '',
    ownerName: '',
    ownerPhone: '',
    ownerIdNumber: '',
    usageStatusId: '',
    usageStatusName: '',
    plateNeed: '',
    soTo: '',
    soThua: '',
    buildingType: BuildingType.SINGLE_HOUSE,
    floors: '',
    area: '',
    note: '',
    lat: DEFAULT_LAT,
    lng: DEFAULT_LNG,
    locationSource: 'default',
  };
}

function emptyPhotos(): PhotoGroups {
  return { facade: [], plate: [], condition: [] };
}

function houseToForm(house: HouseSummary): FormState {
  return {
    ...emptyForm(),
    houseNumber: house.houseNumber,
    street: house.street,
    streetId: house.streetId ?? '',
    ward: house.ward,
    wardId: house.wardId ?? '',
    hamletId: house.hamletId ?? '',
    hamletName: house.hamlet?.name ?? '',
    side: house.side === NumberingSide.NONE ? '' : house.side,
    ownerName: house.ownerName,
    ownerPhone: house.ownerPhone ?? '',
    ownerIdNumber: house.ownerIdNumber ?? '',
    usageStatusId: house.usageStatusId ?? '',
    usageStatusName: house.usageStatus?.name ?? '',
    plateNeed: house.plateNeed ?? '',
    soTo: house.soTo ?? '',
    soThua: house.soThua ?? '',
    buildingType: house.buildingType,
    floors: house.floors != null ? String(house.floors) : '',
    area: house.area != null ? String(house.area) : '',
    note: house.note ?? '',
    lat: house.latitude,
    lng: house.longitude,
    locationSource: 'map',
  };
}

function gpsErrorMessage(code: number) {
  if (code === 1) return 'Chưa cấp quyền vị trí cho ứng dụng.';
  if (code === 2) return 'Định vị đang tắt — bật Vị trí (GPS) trong cài đặt điện thoại rồi thử lại.';
  if (code === 3) return 'Không bắt được tín hiệu vị trí — ra chỗ thoáng rồi thử lại.';
  return 'Không lấy được vị trí hiện tại.';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function SurveyForm() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [photos, setPhotos] = useState<PhotoGroups>(emptyPhotos);
  const [ownerFill, setOwnerFill] = useState<OwnerFill | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [usageStatuses, setUsageStatuses] = useState<UsageStatusItem[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<SurveyAssignment | null>(null);
  const [resurveyId, setResurveyId] = useState<string | null>(null);
  const [resurveyHouse, setResurveyHouse] = useState<HouseSummary | null>(null);
  const [resurveyLoading, setResurveyLoading] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const resurveyRef = useRef(false);
  resurveyRef.current = !!resurveyId;
  const gettingGpsRef = useRef(false);
  const uploadedRef = useRef<Set<string>>(new Set());
  const createdHouseRef = useRef<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function defaultWard() {
    const zoneWard = activeAssignment?.zone.ward;
    if (zoneWard?.id) return { id: zoneWard.id, name: zoneWard.name };
    if (user?.wardId) {
      const name = user.ward?.name ?? wards.find((item) => item.id === user.wardId)?.name ?? '';
      if (name) return { id: user.wardId, name };
    }
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([wardsApi.list(), streetsApi.list(), usageStatusesApi.list()]).then((results) => {
      if (cancelled) return;
      if (results[0].status === 'fulfilled') setWards(results[0].value);
      if (results[1].status === 'fulfilled') setStreets(results[1].value);
      if (results[2].status === 'fulfilled') setUsageStatuses(results[2].value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.wardId) {
      setHamlets([]);
      return;
    }
    let cancelled = false;
    hamletsApi
      .list(form.wardId)
      .then((result) => {
        if (!cancelled) setHamlets(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form.wardId]);

  useEffect(() => {
    const id = getActiveAssignmentId();
    if (!id) return;
    getAssignment(id)
      .then((assignment) => {
        if (assignment.status === AssignmentStatus.IN_PROGRESS) setActiveAssignment(assignment);
        else clearActiveAssignmentId();
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (form.wardId || resurveyRef.current) return;
    const ward = defaultWard();
    if (ward) setForm((current) => (current.wardId ? current : { ...current, wardId: ward.id, ward: ward.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssignment, user, wards, form.wardId]);

  useEffect(() => {
    const houseId = new URLSearchParams(window.location.search).get('house');
    if (houseId) setResurveyId(houseId);
  }, []);

  useEffect(() => {
    if (!resurveyId) return;
    let cancelled = false;
    resurveyRef.current = true;
    uploadedRef.current.clear();
    createdHouseRef.current = null;
    setResurveyLoading(true);
    setError('');
    fetchHouse(resurveyId)
      .then((house) => {
        if (cancelled) return;
        setResurveyHouse(house);
        setForm(houseToForm(house));
        setPhotos(emptyPhotos());
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err, 'Không tải được nhà cần khảo sát lại. Cần có mạng để sửa hồ sơ.'));
        setResurveyId(null);
        router.replace('/survey/field');
      })
      .finally(() => {
        if (!cancelled) setResurveyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resurveyId, router]);

  useEffect(() => {
    const hasResurvey = new URLSearchParams(window.location.search).get('house');
    if (!hasResurvey && !resurveyRef.current) getGps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getGps(silent = false) {
    if (!navigator.geolocation) {
      if (!silent) setError('Thiết bị/trình duyệt không hỗ trợ định vị.');
      return;
    }
    if (silent && resurveyRef.current) return;
    if (gettingGpsRef.current) return;
    gettingGpsRef.current = true;
    setGettingGps(true);
    if (!silent) setError('');
    let settled = false;
    const done = () => {
      gettingGpsRef.current = false;
      setGettingGps(false);
    };
    const apply = (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      if (silent && resurveyRef.current) {
        done();
        return;
      }
      setForm((current) => ({
        ...current,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        locationSource: 'gps',
      }));
      done();
    };
    const fallback = (err: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      if (!silent) setError(gpsErrorMessage(err.code));
      done();
    };
    navigator.geolocation.getCurrentPosition(
      apply,
      () => {
        navigator.geolocation.getCurrentPosition(apply, fallback, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5 * 60 * 1000,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }

  function resetForm(autoGps = true) {
    createdHouseRef.current = null;
    uploadedRef.current.clear();
    setPhotos(emptyPhotos());
    setOwnerFill(null);
    setError('');
    setForm(emptyForm(defaultWard()));
    if (autoGps) getGps(true);
  }

  function applyOwner(owner: OwnerSearchResult, withArea: boolean) {
    setOwnerFill((current) => ({
      name: owner.ownerName,
      prev:
        current?.prev ?? {
          ownerName: form.ownerName,
          ownerPhone: form.ownerPhone,
          ownerIdNumber: form.ownerIdNumber,
          street: form.street,
          streetId: form.streetId,
          ward: form.ward,
          wardId: form.wardId,
          hamletId: form.hamletId,
          hamletName: form.hamletName,
        },
    }));
    setForm((current) => ({
      ...current,
      ownerName: owner.ownerName,
      ownerPhone: owner.ownerPhone ?? '',
      ownerIdNumber: owner.ownerIdNumber ?? '',
      ...(withArea && owner.latest
        ? {
            street: owner.latest.street,
            streetId: owner.latest.streetId ?? '',
            ward: owner.latest.ward,
            wardId: owner.latest.wardId ?? '',
            hamletId: owner.latest.hamletId ?? '',
            hamletName: owner.latest.hamletName ?? '',
          }
        : {}),
    }));
  }

  function handlePickOwner(owner: OwnerSearchResult) {
    const latest = owner.latest;
    const conflict =
      (!!latest && ((!!form.street && form.street !== latest.street) || (!!form.ward && form.ward !== latest.ward))) ||
      (!!form.ownerIdNumber && !!owner.ownerIdNumber && form.ownerIdNumber !== owner.ownerIdNumber);
    if (!conflict) {
      applyOwner(owner, true);
      return;
    }
    const overwrite = window.confirm(
      'Khu vực hoặc CCCD đang nhập khác với chủ hộ này.\n\nOK: điền cả khu vực\nCancel: chỉ điền thông tin chủ hộ',
    );
    applyOwner(owner, overwrite);
  }

  function handlePickNearby(house: NearbyHouseItem) {
    handlePickOwner({
      ownerName: house.ownerName,
      ownerPhone: house.ownerPhone,
      ownerIdNumber: house.ownerIdNumber,
      houseCount: 1,
      latest: {
        street: house.street,
        streetId: house.streetId,
        ward: house.ward,
        wardId: house.wardId,
        hamletId: house.hamletId,
        hamletName: house.hamletName,
      },
      houses: [
        {
          id: house.id,
          houseNumber: house.houseNumber,
          street: house.street,
          ward: house.ward,
          status: house.status,
        },
      ],
    });
  }

  function undoOwnerFill() {
    if (!ownerFill) return;
    setForm((current) => ({ ...current, ...ownerFill.prev }));
    setOwnerFill(null);
  }

  function exitResurvey(goToAssignments: boolean) {
    setResurveyId(null);
    setResurveyHouse(null);
    resurveyRef.current = false;
    uploadedRef.current.clear();
    resetForm(false);
    if (goToAssignments) router.push('/survey/assignments');
    else router.replace('/survey/field');
  }

  function cancelResurvey() {
    if (!window.confirm('Thoát khảo sát lại? Các thay đổi đang nhập sẽ không được lưu.')) return;
    exitResurvey(false);
  }

  function buildBody() {
    return {
      houseNumber: form.houseNumber.trim(),
      street: form.street.trim(),
      ward: form.ward.trim(),
      wardId: form.wardId || undefined,
      streetId: form.streetId || undefined,
      hamletId: form.hamletId || undefined,
      side: form.side || undefined,
      ownerName: form.ownerName.trim(),
      ownerPhone: form.ownerPhone.trim() || undefined,
      ownerIdNumber: form.ownerIdNumber.trim() || undefined,
      usageStatusId: form.usageStatusId || undefined,
      plateNeed: form.plateNeed || undefined,
      buildingType: form.buildingType,
      floors: form.floors ? Number(form.floors) : undefined,
      area: form.area ? Number(form.area) : undefined,
      soTo: form.soTo.trim() || undefined,
      soThua: form.soThua.trim() || undefined,
      latitude: form.lat,
      longitude: form.lng,
      note: form.note.trim() || undefined,
    };
  }

  function photoUploads() {
    return [
      ...photos.facade.map((file, index) => ({
        file,
        type: PhotoType.FACADE,
        key: `${PhotoType.FACADE}:${photoKey(file, index)}`,
      })),
      ...photos.plate.map((file, index) => ({
        file,
        type: PhotoType.PLATE,
        key: `${PhotoType.PLATE}:${photoKey(file, index)}`,
      })),
      ...photos.condition.map((file, index) => ({
        file,
        type: PhotoType.CONDITION,
        key: `${PhotoType.CONDITION}:${photoKey(file, index)}`,
      })),
    ];
  }

  async function performResurvey() {
    if (!resurveyHouse) return;
    setSaving(true);
    setError('');
    try {
      for (const photo of photoUploads()) {
        if (uploadedRef.current.has(photo.key)) continue;
        await uploadHousePhoto(resurveyHouse.id, photo.file, photo.type);
        uploadedRef.current.add(photo.key);
      }
      await resurveyHouseApi(resurveyHouse.id, buildBody());
      window.alert(`Đã cập nhật nhà số ${form.houseNumber}.`);
      exitResurvey(true);
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Không cập nhật được hồ sơ. Dữ liệu đang nhập vẫn được giữ — kiểm tra kết nối rồi thử lại.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function performSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let houseId = createdHouseRef.current;
      if (!houseId) {
        const house = await createHouse({
          ...buildBody(),
          surveyAssignmentId: activeAssignment?.id,
        });
        houseId = house.id;
        createdHouseRef.current = house.id;
      }
      for (const photo of photoUploads()) {
        if (uploadedRef.current.has(photo.key)) continue;
        await uploadHousePhoto(houseId, photo.file, photo.type);
        uploadedRef.current.add(photo.key);
      }
      resetForm();
      setNotice(`Đã gửi hồ sơ nhà số ${form.houseNumber}.`);
    } catch (err) {
      setError(
        createdHouseRef.current
          ? 'Hồ sơ đã được tạo nhưng ảnh chưa tải xong. Bấm Lưu hồ sơ lần nữa để gửi tiếp ảnh, không tạo trùng.'
          : errorMessage(err, 'Không lưu được hồ sơ. Dữ liệu đang nhập vẫn được giữ — kiểm tra kết nối rồi thử lại.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function validate() {
    if (!form.houseNumber.trim()) return 'Vui lòng nhập số nhà.';
    if (!form.street.trim()) return 'Vui lòng nhập đường.';
    if (!form.ward.trim()) return 'Vui lòng chọn phường/xã.';
    if (!form.ownerName.trim()) return 'Vui lòng nhập chủ hộ.';
    if (!resurveyHouse && !form.side) return 'Vui lòng chọn phía đường.';
    if (form.ownerIdNumber && !/^\d{9}$|^\d{12}$/.test(form.ownerIdNumber.trim())) {
      return 'CCCD/CMND phải gồm 9 hoặc 12 chữ số.';
    }
    if (form.floors) {
      const floors = Number(form.floors);
      if (!Number.isInteger(floors) || floors < 0) return 'Số tầng phải là số nguyên không âm.';
    }
    if (form.area) {
      const area = Number(form.area);
      if (!Number.isFinite(area) || area < 0) return 'Diện tích phải là số không âm.';
    }
    if (!Number.isFinite(form.lat) || !Number.isFinite(form.lng)) return 'Tọa độ nhà không hợp lệ.';
    return null;
  }

  function confirmPhotosAndSave() {
    if (resurveyHouse) {
      void performResurvey();
      return;
    }
    if (!photos.facade.length || !photos.plate.length) {
      if (!window.confirm('Chưa có ảnh mặt tiền hoặc biển số nhà. Vẫn lưu hồ sơ?')) return;
    }
    void performSave();
  }

  function handleSave() {
    if (saving || resurveyLoading) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!resurveyHouse && form.locationSource === 'default') {
      if (
        !window.confirm(
          'Chưa có tọa độ nhà thật, đang dùng tọa độ mặc định nên nhà sẽ nằm sai trên bản đồ.\n\nVẫn lưu hồ sơ?',
        )
      ) {
        return;
      }
    }
    confirmPhotosAndSave();
  }

  const streetOptions = useMemo(
    () => (form.wardId ? streets.filter((street) => street.wardId === form.wardId) : streets),
    [streets, form.wardId],
  );

  const wardOptions = useMemo(() => {
    const options = wards.map((ward) => ({ id: ward.id, name: ward.name }));
    if (form.wardId && !options.some((item) => item.id === form.wardId)) {
      options.unshift({ id: form.wardId, name: form.ward || 'Phường/xã đã chọn' });
    }
    return options;
  }, [wards, form.wardId, form.ward]);

  const hamletOptions = useMemo(() => {
    const options = hamlets.map((hamlet) => ({ id: hamlet.id, name: hamlet.name }));
    if (form.hamletId && !options.some((item) => item.id === form.hamletId)) {
      options.unshift({ id: form.hamletId, name: form.hamletName || 'Ấp đã chọn' });
    }
    return options;
  }, [hamlets, form.hamletId, form.hamletName]);

  const usageOptions = useMemo(() => {
    const options = usageStatuses.map((status) => ({ id: status.id, name: status.name }));
    if (form.usageStatusId && !options.some((item) => item.id === form.usageStatusId)) {
      options.unshift({ id: form.usageStatusId, name: form.usageStatusName || 'Hiện trạng đã chọn' });
    }
    return options;
  }, [usageStatuses, form.usageStatusId, form.usageStatusName]);

  const routeWarning = useMemo(() => {
    const path = activeAssignment?.route?.path;
    if (!path || path.length < 2 || form.locationSource === 'default') return null;
    const distance = distanceToPathM(form.lat, form.lng, path);
    return distance > ROUTE_WARN_DISTANCE_M ? distance : null;
  }, [activeAssignment, form.lat, form.lng, form.locationSource]);

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 space-y-3">
      <div>
        <h1 className="text-lg font-bold">{resurveyHouse ? 'Khảo sát lại nhà' : 'Khảo sát nhà'}</h1>
        <p className="text-xs text-fg-subtle">
          {activeAssignment ? 'Hồ sơ mới sẽ gắn vào nhiệm vụ đang chọn.' : 'Chưa chọn nhiệm vụ — hồ sơ vẫn được lưu.'}
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {resurveyId && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-danger">
                {resurveyHouse
                  ? `Đang khảo sát lại nhà số ${resurveyHouse.houseNumber} ${resurveyHouse.street}`
                  : 'Đang tải nhà cần khảo sát lại…'}
              </p>
              {resurveyHouse?.revisitReason && (
                <p className="text-xs text-danger/90">Lý do: {resurveyHouse.revisitReason}</p>
              )}
              {resurveyHouse && (
                <p className="text-[11px] text-fg-muted mt-1">
                  Đã có {resurveyHouse.photos?.length ?? 0} ảnh trên hệ thống. Ảnh chọn thêm sẽ được bổ sung.
                </p>
              )}
            </div>
            <button type="button" onClick={cancelResurvey} className="text-xs font-bold text-danger shrink-0">
              Thoát
            </button>
          </div>
          {resurveyLoading && <Loader2 className="w-4 h-4 animate-spin text-danger" />}
        </div>
      )}

      {activeAssignment && !resurveyId && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 space-y-1">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-accent">
                Đang khảo sát: {activeAssignment.zone.name}
                {activeAssignment.route ? ` · Tuyến ${activeAssignment.route.name}` : ''}
              </p>
              <p className="text-[11px] text-fg-muted">Nhà tạo mới sẽ gắn vào nhiệm vụ này để tính tiến độ.</p>
              {routeWarning && (
                <p className="text-[11px] font-semibold text-warn mt-1">
                  Cách tuyến khoảng{' '}
                  {routeWarning >= 1000 ? `${(routeWarning / 1000).toFixed(1)} km` : `${Math.round(routeWarning)} m`} — kiểm tra lại vị trí nhà.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                clearActiveAssignmentId();
                setActiveAssignment(null);
              }}
              className="text-xs font-bold text-accent shrink-0"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      <Section step="1" title="Vị trí nhà">
        <div
          className={`rounded-lg border px-3 py-2 font-mono text-sm ${
            form.locationSource === 'default'
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-line bg-surface-2/60'
          }`}
        >
          {form.lat.toFixed(6)}, {form.lng.toFixed(6)}
        </div>
        <p
          className={`text-xs ${
            form.locationSource === 'default'
              ? 'text-danger font-semibold'
              : form.locationSource === 'gps'
                ? 'text-ok'
                : 'text-accent'
          }`}
        >
          {form.locationSource === 'default'
            ? 'Chưa lấy vị trí — đang dùng tọa độ mặc định.'
            : form.locationSource === 'gps'
              ? 'Đã lấy vị trí GPS hiện tại.'
              : 'Vị trí đã chọn trên bản đồ.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => getGps(false)}
            disabled={gettingGps || saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent disabled:opacity-60"
          >
            {gettingGps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            Lấy GPS
          </button>
          <button
            type="button"
            onClick={() => setShowMap(true)}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-fg disabled:opacity-60"
          >
            <MapPinned className="w-4 h-4" />
            Chọn bản đồ
          </button>
        </div>
        {false && <NearbyOwners
          enabled={form.locationSource !== 'default'}
          lat={form.lat}
          lng={form.lng}
          onPick={handlePickNearby}
        />}
      </Section>

      <Section step="2" title="Chủ hộ">
        {ownerFill && (
          <div className="flex items-start gap-2 rounded-lg border border-ok/30 bg-ok/10 px-2.5 py-1.5 text-xs text-ok">
            <p className="flex-1">
              Đã điền chủ hộ <b>{ownerFill.name}</b> — kiểm tra lại, nhập số nhà và vị trí nhà mới.
            </p>
            <button type="button" onClick={undoOwnerFill} className="font-bold text-danger shrink-0">
              Bỏ điền
            </button>
          </div>
        )}
        <FormField label="Tên chủ hộ" required>
          <OwnerAutocomplete
            value={form.ownerName}
            onChange={(value) => update('ownerName', value)}
            onPick={handlePickOwner}
            placeholder="Nhập tên hoặc số điện thoại…"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Số điện thoại">
            <OwnerAutocomplete
              value={form.ownerPhone}
              onChange={(value) => update('ownerPhone', value)}
              onPick={handlePickOwner}
              placeholder="SĐT"
            />
          </FormField>
          <FormField label="CCCD/CMND">
            <input
              value={form.ownerIdNumber}
              onChange={(event) => update('ownerIdNumber', event.target.value)}
              inputMode="numeric"
              placeholder="9 hoặc 12 số"
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
        <div>
          <p className="text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">Nhu cầu gắn biển</p>
          <div className="flex flex-wrap gap-1.5">
            {PLATE_NEEDS.map((need) => (
              <button
                key={need}
                type="button"
                onClick={() => update('plateNeed', form.plateNeed === need ? '' : need)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  form.plateNeed === need
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface-2 text-fg-muted'
                }`}
              >
                {PLATE_NEED_LABELS[need]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Số tờ">
            <input
              value={form.soTo}
              onChange={(event) => update('soTo', event.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Số thửa">
            <input
              value={form.soThua}
              onChange={(event) => update('soThua', event.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
      </Section>

      <Section step="3" title="Địa chỉ">
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <FormField label="Số nhà" required>
            <input
              value={form.houseNumber}
              onChange={(event) => update('houseNumber', event.target.value)}
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Đường" required>
            <input
              value={form.street}
              onChange={(event) => {
                const value = event.target.value;
                const match = streetOptions.find((street) => street.name === value);
                setForm((current) => ({ ...current, street: value, streetId: match?.id ?? '' }));
              }}
              list="survey-streets"
              className={FIELD_CLASS}
            />
            <datalist id="survey-streets">
              {streetOptions.map((street) => (
                <option key={street.id} value={street.name} />
              ))}
            </datalist>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Phường/xã" required>
            <select
              value={form.wardId}
              onChange={(event) => {
                const wardId = event.target.value;
                const ward = wardOptions.find((item) => item.id === wardId);
                setForm((current) => ({
                  ...current,
                  wardId,
                  ward: ward?.name ?? '',
                  hamletId: '',
                  hamletName: '',
                }));
              }}
              className={FIELD_CLASS}
            >
              <option value="">— Chọn —</option>
              {wardOptions.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Ấp/tổ">
            <select
              value={form.hamletId}
              onChange={(event) => {
                const hamletId = event.target.value;
                const hamlet = hamletOptions.find((item) => item.id === hamletId);
                setForm((current) => ({
                  ...current,
                  hamletId,
                  hamletName: hamlet?.name ?? '',
                }));
              }}
              className={FIELD_CLASS}
              disabled={!form.wardId}
            >
              <option value="">— Không chọn —</option>
              {hamletOptions.map((hamlet) => (
                <option key={hamlet.id} value={hamlet.id}>
                  {hamlet.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div>
          <p className="text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
            Phía đường {!resurveyHouse && <span className="text-danger">*</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SIDES.map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => update('side', form.side === side ? '' : side)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  form.side === side
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-surface-2 text-fg-muted'
                }`}
              >
                {NUMBERING_SIDE_LABELS[side]}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section step="4" title="Công trình">
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Loại công trình">
            <select
              value={form.buildingType}
              onChange={(event) => update('buildingType', event.target.value as BuildingType)}
              className={FIELD_CLASS}
            >
              {BUILDING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {BUILDING_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Hiện trạng">
            <select
              value={form.usageStatusId}
              onChange={(event) => {
                const usageStatusId = event.target.value;
                const status = usageOptions.find((item) => item.id === usageStatusId);
                setForm((current) => ({
                  ...current,
                  usageStatusId,
                  usageStatusName: status?.name ?? '',
                }));
              }}
              className={FIELD_CLASS}
            >
              <option value="">— Không chọn —</option>
              {usageOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Số tầng">
            <input
              value={form.floors}
              onChange={(event) => update('floors', event.target.value)}
              inputMode="numeric"
              className={FIELD_CLASS}
            />
          </FormField>
          <FormField label="Diện tích (m²)">
            <input
              value={form.area}
              onChange={(event) => update('area', event.target.value)}
              inputMode="decimal"
              className={FIELD_CLASS}
            />
          </FormField>
        </div>
        <FormField label="Ghi chú">
          <textarea
            value={form.note}
            onChange={(event) => update('note', event.target.value)}
            rows={2}
            className={FIELD_CLASS}
          />
        </FormField>
      </Section>

      <Section step="5" title="Ảnh hiện trường">
        <PhotoPicker
          label="Ảnh mặt tiền"
          hint="Khuyến nghị tối thiểu 2 ảnh"
          files={photos.facade}
          max={MAX_PHOTOS}
          onChange={(files) => setPhotos((current) => ({ ...current, facade: files }))}
        />
        <PhotoPicker
          label="Ảnh biển số"
          hint="Khuyến nghị tối thiểu 2 ảnh"
          files={photos.plate}
          max={MAX_PHOTOS}
          onChange={(files) => setPhotos((current) => ({ ...current, plate: files }))}
        />
        <PhotoPicker
          label="Ảnh hiện trạng khác"
          hint="Tối đa 5 ảnh"
          files={photos.condition}
          max={MAX_PHOTOS}
          onChange={(files) => setPhotos((current) => ({ ...current, condition: files }))}
        />
      </Section>

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || resurveyLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-soft disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Đang lưu…' : resurveyHouse ? 'Cập nhật nhà' : 'Lưu hồ sơ'}
        </button>
      </div>

      {showMap && (
        <MapPickerModal
          lat={form.lat}
          lng={form.lng}
          onClose={() => setShowMap(false)}
          onConfirm={(lat, lng) => {
            setForm((current) => ({ ...current, lat, lng, locationSource: 'map' }));
            setShowMap(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-3.5 space-y-3">
      <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
        {step}. {title}
      </h2>
      {children}
    </section>
  );
}

function OwnerAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick: (owner: OwnerSearchResult) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<OwnerSearchResult[]>([]);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (pickedRef.current) {
      pickedRef.current = false;
      return;
    }
    if (!focused || value.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchOwners(value.trim(), controller.signal)
        .then(setResults)
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused]);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={FIELD_CLASS}
      />
      {focused && (searching || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-soft">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-fg-muted flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm…
            </p>
          ) : (
            results.map((owner, index) => (
              <button
                key={`${owner.ownerName}-${owner.ownerPhone ?? ''}-${owner.ownerIdNumber ?? ''}-${index}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  pickedRef.current = true;
                  setResults([]);
                  setFocused(false);
                  onPick(owner);
                }}
                className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-line last:border-0"
              >
                <span className="block text-xs font-bold flex items-center gap-1">
                  <Search className="w-3 h-3 text-fg-subtle" />
                  {owner.ownerName}
                </span>
                <span className="block text-[11px] text-fg-subtle mt-0.5">
                  {[owner.ownerPhone, owner.ownerIdNumber, `${owner.houseCount} nhà`].filter(Boolean).join(' · ')}
                </span>
                {owner.latest && (
                  <span className="block text-[11px] text-fg-muted">
                    {[owner.latest.street, owner.latest.ward].filter(Boolean).join(' ')}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NearbyOwners({
  enabled,
  lat,
  lng,
  onPick,
}: {
  enabled: boolean;
  lat: number;
  lng: number;
  onPick: (house: NearbyHouseItem) => void;
}) {
  const [items, setItems] = useState<NearbyHouseItem[]>([]);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    fetchNearbyHouses(lat, lng, radius, 8, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setItems(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, lat, lng, radius]);

  if (!enabled) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
          className="flex min-h-8 flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="text-xs font-bold">Chủ hộ gần bạn</span>
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {!collapsed && (
          <div className="flex gap-1">
            {[50, 100, 300].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRadius(value)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  radius === value ? 'bg-accent text-white' : 'bg-surface text-fg-muted border border-line'
                }`}
              >
                {value}m
              </button>
            ))}
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <p className="text-[11px] text-fg-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Đang tìm nhà gần…
            </p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-fg-subtle">Không có nhà nào trong {radius}m.</p>
          ) : (
            <div className="space-y-1">
              {items.map((house) => (
                <button
                  key={house.id}
                  type="button"
                  onClick={() => onPick(house)}
                  className="w-full flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 text-left border border-line"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">
                      {house.houseNumber} {house.street}
                    </p>
                    <p className="text-[10px] text-fg-muted truncate">{house.ownerName}</p>
                  </div>
                  <span className="text-[10px] text-fg-subtle shrink-0">{Math.round(house.distance)}m</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhotoPicker({
  label,
  hint,
  files,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  files: File[];
  max: number;
  onChange: (files: File[]) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function addFiles(list: FileList | null) {
    const slots = max - files.length;
    if (!list || slots <= 0) return;
    const picked = Array.from(list).slice(0, slots);
    if (!picked.length) return;
    setProcessing(true);
    try {
      const compressed: File[] = [];
      for (const file of picked) compressed.push(await compressPhoto(file));
      onChange([...files, ...compressed].slice(0, max));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{label}</p>
          <p className="text-[10px] text-fg-subtle">{hint}</p>
        </div>
        <span className="text-[10px] font-bold text-fg-muted">
          {files.length}/{max}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {previews.map((url, index) => (
          <div key={`${url}-${index}`} className="relative aspect-square rounded-lg overflow-hidden border border-line bg-surface-2">
            <button type="button" onClick={() => setViewing(url)} className="w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${label} ${index + 1}`} className="w-full h-full object-cover" />
            </button>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
              aria-label="Xóa ảnh"
              className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <>
            <button
              type="button"
              disabled={processing}
              onClick={() => cameraRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-line bg-surface-2/50 flex flex-col items-center justify-center gap-1 text-fg-muted disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span className="text-[10px] font-semibold">Chụp</span>
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => galleryRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-line bg-surface-2/50 flex flex-col items-center justify-center gap-1 text-fg-muted disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4" />
              <span className="text-[10px] font-semibold">Thư viện</span>
            </button>
          </>
        )}
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void addFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void addFiles(event.target.files);
          event.currentTarget.value = '';
        }}
      />
      {viewing && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt={label} className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setViewing(null)}
            aria-label="Đóng"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
