import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { RouteProp, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  BUILDING_TYPE_LABELS,
  DEFAULT_PROVINCE_NAME,
  formatFullAddress,
  HOUSE_STATUS_LABELS,
  HouseStatus,
  HouseSummary,
  PHOTO_TYPE_LABELS,
  type Hamlet,
  type Street,
  type Ward,
} from '@tayninh/shared';
import { API_URL, apiFetch, ApiError } from '../lib/api';
import { fetchAppConfig } from '../lib/appConfig';
import { fetchHamlets, fetchStreets, fetchWards } from '../lib/addressCatalog';
import type { MainTabsParamList } from '../navigation/MainTabs';

/** Trung tâm mặc định: TP. Tây Ninh — dùng khi chưa lấy được GPS thật. */
const TAYNINH_REGION: Region = {
  latitude: 11.3151,
  longitude: 106.098,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/** Bán kính mặc định khi bấm vào chỗ trống trên bản đồ để tra cứu số nhà xung quanh (mét). */
const NEARBY_RADIUS_METERS = 500;

const STATUS_COLOR: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: '#10b981',
  [HouseStatus.PENDING]: '#f59e0b',
  [HouseStatus.NEEDS_ADJUST]: '#f43f5e',
};

const STATUS_FILTERS: { value: HouseStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: HouseStatus.APPROVED, label: 'Đã cấp biển' },
  { value: HouseStatus.PENDING, label: 'Chờ duyệt' },
  { value: HouseStatus.NEEDS_ADJUST, label: 'Cần hiệu chỉnh' },
];

interface HouseGeoPoint {
  id: string;
  latitude: number;
  longitude: number;
  houseNumber: string;
  street: string;
  ownerName: string;
  status: HouseStatus;
  qrCode: string;
}

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
      buildingType: string;
      status: HouseStatus;
      qrCode: string;
    };
  }[];
}

type NearbyHouse = HouseSummary & { distance: number };

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Quyền truy cập vị trí',
      message: 'Ứng dụng cần vị trí GPS để định vị bạn trên bản đồ.',
      buttonPositive: 'Đồng ý',
      buttonNegative: 'Từ chối',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const route = useRoute<RouteProp<MainTabsParamList, 'Map'>>();
  const consumedFocusRef = useRef<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HouseStatus | ''>('');
  const [houses, setHouses] = useState<HouseGeoPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  // TN-22 — lọc theo ấp/đường (góp ý khách hàng 11/09/2026, mục Bản đồ: "tạo thanh tìm
  // kiếm đa dạng, dễ tìm kiếm, dễ sử dụng"). Ấp lọc theo xã đã chọn (giống SurveyScreen).
  const [filterWardId, setFilterWardId] = useState('');
  const [filterHamletId, setFilterHamletId] = useState('');
  const [filterStreetId, setFilterStreetId] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [wards, setWards] = useState<Ward[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);

  useEffect(() => {
    fetchWards().then(setWards).catch(() => {});
    fetchStreets().then(setStreets).catch(() => {});
  }, []);

  useEffect(() => {
    if (!filterWardId) {
      setHamlets([]);
      return;
    }
    fetchHamlets(filterWardId).then(setHamlets).catch(() => {});
  }, [filterWardId]);

  const activeFilterCount = [filterWardId, filterHamletId, filterStreetId].filter(Boolean).length;

  const [nearby, setNearby] = useState<NearbyHouse[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HouseSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // TN-21 — tên tỉnh cho địa chỉ đầy đủ 5 cấp ở bottom sheet chi tiết hồ sơ.
  const [provinceName, setProvinceName] = useState(DEFAULT_PROVINCE_NAME);

  useEffect(() => {
    fetchAppConfig()
      .then((cfg) => setProvinceName(cfg.provinceName))
      .catch(() => {});
  }, []);

  const [trackMarkers, setTrackMarkers] = useState(true);
  useEffect(() => {
    setTrackMarkers(true);
    const t = setTimeout(() => setTrackMarkers(false), 500);
    return () => clearTimeout(t);
  }, [houses]);

  const fetchHouses = useCallback(
    async (
      searchVal: string,
      statusVal: HouseStatus | '',
      wardIdVal: string,
      hamletIdVal: string,
      streetIdVal: string,
    ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchVal) params.set('search', searchVal);
      if (statusVal) params.set('status', statusVal);
      if (wardIdVal) params.set('wardId', wardIdVal);
      if (hamletIdVal) params.set('hamletId', hamletIdVal);
      if (streetIdVal) params.set('streetId', streetIdVal);
      const url = `/api/houses/geojson?${params.toString()}`;
      console.log('[MapScreen] fetchHouses ->', url); // eslint-disable-line no-console
      const res = await apiFetch<HouseGeoJson>(url, {
        signal: controller.signal,
      });
      console.log( // eslint-disable-line no-console
        '[MapScreen] fetchHouses <- features:',
        res.features.length,
        'truncated:',
        res.truncated,
      );
      setHouses(
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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[MapScreen] fetchHouses lỗi:', err); // eslint-disable-line no-console
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Không tải được lớp bản đồ');
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
    },
    [],
  );

  // Debounce 400ms khi gõ tìm kiếm — tránh gọi API mỗi phím và tránh race
  // condition (AbortController ở fetchHouses lo phần hủy request cũ).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchHouses(search, status, filterWardId, filterHamletId, filterStreetId);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, status, filterWardId, filterHamletId, filterStreetId, fetchHouses]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setNearby(null);
    setDetailLoading(true);
    try {
      const res = await apiFetch<HouseSummary>(`/api/houses/${id}`);
      setDetail(res);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Không tải được chi tiết hồ sơ');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  async function handleMapPress(lat: number, lng: number) {
    setNearbyLoading(true);
    try {
      const res = await apiFetch<NearbyHouse[]>(
        `/api/houses/nearby?lat=${lat}&lng=${lng}&radius=${NEARBY_RADIUS_METERS}`,
      );
      setNearby(res);
    } catch (err) {
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Tra cứu theo tọa độ thất bại');
    } finally {
      setNearbyLoading(false);
    }
  }

  async function handleLocateMe() {
    setLocating(true);
    const ok = await requestLocationPermission();
    if (!ok) {
      Alert.alert('Thiếu quyền', 'Cần cấp quyền vị trí để định vị trên bản đồ.');
      setLocating(false);
      return;
    }
    Geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.animateToRegion(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800,
        );
        setLocating(false);
      },
      (error) => {
        Alert.alert('Lỗi GPS', error.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  }

  /**
   * Mở Google Maps chỉ đường từ vị trí hiện tại (không truyền origin — Google
   * Maps tự dùng vị trí GPS hiện tại của thiết bị) tới tọa độ số nhà đã chọn.
   * URL này hoạt động trên cả Android/iOS: mở app Google Maps nếu đã cài,
   * ngược lại mở trình duyệt — không cần cấu hình native thêm.
   */
  async function openDirections(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Lỗi', 'Không mở được Google Maps để chỉ đường.');
    }
  }

  function flyTo(lat: number, lng: number) {
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      800,
    );
  }

  // Được điều hướng từ Dashboard (bấm 1 dòng trong modal xem nhanh) — bay tới
  // toạ độ đó và mở chi tiết, chỉ 1 lần cho mỗi lần điều hướng (không lặp lại
  // khi màn hình re-render hoặc lấy lại focus mà params không đổi).
  useEffect(() => {
    const params = route.params;
    if (!params) return;
    const key = `${params.focusId}:${params.lat}:${params.lng}`;
    if (consumedFocusRef.current === key) return;
    consumedFocusRef.current = key;
    flyTo(params.lat, params.lng);
    openDetail(params.focusId);
  }, [route.params]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={TAYNINH_REGION}
        onPress={(e) => {
          setNearby(null);
          const { latitude, longitude } = e.nativeEvent.coordinate;
          handleMapPress(latitude, longitude);
        }}
      >
        {houses.map((h) => (
          <Marker
            // key gồm status/houseNumber để marker tự tạo lại (vẽ lại đúng màu/nhãn)
            // khi hồ sơ được cập nhật — tracksViewChanges=false bên dưới chỉ tối ưu
            // hiệu năng cho marker KHÔNG đổi, không dùng để re-render marker đã đổi.
            key={`${h.id}-${h.status}-${h.houseNumber}`}
            coordinate={{ latitude: h.latitude, longitude: h.longitude }}
            onPress={() => openDetail(h.id)}
            tracksViewChanges={trackMarkers}
          >
            {/* collapsable={false}: bắt buộc trên Android — nếu không, view-flattening
                (càng gắt hơn ở kiến trúc mới/Fabric) sẽ dẹp View này trước khi
                react-native-maps kịp chụp snapshot, khiến marker vô hình dù toạ độ đúng. */}
            <View
              collapsable={false}
              style={[styles.markerBadge, { backgroundColor: STATUS_COLOR[h.status] }]}
            >
              <Text style={styles.markerText} numberOfLines={1}>
                {h.houseNumber}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Thanh tìm kiếm & lọc — TN-22 (góp ý khách hàng 11/09/2026: "thanh tìm kiếm đa dạng, dễ
          tìm kiếm, dễ sử dụng") thêm nút Bộ lọc mở modal chọn Xã/Ấp/Đường, bên cạnh ô tìm chữ
          đã có (số nhà/chủ hộ/mã QR, debounce 400ms). */}
      <View style={styles.searchBar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Số nhà, chủ sở hữu, mã QR..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
        {loading && <ActivityIndicator size="small" color="#2563eb" style={styles.searchSpinner} />}
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
          <Icon name="filter-variant" size={18} color={activeFilterCount > 0 ? '#2563eb' : '#64748b'} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={styles.chipRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setStatus(f.value)}
            style={[styles.chip, status === f.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TN-22 — modal chọn Xã/Ấp/Đường để lọc bản đồ. */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterModalBackdrop}>
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Bộ lọc bản đồ</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Icon name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalScroll}>
              <Text style={styles.filterSectionLabel}>Xã/Phường</Text>
              <View style={styles.filterOptionWrap}>
                <TouchableOpacity
                  style={[styles.filterOption, !filterWardId && styles.filterOptionActive]}
                  onPress={() => {
                    setFilterWardId('');
                    setFilterHamletId('');
                  }}
                >
                  <Text style={[styles.filterOptionText, !filterWardId && styles.filterOptionTextActive]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {wards.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.filterOption, filterWardId === w.id && styles.filterOptionActive]}
                    onPress={() => {
                      setFilterWardId(w.id);
                      setFilterHamletId('');
                    }}
                  >
                    <Text
                      style={[styles.filterOptionText, filterWardId === w.id && styles.filterOptionTextActive]}
                    >
                      {w.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionLabel}>
                Ấp/Thôn {!filterWardId && '(chọn Xã/Phường trước)'}
              </Text>
              <View style={styles.filterOptionWrap}>
                <TouchableOpacity
                  style={[styles.filterOption, !filterHamletId && styles.filterOptionActive]}
                  onPress={() => setFilterHamletId('')}
                >
                  <Text style={[styles.filterOptionText, !filterHamletId && styles.filterOptionTextActive]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {hamlets.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={[styles.filterOption, filterHamletId === h.id && styles.filterOptionActive]}
                    onPress={() => setFilterHamletId(h.id)}
                  >
                    <Text
                      style={[styles.filterOptionText, filterHamletId === h.id && styles.filterOptionTextActive]}
                    >
                      {h.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterSectionLabel}>Đường/Phố</Text>
              <View style={styles.filterOptionWrap}>
                <TouchableOpacity
                  style={[styles.filterOption, !filterStreetId && styles.filterOptionActive]}
                  onPress={() => setFilterStreetId('')}
                >
                  <Text style={[styles.filterOptionText, !filterStreetId && styles.filterOptionTextActive]}>
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {streets
                  .filter((s) => !filterWardId || s.wardId === filterWardId)
                  .map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.filterOption, filterStreetId === s.id && styles.filterOptionActive]}
                      onPress={() => setFilterStreetId(s.id)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filterStreetId === s.id && styles.filterOptionTextActive,
                        ]}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>

            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={styles.filterClearBtn}
                onPress={() => {
                  setFilterWardId('');
                  setFilterHamletId('');
                  setFilterStreetId('');
                }}
              >
                <Text style={styles.filterClearBtnText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterApplyBtnText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Nút định vị vị trí hiện tại */}
      <TouchableOpacity style={styles.locateButton} onPress={handleLocateMe} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Text style={styles.locateButtonText}>📍</Text>
        )}
      </TouchableOpacity>

      {/* Kết quả tra cứu theo tọa độ (bấm chỗ trống trên bản đồ) */}
      {(nearby !== null || nearbyLoading) && (
        <View style={styles.nearbyPanel}>
          <View style={styles.nearbyHeader}>
            <Text style={styles.nearbyTitle}>
              {nearbyLoading
                ? 'Đang tra cứu…'
                : `Trong bán kính ${NEARBY_RADIUS_METERS}m: ${nearby?.length ?? 0} hồ sơ`}
            </Text>
            <TouchableOpacity onPress={() => setNearby(null)}>
              <Text style={styles.nearbyClose}>Đóng</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={nearby ?? []}
            keyExtractor={(item) => item.id}
            style={styles.nearbyList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.nearbyItem}
                onPress={() => {
                  flyTo(item.latitude, item.longitude);
                  openDetail(item.id);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.nearbyItemTitle}>
                    Số {item.houseNumber} {item.street}
                  </Text>
                  <Text style={styles.nearbyItemSub}>{item.ownerName}</Text>
                </View>
                <Text style={styles.nearbyItemDistance}>{item.distance}m</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !nearbyLoading ? (
                <Text style={styles.nearbyEmpty}>Không có hồ sơ nào gần đây</Text>
              ) : null
            }
          />
        </View>
      )}

      {/* Modal chi tiết hồ sơ */}
      <Modal visible={!!selectedId} animationType="slide" transparent onRequestClose={closeDetail}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {detailLoading && (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 24 }} />
            )}
            {detail && (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <View style={styles.modalTopRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${STATUS_COLOR[detail.status]}22` },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[detail.status] }]}>
                      {HOUSE_STATUS_LABELS[detail.status]}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeDetail}>
                    <Text style={styles.modalClose}>×</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalTitle}>
                  Số {detail.houseNumber} {detail.street}
                </Text>
                {/* TN-21 — địa chỉ đầy đủ 5 cấp (góp ý khách hàng 11/09/2026): số nhà, đường,
                    ấp, xã, tỉnh. Dùng chung công thức với web qua `formatFullAddress`. */}
                <Text style={styles.modalSub}>
                  {formatFullAddress(
                    { houseNumber: detail.houseNumber, street: detail.street, ward: detail.ward, hamletName: detail.hamlet?.name },
                    provinceName,
                  )}
                </Text>

                <TouchableOpacity
                  style={styles.directionsButton}
                  onPress={() => openDirections(detail.latitude, detail.longitude)}
                >
                  <Text style={styles.directionsButtonText}>🧭 Chỉ đường đến đây</Text>
                </TouchableOpacity>

                <View style={styles.modalQrRow}>
                  <Image
                    source={{ uri: `${API_URL}/api/houses/${detail.id}/qrcode.png` }}
                    style={styles.qrImage}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalQrCode}>{detail.qrCode}</Text>
                    <Text style={styles.modalGps}>
                      GPS: {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalInfoGrid}>
                  <InfoRow label="Chủ sở hữu" value={detail.ownerName} />
                  <InfoRow label="Điện thoại" value={detail.ownerPhone || '—'} />
                  <InfoRow label="Số CCCD/CMND" value={detail.ownerIdNumber || '—'} />
                  <InfoRow
                    label="Loại công trình"
                    value={BUILDING_TYPE_LABELS[detail.buildingType]}
                  />
                  <InfoRow
                    label="Số tầng / Diện tích"
                    value={`${detail.floors ?? '—'} tầng / ${detail.area ? `${detail.area} m²` : '—'}`}
                  />
                  {(detail.soTo || detail.soThua) && (
                    <InfoRow
                      label="Thửa / Tờ"
                      value={`${detail.soThua ?? '—'} / ${detail.soTo ?? '—'}`}
                    />
                  )}
                </View>

                {(detail.photos?.length ?? 0) > 0 && (
                  <>
                    <Text style={styles.photosLabel}>Ảnh hiện trạng</Text>
                    <FlatList
                      data={detail.photos}
                      keyExtractor={(p) => p.id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <View style={styles.photoItem}>
                          <Image
                            source={{ uri: `${API_URL}${item.url}` }}
                            style={styles.photoImage}
                          />
                          <Text style={styles.photoType}>{PHOTO_TYPE_LABELS[item.type]}</Text>
                        </View>
                      )}
                    />
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  markerBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 4,
    borderRadius: 15,
    backgroundColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  markerText: { color: '#fff', fontWeight: '700', fontSize: 10 },
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  searchSpinner: { marginLeft: 6 },
  filterBtn: { marginLeft: 6, padding: 4 },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  filterBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  filterModalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  filterModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '85%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterModalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  filterModalScroll: { maxHeight: 420 },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  filterOptionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  filterOptionActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterOptionText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterOptionTextActive: { color: '#fff' },
  filterModalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  filterClearBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  filterClearBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  filterApplyBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  filterApplyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipRow: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  locateButton: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  locateButtonText: { fontSize: 20 },
  nearbyPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    maxHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  nearbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#eff6ff',
  },
  nearbyTitle: { fontSize: 11, fontWeight: '700', color: '#1d4ed8', flex: 1 },
  nearbyClose: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  nearbyList: { maxHeight: 180 },
  nearbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  nearbyItemTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  nearbyItemSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  nearbyItemDistance: { fontSize: 11, fontFamily: 'monospace', color: '#2563eb', fontWeight: '700' },
  nearbyEmpty: { textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: 200,
    paddingTop: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalScrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  modalClose: { fontSize: 22, color: '#94a3b8', paddingHorizontal: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  modalSub: { fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 12 },
  directionsButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  directionsButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
  },
  qrImage: { width: 56, height: 56 },
  modalQrCode: { fontFamily: 'monospace', fontWeight: '700', fontSize: 13, color: '#1e293b' },
  modalGps: { fontFamily: 'monospace', fontSize: 10, color: '#64748b', marginTop: 2 },
  modalInfoGrid: { gap: 8, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: 11, color: '#94a3b8' },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#0f172a', flexShrink: 1, textAlign: 'right' },
  photosLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  photoItem: { marginRight: 10, alignItems: 'center' },
  photoImage: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#e2e8f0' },
  photoType: { fontSize: 10, color: '#64748b', marginTop: 3 },
});
