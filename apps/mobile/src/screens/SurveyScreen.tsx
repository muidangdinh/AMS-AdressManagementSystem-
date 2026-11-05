import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import NetInfo from '@react-native-community/netinfo';
import {
  BUILDING_TYPE_LABELS,
  BuildingType,
  PlateNeed,
  PLATE_NEED_LABELS,
  NumberingSide,
  NUMBERING_SIDE_LABELS,
  PhotoType,
  distanceToPathM,
  type HouseSummary,
  type NearbyHouseItem,
  type OwnerSearchResult,
  type SurveyAssignment,
  type Hamlet,
  type Street,
  type UsageStatusItem,
  type Ward,
} from '@tayninh/shared';
import { createDraft, syncDraft, uploadHousePhoto } from '../lib/surveyStore';
import { PHOTO_PICKER_OPTIONS } from '../lib/imageOptions';
import { fetchHamlets, fetchStreets, fetchUsageStatuses, fetchWards } from '../lib/addressCatalog';
import { getActiveAssignmentId, clearActiveAssignmentId } from '../lib/activeAssignment';
import { fetchHouse, getAssignment, resurveyHouse as resurveyHouseApi } from '../lib/surveysApi';
import { ApiError } from '../lib/api';
import type { MainTabsParamList } from '../navigation/MainTabs';
import { resolveWorkingWard } from '../lib/workingWard';
import { useAuth } from '../lib/AuthContext';
import LocationPickerModal from '../components/LocationPickerModal';
// import WardSelectorBar from '../components/WardSelectorBar';
import OwnerAutocompleteField from '../components/OwnerAutocompleteField';
import NearbyOwnersCard from '../components/NearbyOwnersCard';
import ImageViewer from '../components/ImageViewer';

const BUILDING_TYPES = Object.values(BuildingType);
const PLATE_NEEDS = Object.values(PlateNeed);
const MAX_PHOTOS = 5;
const MAX_REQUIRED_PHOTOS = 2;

/** Tọa độ mặc định: trung tâm TP. Tây Ninh — dùng khi chưa lấy được GPS thật. */
const DEFAULT_LAT = 11.3151;
const DEFAULT_LNG = 106.098;

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Quyền truy cập vị trí',
      message: 'Ứng dụng cần vị trí GPS để ghi tọa độ số nhà khảo sát.',
      buttonPositive: 'Đồng ý',
      buttonNegative: 'Từ chối',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Quyền truy cập máy ảnh',
      message: 'Ứng dụng cần máy ảnh để chụp ảnh khi khảo sát.',
      buttonPositive: 'Đồng ý',
      buttonNegative: 'Từ chối',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/** Thông báo lỗi định vị dễ hiểu theo mã lỗi chuẩn (1 = quyền, 2 = không có vị trí, 3 = hết giờ). */
function gpsErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return 'Chưa cấp quyền vị trí cho ứng dụng.';
    case 2:
      return 'Định vị đang tắt — bật Vị trí (GPS) trong cài đặt điện thoại rồi thử lại.';
    case 3:
      return "Không bắt được tín hiệu vị trí — ra chỗ thoáng rồi thử lại, hoặc dùng 'Chọn trên map'.";
    default:
      return 'Không lấy được vị trí hiện tại.';
  }
}

/** Mở action-sheet chụp hoặc chọn ảnh, giới hạn theo số ô còn trống. */
function pickPhotos(title: string, remainingSlots: number, onPicked: (uris: string[]) => void) {
  if (remainingSlots <= 0) return;
  Alert.alert(title, 'Chọn nguồn ảnh', [
    {
      text: 'Chụp ảnh mới',
      onPress: async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
          Alert.alert('Thiếu quyền', 'Cần cấp quyền máy ảnh để chụp ảnh.');
          return;
        }
        const result = await launchCamera(PHOTO_PICKER_OPTIONS);
        if (result.didCancel) return;
        if (result.errorCode) {
          Alert.alert('Lỗi máy ảnh', result.errorMessage ?? result.errorCode);
          return;
        }
        const uri = result.assets?.[0]?.uri;
        if (uri) onPicked([uri]);
      },
    },
    {
      text: 'Chọn từ thư viện',
      onPress: async () => {
        const result = await launchImageLibrary({
          ...PHOTO_PICKER_OPTIONS,
          selectionLimit: remainingSlots,
        });
        if (result.didCancel) return;
        if (result.errorCode) {
          Alert.alert('Lỗi thư viện ảnh', result.errorMessage ?? result.errorCode);
          return;
        }
        const uris = (result.assets ?? [])
          .map((asset) => asset.uri)
          .filter((uri): uri is string => !!uri);
        if (uris.length) onPicked(uris);
      },
    },
    { text: 'Hủy', style: 'cancel' },
  ]);
}

/** Đứng xa tuyến được giao quá khoảng này (mét) thì nhắc kiểm tra lại vị trí nhà. */
const ROUTE_WARN_DISTANCE_M = 200;

export default function SurveyScreen() {
  // Phase 11 Đợt 2b — chế độ "sửa lại nhà": vào từ tab Nhiệm Vụ với `resurveyHouseId` (nhà bị yêu cầu khảo sát lại).
  // Điền sẵn form từ server, gửi qua POST /houses/:id/resurvey (cần có mạng) thay vì tạo nhà mới trùng.
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const route = useRoute<RouteProp<MainTabsParamList, 'Survey'>>();
  const resurveyHouseId = route.params?.resurveyHouseId;
  const [resurveyHouse, setResurveyHouse] = useState<HouseSummary | null>(null);
  const [resurveyLoading, setResurveyLoading] = useState(false);
  // Chặn tự lấy GPS / tự điền xã ghi đè dữ liệu nhà đã điền sẵn.
  const resurveyRef = useRef(false);
  resurveyRef.current = !!resurveyHouseId;
  // Ảnh mới đã tải lên trong chế độ sửa lại — gửi lại sau lỗi mạng không bị tải trùng.
  const uploadedRef = useRef<Set<string>>(new Set());

  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [gettingGps, setGettingGps] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [streetId, setStreetId] = useState('');
  const [ward, setWard] = useState('');
  const [wardId, setWardId] = useState('');
  // TN-07 — Ấp/Thôn (góp ý khách hàng 11/09/2026). Chỉ có FK, không có cột chữ tự do song song
  // như street/ward — nên chỉ cần id + tên hiển thị (tra từ danh mục `hamlets` bên dưới).
  const [hamletId, setHamletId] = useState('');
  const [hamletName, setHamletName] = useState('');
  const [side, setSide] = useState<NumberingSide | ''>('');

  // Phase 6 — danh mục địa chỉ chuẩn hoá cho picker Đường/Phường. Tải 1 lần
  // khi mở màn hình; nếu offline thì bỏ qua lặng lẽ — form vẫn dùng được ở
  // chế độ nhập tay như trước (rất quan trọng cho khảo sát vùng sóng yếu).
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  // TN-07 — danh mục ấp PHỤ THUỘC xã đã chọn (Hamlet luôn thuộc 1 Ward) — tải lại mỗi khi đổi xã.
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);

  useEffect(() => {
    fetchWards().then(setWards).catch(() => {});
    fetchStreets().then(setStreets).catch(() => {});
    fetchUsageStatuses().then(setUsageStatuses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wardId) {
      setHamlets([]);
      return;
    }
    fetchHamlets(wardId).then(setHamlets).catch(() => {});
  }, [wardId]);

  /**
   * TN-08 — tự điền Phường/Xã theo "xã đang làm việc" (workingWard, xem
   * `lib/workingWard.ts`) mỗi khi mở màn hình với form còn trống — KHÔNG ghi
   * đè nếu người khảo sát đã chọn/đổi xã cho căn nhà đang nhập dở, tránh mất
   * dữ liệu đang gõ. Vẫn đổi được bình thường qua AddressPickerField bên dưới
   * (khách hàng xác nhận có cán bộ phụ trách nhiều xã — không khoá cứng).
   */
  useFocusEffect(
    useCallback(() => {
      if (wardId) return; // form đang có dữ liệu (đang nhập dở/vừa chọn tay) — không ghi đè
      resolveWorkingWard().then(({ ward: ww }) => {
        if (ww && !resurveyRef.current) {
          setWard(ww.name);
          setWardId(ww.id);
        }
      });
    }, [wardId]),
  );

  // Phase 9 — nhiệm vụ khảo sát đang chọn (tab Nhiệm Vụ) — tùy chọn, không bắt buộc (quyết
  // định #5): nếu có, House mới tạo tự gắn vào nhiệm vụ này để tính tiến độ; nếu không/offline
  // thì bỏ qua lặng lẽ, form vẫn hoạt động tự do như trước.
  const [activeAssignment, setActiveAssignment] = useState<SurveyAssignment | null>(null);

  // Tài khoản được gán đủ xã và ấp thì dùng địa bàn đó cho hồ sơ nhà mới, không chọn lại trên form.
  // Khảo sát lại giữ nguyên địa chỉ của hồ sơ hiện có.
  const { user } = useAuth();
  const hamletLock =
    user?.hamletId && user.wardId && !resurveyHouseId
      ? {
          wardId: user.wardId,
          wardName: user.ward?.name ?? '',
          hamletId: user.hamletId,
          hamletName: user.hamlet?.name ?? '',
        }
      : null;
  useEffect(() => {
    if (!hamletLock) return;
    if (wardId !== hamletLock.wardId) {
      setWardId(hamletLock.wardId);
      setWard(hamletLock.wardName);
    }
    if (hamletId !== hamletLock.hamletId) {
      setHamletId(hamletLock.hamletId);
      setHamletName(hamletLock.hamletName);
    }
    // Chạy lại sau mọi lần form bị đổi xã/ấp (reset, điền theo chủ hộ cũ, xã đang làm việc…).
  }, [hamletLock?.wardId, hamletLock?.hamletId, wardId, hamletId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tải nhiệm vụ đang chạy; trả về Promise để kéo-để-tải-lại chờ xong mới tắt vòng quay.
  const loadActiveAssignment = useCallback(async (isCancelled: () => boolean = () => false) => {
    const id = await getActiveAssignmentId();
    if (!id) {
      if (!isCancelled()) setActiveAssignment(null);
      return;
    }
    try {
      const a = await getAssignment(id);
      if (!isCancelled()) setActiveAssignment(a);
    } catch {
      if (!isCancelled()) setActiveAssignment(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadActiveAssignment(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [loadActiveAssignment]),
  );

  // Kéo xuống để tải lại danh mục (xã, đường, ấp, hiện trạng) và nhiệm vụ/tuyến đang chạy — KHÔNG đụng dữ liệu đang nhập trong form.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchWards().then(setWards).catch(() => {}),
      fetchStreets().then(setStreets).catch(() => {}),
      fetchUsageStatuses().then(setUsageStatuses).catch(() => {}),
      wardId ? fetchHamlets(wardId).then(setHamlets).catch(() => {}) : Promise.resolve(),
      loadActiveAssignment(),
    ]);
    setRefreshing(false);
  }, [wardId, loadActiveAssignment]);

  async function handleClearActiveAssignment() {
    await clearActiveAssignmentId();
    setActiveAssignment(null);
  }

  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerIdNumber, setOwnerIdNumber] = useState('');
  // Hiện trạng nhà: danh mục quản lý ở web; tên lưu riêng để vẫn hiển thị khi mục đã bị ẩn / chưa tải được danh mục.
  const [usageStatusId, setUsageStatusId] = useState('');
  const [usageStatusName, setUsageStatusName] = useState('');
  const [usageStatuses, setUsageStatuses] = useState<UsageStatusItem[]>([]);
  const usageStatusOptions = useMemo(() => {
    const opts = usageStatuses.map((u) => ({ id: u.id, name: u.name }));
    // Mục đang chọn (vd nhà cũ) có thể đã bị ẩn — vẫn giữ trong danh sách để hiển thị đúng.
    if (usageStatusId && !opts.some((o) => o.id === usageStatusId)) {
      opts.push({ id: usageStatusId, name: usageStatusName || 'Hiện trạng đã chọn' });
    }
    return opts;
  }, [usageStatuses, usageStatusId, usageStatusName]);
  const [plateNeed, setPlateNeed] = useState<PlateNeed | ''>('');
  const [soTo, setSoTo] = useState('');
  const [soThua, setSoThua] = useState('');
  const [buildingType, setBuildingType] = useState<BuildingType>(BuildingType.SINGLE_HOUSE);
  const [floors, setFloors] = useState('');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [facadePhotoUris, setFacadePhotoUris] = useState<string[]>([]);
  const [platePhotoUris, setPlatePhotoUris] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [viewer, setViewer] = useState<{ uris: string[]; index: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const noteFocused = useRef(false);

  // Nguồn của tọa độ đang hiển thị — 'default' nghĩa là vẫn là tọa độ mặc định (chưa lấy GPS /
  // chưa chọn trên bản đồ); lưu nhà lúc này sẽ đặt nhà sai chỗ nên cần cảnh báo.
  const [locationSource, setLocationSource] = useState<'default' | 'gps' | 'map'>('default');
  const locationSourceRef = useRef(locationSource);
  locationSourceRef.current = locationSource;
  // Chặn gọi GPS chồng nhau (tự lấy khi mở màn hình + bấm nút cùng lúc).
  const gettingGpsRef = useRef(false);

  /**
   * Lấy vị trí hiện tại của điện thoại. `silent` — dùng khi tự lấy (mở màn hình / sau khi lưu
   * xong 1 nhà): không bật popup lỗi, card Tọa độ tự hiện trạng thái "chưa lấy vị trí".
   */
  async function handleGetGps({ silent = false }: { silent?: boolean } = {}) {
    if (gettingGpsRef.current) return;
    if (silent && resurveyRef.current) return;
    gettingGpsRef.current = true;
    setGettingGps(true);
    const done = () => {
      gettingGpsRef.current = false;
      setGettingGps(false);
    };
    const applyPosition = (position: { coords: { latitude: number; longitude: number } }) => {
      // Lần lấy GPS tự động bắt đầu trước khi vào chế độ sửa lại — bỏ kết quả, giữ toạ độ nhà đã điền sẵn.
      if (silent && resurveyRef.current) {
        done();
        return;
      }
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      setLocationSource('gps');
      done();
    };
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        if (!silent) Alert.alert('Thiếu quyền', 'Cần cấp quyền vị trí để lấy tọa độ GPS.');
        done();
        return;
      }
      Geolocation.getCurrentPosition(
        applyPosition,
        (error) => {
          console.log('[GPS] high-accuracy fix failed:', error.code, error.message);
          // GPS vệ tinh không bắt được tín hiệu (trong nhà, cold start...) — thử lại
          // bằng định vị qua mạng (nhanh hơn) và chấp nhận vị trí gần đây (<=5 phút —
          // người khảo sát thường đứng yên tại căn nhà).
          Geolocation.getCurrentPosition(
            applyPosition,
            (fallbackError) => {
              console.log('[GPS] fallback fix failed:', fallbackError.code, fallbackError.message);
              if (!silent) Alert.alert('Lỗi GPS', gpsErrorMessage(fallbackError.code));
              done();
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch (error) {
      console.error('[GPS] unexpected error:', error);
      done();
    }
  }

  // Tự lấy GPS khi mở màn hình mà tọa độ vẫn là mặc định — không ghi đè tọa độ đã lấy/chọn
  // của căn nhà đang nhập dở.
  useFocusEffect(
    useCallback(() => {
      if (locationSourceRef.current === 'default') handleGetGps({ silent: true });
    }, []),
  );

  function handlePickPhoto() {
    if (photoUris.length >= MAX_PHOTOS) {
      Alert.alert('Đã đủ ảnh', `Chỉ được tối đa ${MAX_PHOTOS} ảnh — xóa bớt ảnh cũ để thêm ảnh mới.`);
      return;
    }
    const remainingSlots = MAX_PHOTOS - photoUris.length;

    Alert.alert('Ảnh khác (hiện trạng)', 'Chọn nguồn ảnh', [
      {
        text: 'Chụp ảnh mới',
        onPress: async () => {
          const hasPermission = await requestCameraPermission();
          if (!hasPermission) {
            Alert.alert('Thiếu quyền', 'Cần cấp quyền máy ảnh để chụp ảnh hiện trạng.');
            return;
          }
          const result = await launchCamera(PHOTO_PICKER_OPTIONS);
          if (result.didCancel) return;
          if (result.errorCode) {
            Alert.alert('Lỗi máy ảnh', result.errorMessage ?? result.errorCode);
            return;
          }
          const uri = result.assets?.[0]?.uri;
          if (uri) setPhotoUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
        },
      },
      {
        text: 'Chọn từ thư viện',
        onPress: async () => {
          // selectionLimit cho phép chọn nhiều ảnh cùng lúc trong 1 lần mở thư viện.
          const result = await launchImageLibrary({
            ...PHOTO_PICKER_OPTIONS,
            selectionLimit: remainingSlots,
          });
          if (result.didCancel) return;
          if (result.errorCode) {
            Alert.alert('Lỗi thư viện ảnh', result.errorMessage ?? result.errorCode);
            return;
          }
          const uris = (result.assets ?? [])
            .map((a) => a.uri)
            .filter((u): u is string => !!u);
          setPhotoUris((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
        },
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  }

  function removePhoto(index: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Reset form sau khi lưu xong 1 nhà — khảo sát nhiều nhà liên tục thường ở
   * cùng 1 xã, nên TN-08 tự điền lại Phường/Xã theo ngữ cảnh ngay sau reset
   * (không chờ focus lại màn hình, vì màn hình vẫn đang mở).
   */
  async function resetForm() {
    setHouseNumber('');
    setStreet('');
    setStreetId('');
    setWard('');
    setWardId('');
    setHamletId('');
    setHamletName('');
    setSide('');
    setOwnerName('');
    setOwnerPhone('');
    setOwnerIdNumber('');
    setUsageStatusId('');
    setUsageStatusName('');
    setPlateNeed('');
    setSoTo('');
    setSoThua('');
    setBuildingType(BuildingType.SINGLE_HOUSE);
    setFloors('');
    setArea('');
    setNote('');
    setFacadePhotoUris([]);
    setPlatePhotoUris([]);
    setPhotoUris([]);
    // Nhà kế tiếp ở vị trí khác — bỏ tọa độ cũ, tự lấy GPS lại (vẫn đang đứng ở hiện trường).
    setLocationSource('default');
    handleGetGps({ silent: true });

    const { ward: ww } = await resolveWorkingWard();
    if (ww) {
      setWard(ww.name);
      setWardId(ww.id);
    }
  }

  /**
   * Chủ hộ vừa được điền từ gợi ý, kèm giá trị cũ của các ô bị đổi để "Bỏ điền" hoàn lại đúng như trước.
   */
  const [ownerFill, setOwnerFill] = useState<{
    name: string;
    prev: {
      ownerName: string;
      ownerPhone: string;
      ownerIdNumber: string;
      street: string;
      streetId: string;
      ward: string;
      wardId: string;
      hamletId: string;
      hamletName: string;
    };
  } | null>(null);

  /** Điền thông tin chủ hộ (và khu vực nếu chọn) từ gợi ý — hồ sơ vẫn là nhà MỚI: số nhà, GPS, ảnh để trống. */
  function applyOwnerToForm(o: OwnerSearchResult, withArea: boolean) {
    // Lưu giá trị cũ để hoàn lại; nếu đang có 1 lần điền trước thì giữ mốc gốc (trước lần điền đầu tiên).
    setOwnerFill((cur) => ({
      name: o.ownerName,
      prev:
        cur?.prev ?? {
          ownerName,
          ownerPhone,
          ownerIdNumber,
          street,
          streetId,
          ward,
          wardId,
          hamletId,
          hamletName,
        },
    }));
    setOwnerName(o.ownerName);
    setOwnerPhone(o.ownerPhone ?? '');
    setOwnerIdNumber(o.ownerIdNumber ?? '');
    const l = o.latest;
    if (withArea && l) {
      setStreet(l.street);
      setStreetId(l.streetId ?? '');
      setWard(l.ward);
      setWardId(l.wardId ?? '');
      setHamletId(l.hamletId ?? '');
      setHamletName(l.hamletName ?? '');
    }
  }

  /** Chọn 1 nhà trong thẻ "Chủ hộ gần bạn" → dùng lại luồng điền chủ hộ (hỏi ghi đè nếu khu vực/CCCD khác). */
  function handlePickNearby(h: NearbyHouseItem) {
    handlePickOwner({
      ownerName: h.ownerName,
      ownerPhone: h.ownerPhone,
      ownerIdNumber: h.ownerIdNumber,
      houseCount: 1,
      latest: {
        street: h.street,
        streetId: h.streetId,
        ward: h.ward,
        wardId: h.wardId,
        hamletId: h.hamletId,
        hamletName: h.hamletName,
      },
      houses: [{ id: h.id, houseNumber: h.houseNumber, street: h.street, ward: h.ward, status: h.status }],
    });
  }

  function handlePickOwner(o: OwnerSearchResult) {
    const l = o.latest;
    // Khu vực/CCCD đang có chữ khác với chủ hộ được chọn → hỏi trước khi ghi đè.
    const conflict =
      (!!l && ((!!street && street !== l.street) || (!!ward && ward !== l.ward))) ||
      (!!ownerIdNumber && !!o.ownerIdNumber && ownerIdNumber !== o.ownerIdNumber);
    if (!conflict) {
      applyOwnerToForm(o, true);
      return;
    }
    Alert.alert('Ghi đè thông tin đang nhập?', 'Khu vực hoặc CCCD trong form đang khác với chủ hộ này.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chỉ điền chủ hộ', onPress: () => applyOwnerToForm(o, false) },
      { text: 'Điền cả khu vực', onPress: () => applyOwnerToForm(o, true) },
    ]);
  }

  function handleUndoOwnerFill() {
    if (!ownerFill) return;
    const p = ownerFill.prev;
    setOwnerName(p.ownerName);
    setOwnerPhone(p.ownerPhone);
    setOwnerIdNumber(p.ownerIdNumber);
    setStreet(p.street);
    setStreetId(p.streetId);
    setWard(p.ward);
    setWardId(p.wardId);
    setHamletId(p.hamletId);
    setHamletName(p.hamletName);
    setOwnerFill(null);
  }

  /** Điền sẵn toàn bộ form từ nhà trên server (chế độ sửa lại). */
  function applyHouseToForm(h: HouseSummary) {
    setHouseNumber(h.houseNumber);
    setStreet(h.street);
    setStreetId(h.streetId ?? '');
    setWard(h.ward);
    setWardId(h.wardId ?? '');
    setHamletId(h.hamletId ?? '');
    setHamletName(h.hamlet?.name ?? '');
    setSide(h.side === NumberingSide.NONE ? '' : h.side);
    setOwnerName(h.ownerName);
    setOwnerPhone(h.ownerPhone ?? '');
    setOwnerIdNumber(h.ownerIdNumber ?? '');
    setUsageStatusId(h.usageStatusId ?? '');
    setUsageStatusName(h.usageStatus?.name ?? '');
    setPlateNeed(h.plateNeed ?? '');
    setSoTo(h.soTo ?? '');
    setSoThua(h.soThua ?? '');
    setBuildingType(h.buildingType);
    setFloors(h.floors != null ? String(h.floors) : '');
    setArea(h.area != null ? String(h.area) : '');
    setNote(h.note ?? '');
    // Ảnh cũ nằm trên server (chỉ hiện số lượng); ảnh chọn ở đây là ảnh BỔ SUNG.
    setFacadePhotoUris([]);
    setPlatePhotoUris([]);
    setPhotoUris([]);
    // Toạ độ của chính nhà này — coi như đã xác nhận, không cảnh báo "toạ độ mặc định".
    setLat(h.latitude);
    setLng(h.longitude);
    setLocationSource('map');
  }

  useEffect(() => {
    if (!resurveyHouseId) return;
    let cancelled = false;
    setResurveyLoading(true);
    uploadedRef.current.clear();
    fetchHouse(resurveyHouseId)
      .then((h) => {
        if (cancelled) return;
        applyHouseToForm(h);
        setResurveyHouse(h);
      })
      .catch((e) => {
        if (cancelled) return;
        Alert.alert(
          'Không tải được nhà',
          e instanceof ApiError ? e.message : 'Cần có mạng để sửa lại nhà — kiểm tra kết nối rồi thử lại.',
        );
        navigation.setParams({ resurveyHouseId: undefined });
      })
      .finally(() => {
        if (!cancelled) setResurveyLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resurveyHouseId]);

  /** Thoát chế độ sửa lại (đã gửi xong hoặc người dùng bỏ) — trả form về trạng thái khảo sát nhà mới. */
  async function exitResurvey(goToAssignments: boolean) {
    navigation.setParams({ resurveyHouseId: undefined });
    resurveyRef.current = false;
    setResurveyHouse(null);
    uploadedRef.current.clear();
    await resetForm();
    if (goToAssignments) navigation.navigate('Assignments');
  }

  function handleCancelResurvey() {
    Alert.alert('Thoát chế độ sửa lại', 'Các thay đổi đang nhập sẽ không được lưu.', [
      { text: 'Tiếp tục sửa', style: 'cancel' },
      { text: 'Thoát', style: 'destructive', onPress: () => exitResurvey(false) },
    ]);
  }

  /**
   * Gửi bản sửa lại (cần có mạng). Ảnh bổ sung tải TRƯỚC (bỏ qua ảnh đã tải ở lần thử trước), sửa thông tin SAU CÙNG:
   * nếu bước cuối lỗi thì cờ "cần khảo sát lại" vẫn còn, bấm gửi lại được mà không bị trùng ảnh.
   */
  async function performResurvey() {
    if (!resurveyHouse) return;
    setSaving(true);
    try {
      const uploads = [
        ...facadePhotoUris.map((uri) => ({ uri, type: PhotoType.FACADE })),
        ...platePhotoUris.map((uri) => ({ uri, type: PhotoType.PLATE })),
        ...photoUris.map((uri) => ({ uri, type: PhotoType.CONDITION })),
      ];
      for (const [index, photo] of uploads.entries()) {
        if (uploadedRef.current.has(photo.uri)) continue;
        await uploadHousePhoto(resurveyHouse.id, photo, `resurvey-${resurveyHouse.id}-${index}.jpg`);
        uploadedRef.current.add(photo.uri);
      }
      await resurveyHouseApi(resurveyHouse.id, {
        houseNumber,
        street,
        streetId: streetId || undefined,
        ward,
        wardId: wardId || undefined,
        hamletId: hamletId || undefined,
        side: side || undefined,
        ownerName,
        ownerPhone: ownerPhone || undefined,
        ownerIdNumber: ownerIdNumber || undefined,
        usageStatusId: usageStatusId || undefined,
        plateNeed: plateNeed || undefined,
        buildingType,
        floors: floors ? Number(floors) : undefined,
        area: area ? Number(area) : undefined,
        soTo: soTo || undefined,
        soThua: soThua || undefined,
        latitude: lat,
        longitude: lng,
        note: note || undefined,
      });
      Alert.alert('Đã gửi', `Nhà số ${houseNumber} đã được cập nhật.`);
      await exitResurvey(true);
    } catch (e) {
      const network = await NetInfo.fetch();
      Alert.alert(
        !network.isConnected || network.isInternetReachable === false ? 'Cần có mạng' : 'Cập nhật thất bại',
        !network.isConnected || network.isInternetReachable === false
          ? 'Không có kết nối mạng. Dữ liệu đang nhập vẫn được giữ, hãy thử lại khi có mạng.'
          : e instanceof ApiError
            ? e.message
            : 'Không cập nhật được hồ sơ. Dữ liệu đang nhập vẫn được giữ.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function performSave(saveTemporarily = false) {
    const network = await NetInfo.fetch();
    const isOffline = !network.isConnected || network.isInternetReachable === false;
    if (isOffline && !saveTemporarily) {
      Alert.alert(
        'Không có kết nối mạng',
        'Bạn có muốn lưu hồ sơ tạm trên thiết bị để đồng bộ khi có mạng không?',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Xác nhận lưu tạm', onPress: async () => { await performSave(true); } },
        ],
      );
      return;
    }

    setSaving(true);
    try {
      const draft = await createDraft({
        houseNumber,
        street,
        streetId: streetId || undefined,
        ward,
        wardId: wardId || undefined,
        hamletId: hamletId || undefined,
        side: side || undefined,
        surveyAssignmentId: activeAssignment?.id,
        ownerName,
        ownerPhone: ownerPhone || undefined,
        ownerIdNumber: ownerIdNumber || undefined,
        usageStatusId: usageStatusId || undefined,
        plateNeed: plateNeed || undefined,
        buildingType,
        floors: floors ? Number(floors) : undefined,
        area: area ? Number(area) : undefined,
        soTo: soTo || undefined,
        soThua: soThua || undefined,
        latitude: lat,
        longitude: lng,
        facadePhotoUris,
        platePhotoUris,
        photoUris,
        note: note || undefined,
      });

      if (isOffline) {
        Alert.alert('Đã lưu tạm', 'Hồ sơ đã được lưu trên thiết bị và sẽ tự đồng bộ khi có mạng.');
      } else {
        try {
          await syncDraft(draft);
          Alert.alert('Thành công', 'Đã gửi hồ sơ lên hệ thống.');
        } catch (error) {
          const currentNetwork = await NetInfo.fetch();
          if (!currentNetwork.isConnected || currentNetwork.isInternetReachable === false) {
            Alert.alert('Đã lưu tạm', 'Mất kết nối mạng khi gửi. Hồ sơ đã lưu trên máy và sẽ tự đồng bộ khi có mạng.');
          } else {
            Alert.alert(
              'Gửi hồ sơ thất bại',
              error instanceof ApiError
                ? error.message
                : 'Không gửi được hồ sơ lên hệ thống. Hồ sơ vẫn được giữ trên máy để thử lại.',
            );
          }
        }
      }
      await resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!houseNumber || !street || !ward || !ownerName || !side) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đủ Số nhà, Đường, Phường/Xã, Chủ hộ, Phía đường.');
      return;
    }
    // Tọa độ vẫn là mặc định (quên lấy GPS / GPS lỗi) — nhà sẽ nằm sai chỗ trên bản đồ. Cảnh báo
    // mềm, vẫn cho lưu (offline-first, có khi không bắt được vị trí ở hiện trường).
    if (locationSource === 'default') {
      Alert.alert(
        'Chưa có tọa độ nhà',
        'Đang dùng tọa độ mặc định (trung tâm TP. Tây Ninh) — nhà sẽ nằm sai chỗ trên bản đồ.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Lấy GPS', onPress: () => handleGetGps() },
          { text: 'Chọn trên bản đồ', onPress: () => setPickerVisible(true) },
          { text: 'Vẫn lưu', onPress: () => confirmPhotosAndSave() },
        ],
      );
      return;
    }
    await confirmPhotosAndSave();
  }

  async function confirmPhotosAndSave() {
    if (resurveyHouse) {
      const network = await NetInfo.fetch();
      if (!network.isConnected || network.isInternetReachable === false) {
        Alert.alert('Cần có mạng', 'Khảo sát lại cần kết nối mạng để cập nhật hồ sơ. Dữ liệu đang nhập vẫn được giữ.');
        return;
      }
      await performResurvey();
      return;
    }
    // Cảnh báo mềm — không chặn cứng, vì hiện trường nhiều khi không chụp được đủ ảnh.
    if (!facadePhotoUris.length || !platePhotoUris.length) {
      Alert.alert('Thiếu ảnh', 'Chưa có đủ ảnh mặt tiền/biển số nhà. Vẫn lưu hồ sơ?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Vẫn lưu', onPress: () => performSave() },
      ]);
      return;
    }
    await performSave();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* keyboardShouldPersistTaps: chạm dòng gợi ý chủ hộ khi bàn phím đang mở vẫn nhận ngay cú chạm đầu. */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        onLayout={() => {
          if (noteFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
      {/* <WardSelectorBar /> */}

      {(resurveyHouseId || resurveyHouse) && (
        <View style={styles.resurveyBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resurveyBannerTitle}>
              {resurveyHouse
                ? `Đang khảo sát lại nhà số ${resurveyHouse.houseNumber} ${resurveyHouse.street}`
                : 'Đang tải nhà cần khảo sát lại…'}
            </Text>
            {!!resurveyHouse?.revisitReason && (
              <Text style={styles.resurveyBannerSub}>Lý do: {resurveyHouse.revisitReason}</Text>
            )}
            {resurveyHouse && (
              <Text style={styles.resurveyBannerSub}>
                Nhà đã có {resurveyHouse.photos?.length ?? 0} ảnh — ảnh chọn thêm ở dưới sẽ được bổ sung. Cần có mạng để gửi.
              </Text>
            )}
          </View>
          {resurveyLoading ? (
            <ActivityIndicator color="#b91c1c" />
          ) : (
            <TouchableOpacity onPress={handleCancelResurvey}>
              <Text style={styles.resurveyBannerClear}>Thoát</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeAssignment && !resurveyHouseId && (
        <View style={styles.assignmentBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.assignmentBannerTitle}>
              Đang khảo sát: {activeAssignment.zone.name}
              {activeAssignment.route ? ` • Tuyến ${activeAssignment.route.name}` : ''}
            </Text>
            <Text style={styles.assignmentBannerSub}>
              Nhà tạo mới sẽ tự gắn vào nhiệm vụ này để tính tiến độ.
            </Text>
            {/* Tọa độ nhà vẫn lấy theo GPS — tuyến chỉ để định hướng, đứng xa tuyến thì nhắc nhẹ. */}
            {(() => {
              const path = activeAssignment.route?.path;
              if (!path || path.length < 2 || locationSource === 'default') return null;
              const d = distanceToPathM(lat, lng, path);
              if (d <= ROUTE_WARN_DISTANCE_M) return null;
              return (
                <Text style={styles.assignmentBannerWarn}>
                  Bạn đang cách tuyến khoảng {d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`} —
                  kiểm tra lại vị trí nhà.
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity onPress={handleClearActiveAssignment}>
            <Text style={styles.assignmentBannerClear}>Bỏ chọn</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Tọa Độ Vị Trí GPS</Text>
        {/* Xếp dọc (tọa độ 1 dòng riêng, 2 nút chia đôi hàng dưới) — để chung 1 hàng thì màn hình
            hẹp bị tràn/ép nút. */}
        <View style={[styles.gpsValueBox, locationSource === 'default' && styles.gpsValueBoxWarn]}>
          <Text style={styles.gpsText} numberOfLines={1} adjustsFontSizeToFit>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
        </View>
        <Text
          style={[
            styles.gpsStatus,
            locationSource === 'default' && styles.gpsStatusWarn,
            locationSource === 'gps' && styles.gpsStatusGps,
            locationSource === 'map' && styles.gpsStatusMap,
          ]}
        >
          {gettingGps
            ? 'Đang lấy vị trí GPS…'
            : locationSource === 'gps'
              ? 'Vị trí từ GPS'
              : locationSource === 'map'
                ? 'Vị trí chọn trên bản đồ'
                : 'Chưa lấy vị trí — đang dùng tọa độ mặc định'}
        </Text>
        <View style={styles.gpsActions}>
          <TouchableOpacity style={styles.gpsButton} onPress={() => handleGetGps()} disabled={gettingGps}>
            {gettingGps ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <Text style={styles.gpsButtonText} numberOfLines={1}>
                Cập nhật GPS
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.gpsButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.gpsButtonText} numberOfLines={1}>
              Chọn trên map
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nhà/chủ hộ quanh vị trí GPS — tránh khảo sát trùng, chạm để tự điền (không hiện khi sửa lại nhà có sẵn). */}
      {!resurveyHouseId && (
        <NearbyOwnersCard
          lat={lat}
          lng={lng}
          hasLocation={locationSource !== 'default'}
          gettingGps={gettingGps}
          onGetGps={() => handleGetGps()}
          onPick={handlePickNearby}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Thông Tin Chủ Hộ</Text>
        {!!ownerFill && (
          <View style={styles.ownerFillBanner}>
            <Text style={styles.ownerFillText}>
              Đã điền từ chủ hộ {ownerFill.name} — kiểm tra lại, nhập số nhà và vị trí nhà mới.
            </Text>
            <TouchableOpacity onPress={handleUndoOwnerFill}>
              <Text style={styles.ownerFillUndo}>Bỏ điền</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Gõ tên hoặc SĐT → gợi ý chủ hộ đã có; chạm 1 dòng để tự điền (tạo hồ sơ nhà MỚI, không sửa nhà cũ). */}
        <OwnerAutocompleteField
          label="Họ tên chủ hộ *"
          value={ownerName}
          onChangeText={setOwnerName}
          onPick={handlePickOwner}
          enabled={!resurveyHouseId}
        />
        <OwnerAutocompleteField
          label="Số điện thoại"
          value={ownerPhone}
          onChangeText={setOwnerPhone}
          onPick={handlePickOwner}
          enabled={!resurveyHouseId}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Nhu cầu gắn/lắp biển số nhà</Text>
        <View style={styles.chipRow}>
          {PLATE_NEEDS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPlateNeed(plateNeed === p ? '' : p)}
              style={[styles.chip, plateNeed === p && styles.chipActive]}
            >
              <Text style={[styles.chipText, plateNeed === p && styles.chipTextActive]}>
                {PLATE_NEED_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field
          label="Số định danh cá nhân (CCCD)"
          value={ownerIdNumber}
          onChangeText={setOwnerIdNumber}
          keyboardType="numeric"
        />
        <View style={styles.row2}>
          <Field label="Số thửa đất" value={soThua} onChangeText={setSoThua} style={styles.half} />
          <Field label="Số tờ bản đồ" value={soTo} onChangeText={setSoTo} style={styles.half} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Địa Chỉ & Tuyến Đường</Text>
        <Field label="Số nhà đề xuất *" value={houseNumber} onChangeText={setHouseNumber} />
        <AddressPickerField
          label="Đường/Phố"
          required
          textValue={street}
          idValue={streetId}
          options={streets
            .filter((s) => !wardId || s.wardId === wardId)
            .map((s) => ({
              id: s.id,
              name: s.name,
              detail: wards.find((wardOption) => wardOption.id === s.wardId)?.name ?? 'Chưa gán Phường/Xã',
            }))}
          onSelect={(opt) => {
            setStreetId(opt?.id ?? '');
            if (opt) setStreet(opt.name);
          }}
          onManualText={(text) => {
            setStreetId('');
            setStreet(text);
          }}
        />
        {hamletLock ? (
          <>
            <Text style={styles.label}>Phường/Xã · Ấp/Thôn</Text>
            <Text style={[styles.input, { color: '#334155' }]}>
              {hamletLock.wardName} · {hamletLock.hamletName}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Địa bàn lấy theo tài khoản của bạn.
            </Text>
          </>
        ) : (
          <>
        <AddressPickerField
          label="Phường/Xã"
          required
          textValue={ward}
          idValue={wardId}
          options={wards.map((w) => ({ id: w.id, name: w.name }))}
          onSelect={(opt) => {
            setWardId(opt?.id ?? '');
            if (opt) setWard(opt.name);
            // Đổi xã thì ấp cũ (thuộc xã trước) không còn hợp lệ — bỏ chọn để tránh lưu sai.
            setHamletId('');
            setHamletName('');
          }}
          onManualText={(text) => {
            setWardId('');
            setWard(text);
            setHamletId('');
            setHamletName('');
          }}
        />
        {/* TN-07 — Ấp/Thôn (góp ý khách hàng 11/09/2026, thay cho ô Quận/Huyện/TP đã bỏ vì Tây
            Ninh là tỉnh một cấp — xem schema.prisma model District). Chỉ chọn từ danh mục của xã
            đã chọn ở trên (allowManual=false vì House không có cột chữ tự do song song). */}
        <AddressPickerField
          label="Ấp/Thôn"
          textValue={hamletName}
          idValue={hamletId}
          options={hamlets.map((h) => ({ id: h.id, name: h.name }))}
          allowManual={false}
          onSelect={(opt) => {
            setHamletId(opt?.id ?? '');
            setHamletName(opt?.name ?? '');
          }}
          onManualText={() => {}}
        />
          </>
        )}

        <Text style={styles.label}>Phía đường *</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            onPress={() => setSide(NumberingSide.EVEN)}
            style={[styles.chip, side === NumberingSide.EVEN && styles.chipActive]}
          >
            <Text style={[styles.chipText, side === NumberingSide.EVEN && styles.chipTextActive]}>
              Bên phải ({NUMBERING_SIDE_LABELS[NumberingSide.EVEN]})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSide(NumberingSide.ODD)}
            style={[styles.chip, side === NumberingSide.ODD && styles.chipActive]}
          >
            <Text style={[styles.chipText, side === NumberingSide.ODD && styles.chipTextActive]}>
              Bên trái ({NUMBERING_SIDE_LABELS[NumberingSide.ODD]})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Công Trình & Hiện Trạng</Text>
        <AddressPickerField
          label="Loại công trình"
          required
          textValue={BUILDING_TYPE_LABELS[buildingType]}
          idValue={buildingType}
          options={BUILDING_TYPES.map((type) => ({
            id: type,
            name: BUILDING_TYPE_LABELS[type],
          }))}
          allowManual={false}
          onSelect={(option) => {
            if (!option) return;
            const type = BUILDING_TYPES.find((buildingTypeOption) => buildingTypeOption === option.id);
            if (!type) return;
            // Hiện trạng là mục con của loại công trình — đổi loại thì yêu cầu chọn lại hiện trạng.
            if (type !== buildingType) {
              setUsageStatusId('');
              setUsageStatusName('');
            }
            setBuildingType(type);
          }}
          onManualText={() => {}}
        />

        <View style={styles.subGroup}>
          <AddressPickerField
            label="Hiện trạng số nhà hiện tại"
            textValue={usageStatusName}
            idValue={usageStatusId}
            allowManual={false}
            options={usageStatusOptions}
            onSelect={(opt) => {
              setUsageStatusId(opt?.id ?? '');
              setUsageStatusName(opt?.name ?? '');
            }}
            onManualText={() => {}}
          />
        </View>

        <View style={styles.row2}>
          <Field
            label="Số tầng"
            value={floors}
            onChangeText={setFloors}
            keyboardType="numeric"
            style={styles.half}
          />
          <Field
            label="Diện tích (m²)"
            value={area}
            onChangeText={setArea}
            keyboardType="numeric"
            style={styles.half}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>5. Hình Ảnh Số Nhà</Text>

        <Text style={styles.label}>
          Ảnh mặt tiền nhà ({facadePhotoUris.length}/{MAX_REQUIRED_PHOTOS})
        </Text>
        <PhotoGroup
          uris={facadePhotoUris}
          max={MAX_REQUIRED_PHOTOS}
          onPick={() =>
            pickPhotos('Ảnh mặt tiền nhà', MAX_REQUIRED_PHOTOS - facadePhotoUris.length, (uris) =>
              setFacadePhotoUris((prev) => [...prev, ...uris].slice(0, MAX_REQUIRED_PHOTOS)),
            )
          }
          onView={(index) => setViewer({ uris: facadePhotoUris, index })}
          onRemove={(index) => setFacadePhotoUris((prev) => prev.filter((_, i) => i !== index))}
        />

        <Text style={styles.label}>
          Ảnh biển số nhà ({platePhotoUris.length}/{MAX_REQUIRED_PHOTOS})
        </Text>
        <PhotoGroup
          uris={platePhotoUris}
          max={MAX_REQUIRED_PHOTOS}
          onPick={() =>
            pickPhotos('Ảnh biển số nhà', MAX_REQUIRED_PHOTOS - platePhotoUris.length, (uris) =>
              setPlatePhotoUris((prev) => [...prev, ...uris].slice(0, MAX_REQUIRED_PHOTOS)),
            )
          }
          onView={(index) => setViewer({ uris: platePhotoUris, index })}
          onRemove={(index) => setPlatePhotoUris((prev) => prev.filter((_, i) => i !== index))}
        />

        <Text style={styles.label}>
          Ảnh khác / hiện trạng ({photoUris.length}/{MAX_PHOTOS})
        </Text>
        <View style={styles.photoGrid}>
          {photoUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setViewer({ uris: photoUris, index })}>
                <Image source={{ uri }} style={styles.photoThumb} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(index)}>
                <Text style={styles.photoRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photoUris.length < MAX_PHOTOS && (
            <TouchableOpacity style={styles.photoAddTile} onPress={handlePickPhoto}>
              <Text style={styles.photoAddText}>+ Thêm ảnh</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>6. Ghi Chú</Text>
        <Field
          label="Ghi chú khảo sát"
          value={note}
          onChangeText={setNote}
          multiline
          onFocus={() => {
            noteFocused.current = true;
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
          onBlur={() => {
            noteFocused.current = false;
          }}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionSubmit]}
          onPress={() => handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionSubmitText}>
              {resurveyHouseId ? 'Lưu khảo sát lại' : 'Lưu'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <LocationPickerModal
        visible={pickerVisible}
        initialLat={lat}
        initialLng={lng}
        // Nhiệm vụ đang chọn có tuyến → bản đồ mở tại tuyến; "Bỏ chọn" nhiệm vụ thì trở lại như cũ.
        route={
          activeAssignment && !resurveyHouseId && activeAssignment.route?.path && activeAssignment.route.path.length >= 2
            ? {
                name: activeAssignment.route.name,
                path: activeAssignment.route.path,
                snapped: activeAssignment.route.snapped,
              }
            : null
        }
        // Khảo sát lại: đánh dấu 🏠 + nút bay về đúng vị trí nhà đang chọn.
        houseLocation={
          resurveyHouse ? { latitude: resurveyHouse.latitude, longitude: resurveyHouse.longitude } : null
        }
        hasRealLocation={locationSource !== 'default'}
        onClose={() => setPickerVisible(false)}
        onConfirm={(newLat, newLng) => {
          setLat(newLat);
          setLng(newLng);
          setLocationSource('map');
          setPickerVisible(false);
        }}
      />

      {viewer && (
        <ImageViewer
          visible
          uris={viewer.uris}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  style,
  ...inputProps
}: {
  label: string;
  style?: object;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...inputProps} />
    </View>
  );
}

/** Nhóm ảnh mặt tiền/biển số — tối đa 2 ảnh, có thể xem, thêm hoặc xóa từng ảnh. */
function PhotoGroup({
  uris,
  max,
  onPick,
  onView,
  onRemove,
}: {
  uris: string[];
  max: number;
  onPick: () => void;
  onView: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View style={styles.photoGrid}>
      {uris.map((uri, index) => (
        <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => onView(index)}>
            <Image source={{ uri }} style={styles.photoThumb} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => onRemove(index)}>
            <Text style={styles.photoRemoveText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {uris.length < max && (
        <TouchableOpacity style={styles.photoAddTile} onPress={onPick}>
          <Text style={styles.photoAddText}>
            {uris.length ? '+ Thêm ảnh' : 'Bấm để Chụp ảnh hoặc Chọn từ máy'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Phase 6 — chọn địa chỉ từ danh mục chuẩn hoá qua modal tìm-kiếm-và-chọn
 * (RN không có <select> gốc), với lối thoát "dùng làm tên khác" cho địa chỉ
 * chưa có trong danh mục — không chặn khảo sát khi ở nơi chưa kịp thêm danh
 * mục hoặc khi offline (mảng `options` rỗng thì modal chỉ còn chế độ nhập tay).
 */
function AddressPickerField({
  label,
  required,
  textValue,
  idValue,
  options,
  onSelect,
  onManualText,
  allowManual = true,
}: {
  label: string;
  required?: boolean;
  textValue: string;
  idValue: string;
  options: { id: string; name: string; detail?: string }[];
  onSelect: (option: { id: string; name: string; detail?: string } | null) => void;
  onManualText: (text: string) => void;
  /**
   * TN-07 — tắt lối "dùng làm tên khác" khi field không có cột chữ tự do
   * song song trên House để lưu (vd Ấp/Thôn — chỉ có `hamletId`, khác với
   * Đường/Phường có cả `street`/`ward` dạng chữ). Mặc định bật (giữ hành vi
   * cũ cho Đường/Phường).
   */
  allowManual?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLocaleLowerCase('vi');
  const normalizedQuery = normalize(query.trim());
  const filtered = options.filter((option) =>
    normalize(`${option.name} ${option.detail ?? ''}`).includes(normalizedQuery),
  );

  return (
    <View>
      <Text style={styles.label}>
        {label} {required ? '*' : ''}
      </Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => {
          setQuery('');
          setVisible(true);
        }}
      >
        <Text style={textValue ? styles.pickerValue : styles.pickerPlaceholder}>
          {textValue || (allowManual ? 'Chạm để chọn hoặc nhập...' : 'Chạm để chọn...')}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.sectionTitle}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={allowManual ? 'Tìm trong danh mục hoặc nhập tên mới...' : 'Tìm trong danh mục...'}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            style={styles.modalList}
            data={filtered}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              !required ? (
                <TouchableOpacity
                  style={[styles.modalOption, !idValue && !textValue && styles.modalOptionActive]}
                  onPress={() => {
                    onSelect(null);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>-- Không chọn (bỏ trống) --</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalOption, item.id === idValue && styles.modalOptionActive]}
                onPress={() => {
                  onSelect(item);
                  setVisible(false);
                }}
              >
                <View>
                  <Text style={styles.modalOptionText}>{item.name}</Text>
                  {!!item.detail && <Text style={styles.modalOptionDetail}>{item.detail}</Text>}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.modalEmptyText}>
                {options.length === 0
                  ? allowManual
                    ? 'Chưa tải được danh mục (có thể do mất mạng) — nhập tên bên dưới.'
                    : 'Chưa tải được danh mục (có thể do mất mạng, hoặc xã chưa có dữ liệu này).'
                  : 'Không khớp mục nào trong danh mục.'}
              </Text>
            }
          />
          {allowManual && query.length > 0 && (
            <TouchableOpacity
              style={styles.modalManualBtn}
              onPress={() => {
                onManualText(query);
                setVisible(false);
              }}
            >
              <Text style={styles.modalManualBtnText}>
                + Dùng &quot;{query}&quot; (chưa có trong danh mục)
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVisible(false)}>
            <Text style={styles.modalCloseBtnText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase' },
  gpsValueBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    marginTop: 4,
  },
  gpsText: { fontFamily: 'monospace', fontSize: 15, color: '#0f172a', textAlign: 'center' },
  gpsValueBoxWarn: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  gpsStatus: { fontSize: 11, fontWeight: '600', color: '#64748b', textAlign: 'center' },
  gpsStatusWarn: { color: '#b45309' },
  gpsStatusGps: { color: '#047857' },
  gpsStatusMap: { color: '#1d4ed8' },
  gpsActions: { flexDirection: 'row', gap: 8 },
  gpsButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  gpsButtonText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  resurveyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  resurveyBannerTitle: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
  resurveyBannerSub: { fontSize: 11, color: '#b91c1c', marginTop: 2 },
  resurveyBannerClear: { fontSize: 12, fontWeight: '700', color: '#991b1b' },
  assignmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  assignmentBannerTitle: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  assignmentBannerSub: { fontSize: 10, color: '#60a5fa', marginTop: 2 },
  assignmentBannerWarn: { fontSize: 11, color: '#b45309', fontWeight: '600', marginTop: 4 },
  assignmentBannerClear: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  label: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 4,
    backgroundColor: '#f8fafc',
  },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  /** Khối con thụt lề (vd Hiện trạng dưới Loại công trình) — viền trái thể hiện quan hệ cha–con. */
  ownerFillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  ownerFillText: { flex: 1, fontSize: 11, color: '#047857', fontWeight: '600' },
  ownerFillUndo: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  subGroup: { marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#bfdbfe' },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoThumbWrap: { width: 84, height: 84, marginTop: 4 },
  photoThumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#e2e8f0' },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoRemoveText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 14 },
  photoAddTile: {
    width: 160,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 4,
    marginTop: 4,
  },
  photoAddText: { color: '#94a3b8', fontSize: 11, textAlign: 'center', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  actionSubmit: { backgroundColor: '#1d4ed8' },
  actionSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pickerValue: { fontSize: 14, color: '#0f172a' },
  pickerPlaceholder: { fontSize: 14, color: '#94a3b8' },
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 16, paddingTop: 48, gap: 10 },
  modalList: { flexGrow: 0 },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionActive: { backgroundColor: '#eff6ff' },
  modalOptionText: { fontSize: 14, color: '#0f172a' },
  modalOptionDetail: { fontSize: 12, color: '#64748b', marginTop: 3 },
  modalEmptyText: { fontSize: 13, color: '#94a3b8', paddingVertical: 12, textAlign: 'center' },
  modalManualBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalManualBtnText: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  modalCloseBtnText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
});
