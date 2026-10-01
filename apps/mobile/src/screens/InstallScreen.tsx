import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera } from 'react-native-image-picker';
import type { InstallAssignment, InstallPlateItem } from '@tayninh/shared';
import { ASSIGNMENT_STATUS_LABELS, AssignmentStatus, PlateStatus } from '@tayninh/shared';
import { PHOTO_PICKER_OPTIONS } from '../lib/imageOptions';
import { ApiError } from '../lib/api';
import { installPlate, markPlateNotInstalled } from '../lib/platesApi';
import {
  fetchInstallPlates,
  fetchMyInstallAssignments,
  getInstallAssignment,
  startInstallAssignment,
  submitInstallAssignment,
} from '../lib/installsApi';

/** Đứng cách nhà xa hơn ngưỡng này (mét) khi bấm "Đã gắn" thì hỏi lại — GPS điện thoại sai số vài chục mét nên chỉ cảnh báo, không chặn. */
const FAR_WARN_DISTANCE_M = 100;

/** Lý do chuẩn hoá khi không gắn được biển (có thể nhập thêm ghi chú). */
const NOT_INSTALLED_REASONS = [
  'Vắng chủ nhà',
  'Chủ nhà từ chối',
  'Nhà đang xây dựng',
  'Khó tiếp cận',
  'Sai địa chỉ / không tìm thấy nhà',
];

const TAYNINH_REGION: Region = { latitude: 11.3151, longitude: 106.098, latitudeDelta: 0.08, longitudeDelta: 0.08 };

const STATUS_COLOR: Record<AssignmentStatus, { bg: string; text: string }> = {
  [AssignmentStatus.ASSIGNED]: { bg: '#f1f5f9', text: '#475569' },
  [AssignmentStatus.IN_PROGRESS]: { bg: '#dbeafe', text: '#1d4ed8' },
  [AssignmentStatus.SUBMITTED]: { bg: '#fef3c7', text: '#b45309' },
  [AssignmentStatus.COMPLETED]: { bg: '#d1fae5', text: '#047857' },
  [AssignmentStatus.NEEDS_REVISIT]: { bg: '#fee2e2', text: '#b91c1c' },
};

type PlateFilter = 'todo' | 'done' | 'failed' | 'all';

const FILTERS: { value: PlateFilter; label: string }[] = [
  { value: 'todo', label: 'Cần xử lý' },
  { value: 'done', label: 'Đã gắn' },
  { value: 'failed', label: 'Chưa gắn được' },
  { value: 'all', label: 'Tất cả' },
];

type LatLng = { latitude: number; longitude: number };

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Quyền truy cập máy ảnh',
    message: 'Ứng dụng cần máy ảnh để chụp ảnh hiện trường sau khi gắn biển số.',
    buttonPositive: 'Đồng ý',
    buttonNegative: 'Từ chối',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Quyền truy cập vị trí',
    message: 'Ứng dụng cần vị trí để sắp xếp biển theo khoảng cách và kiểm tra bạn đang đứng gần nhà.',
    buttonPositive: 'Đồng ý',
    buttonNegative: 'Từ chối',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/** Khoảng cách mặt cầu giữa 2 điểm (mét). */
function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

type PlateState = 'installed' | 'revisit' | 'failed' | 'pending';

function plateState(p: InstallPlateItem): PlateState {
  if (p.status === PlateStatus.INSTALLED) return 'installed';
  if (p.revisitReason) return 'revisit';
  if (p.notInstalledAt) return 'failed';
  return 'pending';
}

const STATE_COLOR: Record<PlateState, string> = {
  installed: '#10b981',
  revisit: '#8b5cf6',
  failed: '#ef4444',
  pending: '#f59e0b',
};

const STATE_LABEL: Record<PlateState, string> = {
  installed: 'Đã gắn',
  revisit: 'Cần thi công lại',
  failed: 'Chưa gắn được',
  pending: 'Chờ gắn',
};

function matchesFilter(p: InstallPlateItem, f: PlateFilter): boolean {
  const s = plateState(p);
  if (f === 'all') return true;
  if (f === 'todo') return s === 'pending' || s === 'revisit';
  if (f === 'done') return s === 'installed';
  return s === 'failed';
}

function progressOf(a: InstallAssignment) {
  const st = a.stats;
  const total = st?.total ?? 0;
  const done = st ? st.installed + st.notInstalled : 0;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/**
 * Thi công gắn biển (mobile — cán bộ thi công). Danh sách nhiệm vụ của tôi → chọn 1 nhiệm vụ để xem
 * biển (danh sách hoặc bản đồ) → bắt đầu → đi gắn từng biển (chụp ảnh, kiểm tra đứng gần nhà) hoặc ghi
 * nhận chưa gắn được kèm lý do → gửi duyệt. Nghiệm thu/yêu cầu thi công lại do web thực hiện.
 */
export default function InstallScreen() {
  const [assignments, setAssignments] = useState<InstallAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      setAssignments(await fetchMyInstallAssignments());
    } catch {
      Alert.alert('Lỗi', 'Không tải được nhiệm vụ thi công (kiểm tra kết nối mạng).');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList]),
  );

  // Nút Back của Android: đang xem chi tiết thì quay về danh sách thay vì thoát tab.
  useEffect(() => {
    if (!selectedId) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      loadList();
      return true;
    });
    return () => sub.remove();
  }, [selectedId, loadList]);

  if (selectedId) {
    return (
      <InstallDetail
        assignmentId={selectedId}
        onBack={() => {
          setSelectedId(null);
          loadList();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{assignments.length} nhiệm vụ thi công được giao</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadList();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Chưa được giao nhiệm vụ thi công nào.</Text>}
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status];
            const { total, done, pct } = progressOf(item);
            const overdue =
              !!item.dueDate &&
              new Date(item.dueDate).getTime() < Date.now() &&
              item.status !== AssignmentStatus.COMPLETED;
            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelectedId(item.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.route?.name ?? item.zone.name}
                  </Text>
                  <Text style={[styles.badge, { backgroundColor: color.bg, color: color.text }]}>
                    {ASSIGNMENT_STATUS_LABELS[item.status]}
                  </Text>
                </View>
                <Text style={styles.cardSub}>
                  {item.zone.name}
                  {item.zone.ward?.name ? ` • ${item.zone.ward.name}` : ''}
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.cardMeta}>
                  {done}/{total} biển đã xử lý • {pct}%
                  {item.dueDate ? ` • Hạn ${new Date(item.dueDate).toLocaleDateString('vi-VN')}` : ''}
                  {overdue ? ' • QUÁ HẠN' : ''}
                </Text>
                {item.status === AssignmentStatus.NEEDS_REVISIT && !!item.reviewNote && (
                  <Text style={styles.revisitNote}>Lý do thi công lại: {item.reviewNote}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function InstallDetail({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const mapRef = useRef<MapView>(null);
  const [assignment, setAssignment] = useState<InstallAssignment | null>(null);
  const [plates, setPlates] = useState<InstallPlateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<PlateFilter>('todo');
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [selectedPlateId, setSelectedPlateId] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [reasonTarget, setReasonTarget] = useState<InstallPlateItem | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([getInstallAssignment(assignmentId), fetchInstallPlates(assignmentId)]);
      setAssignment(a);
      setPlates(p);
    } catch {
      Alert.alert('Lỗi', 'Không tải được nhiệm vụ (kiểm tra kết nối mạng).');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  // Theo dõi vị trí để sắp biển theo khoảng cách và kiểm tra đứng gần nhà khi xác nhận gắn.
  useEffect(() => {
    let active = true;
    requestLocationPermission().then((ok) => {
      if (!ok || !active) return;
      watchIdRef.current = Geolocation.watchPosition(
        (pos) => setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, distanceFilter: 10, interval: 5000 },
      );
    });
    return () => {
      active = false;
      if (watchIdRef.current != null) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const routeCoords = useMemo<LatLng[]>(
    () => (assignment?.route?.path ?? []).map(([latitude, longitude]) => ({ latitude, longitude })),
    [assignment],
  );

  const distanceTo = useCallback(
    (p: InstallPlateItem): number | null =>
      myLocation ? haversineM(myLocation, { latitude: p.house.latitude, longitude: p.house.longitude }) : null,
    [myLocation],
  );

  const visiblePlates = useMemo(() => {
    const list = plates.filter((p) => matchesFilter(p, filter));
    // Gần tôi nhất lên trước (khi đã có vị trí).
    return myLocation ? [...list].sort((a, b) => (distanceTo(a) ?? 0) - (distanceTo(b) ?? 0)) : list;
  }, [plates, filter, myLocation, distanceTo]);

  const counts = useMemo(() => {
    const c = { installed: 0, failed: 0, pending: 0, revisit: 0 };
    for (const p of plates) c[plateState(p)] += 1;
    return c;
  }, [plates]);

  const selectedPlate = plates.find((p) => p.id === selectedPlateId) ?? null;
  const canAct =
    assignment?.status === AssignmentStatus.IN_PROGRESS ||
    assignment?.status === AssignmentStatus.ASSIGNED ||
    assignment?.status === AssignmentStatus.NEEDS_REVISIT;

  function fitMap() {
    const pts: LatLng[] = [
      ...routeCoords,
      ...plates.map((p) => ({ latitude: p.house.latitude, longitude: p.house.longitude })),
    ];
    if (pts.length === 0) return;
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: 80, right: 50, bottom: 160, left: 50 },
      animated: true,
    });
  }

  function flyToMe() {
    if (!myLocation) {
      Alert.alert('Chưa có vị trí', 'Đang chờ GPS — hãy ra nơi thoáng và thử lại sau ít giây.');
      return;
    }
    mapRef.current?.animateToRegion({ ...myLocation, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 700);
  }

  function openDirections(p: InstallPlateItem) {
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${p.house.latitude},${p.house.longitude}`,
    ).catch(() => Alert.alert('Lỗi', 'Không mở được ứng dụng bản đồ.'));
  }

  async function handleStart() {
    if (!assignment) return;
    setBusy(true);
    try {
      await startInstallAssignment(assignment.id);
      await load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Không bắt đầu được nhiệm vụ.');
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit() {
    if (!assignment) return;
    Alert.alert('Gửi duyệt', 'Gửi nhiệm vụ này cho người nghiệm thu? Sau khi gửi bạn không sửa được nữa.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gửi duyệt',
        onPress: async () => {
          setBusy(true);
          try {
            await submitInstallAssignment(assignment.id);
            Alert.alert('Thành công', 'Đã gửi duyệt nhiệm vụ thi công.');
            await load();
          } catch (err) {
            // API trả lý do cụ thể (còn biển chưa xử lý / còn biển cần thi công lại).
            Alert.alert('Chưa gửi duyệt được', err instanceof ApiError ? err.message : 'Thử lại sau.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  /** Lấy vị trí hiện tại 1 lần (ưu tiên vị trí đang theo dõi); không có thì null — không chặn thao tác. */
  function getPosition(): Promise<LatLng | null> {
    if (myLocation) return Promise.resolve(myLocation);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 6000);
      Geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 },
      );
    });
  }

  async function handleInstall(plate: InstallPlateItem) {
    if (!(await requestCameraPermission())) {
      Alert.alert('Thiếu quyền', 'Cần cấp quyền máy ảnh để chụp ảnh xác nhận đã gắn.');
      return;
    }
    const result = await launchCamera(PHOTO_PICKER_OPTIONS);
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Lỗi máy ảnh', result.errorMessage ?? result.errorCode);
      return;
    }
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    // Đứng xa nhà quá ngưỡng thì hỏi lại (không chặn — GPS có thể lệch).
    const pos = await getPosition();
    if (pos) {
      const d = haversineM(pos, { latitude: plate.house.latitude, longitude: plate.house.longitude });
      if (d > FAR_WARN_DISTANCE_M) {
        const proceed = await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Bạn đang đứng xa nhà',
            `Vị trí hiện tại cách nhà số ${plate.house.houseNumber} khoảng ${formatDistance(d)}. Vẫn xác nhận đã gắn?`,
            [
              { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Vẫn xác nhận', onPress: () => resolve(true) },
            ],
          ),
        );
        if (!proceed) return;
      }
    }

    setBusy(true);
    try {
      await installPlate(plate.id, uri);
      setSelectedPlateId(null);
      await load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Không xác nhận được (có thể do mất mạng) — thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReason() {
    if (!reasonTarget || !reasonText.trim()) return;
    setSubmittingReason(true);
    try {
      await markPlateNotInstalled(reasonTarget.id, reasonText.trim());
      setReasonTarget(null);
      setReasonText('');
      setSelectedPlateId(null);
      await load();
    } catch (err) {
      Alert.alert('Lỗi', err instanceof ApiError ? err.message : 'Không ghi nhận được — thử lại sau.');
    } finally {
      setSubmittingReason(false);
    }
  }

  function PlateActions({ plate }: { plate: InstallPlateItem }) {
    const s = plateState(plate);
    if (!canAct || s === 'installed') return null;
    return (
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => handleInstall(plate)} disabled={busy}>
          <Icon name="camera-outline" size={14} color="#fff" />
          <Text style={styles.btnPrimaryText}>Đã gắn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={() => {
            setReasonTarget(plate);
            setReasonText(plate.notInstalledReason ?? '');
          }}
          disabled={busy}
        >
          <Text style={styles.btnGhostText}>Chưa gắn được</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => openDirections(plate)}>
          <Icon name="directions" size={14} color="#1d4ed8" />
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !assignment) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#2563eb" />
      </View>
    );
  }

  const color = STATUS_COLOR[assignment.status];
  const { total, done, pct } = progressOf(assignment);

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {assignment.route?.name ?? assignment.zone.name}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {assignment.zone.name}
            {assignment.dueDate ? ` • Hạn ${new Date(assignment.dueDate).toLocaleDateString('vi-VN')}` : ''}
          </Text>
        </View>
        <Text style={[styles.badge, { backgroundColor: color.bg, color: color.text }]}>
          {ASSIGNMENT_STATUS_LABELS[assignment.status]}
        </Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.cardMeta}>
          {done}/{total} đã xử lý • {counts.installed} đã gắn • {counts.failed} chưa gắn được • {counts.pending + counts.revisit}{' '}
          còn lại
        </Text>
        {assignment.status === AssignmentStatus.NEEDS_REVISIT && !!assignment.reviewNote && (
          <Text style={styles.revisitNote}>Lý do thi công lại: {assignment.reviewNote}</Text>
        )}
        {!!assignment.note && <Text style={styles.cardMeta}>Ghi chú: {assignment.note}</Text>}

        <View style={styles.actions}>
          {(assignment.status === AssignmentStatus.ASSIGNED || assignment.status === AssignmentStatus.NEEDS_REVISIT) && (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleStart} disabled={busy}>
              <Text style={styles.btnPrimaryText}>
                {assignment.status === AssignmentStatus.NEEDS_REVISIT ? 'Mở lại để thi công' : 'Bắt đầu thi công'}
              </Text>
            </TouchableOpacity>
          )}
          {assignment.status === AssignmentStatus.IN_PROGRESS && (
            <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={handleSubmit} disabled={busy}>
              <Text style={styles.btnPrimaryText}>Gửi duyệt</Text>
            </TouchableOpacity>
          )}
          {busy && <ActivityIndicator size="small" color="#2563eb" />}
        </View>
      </View>

      <View style={styles.modeRow}>
        {(['list', 'map'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Icon name={m === 'list' ? 'format-list-bulleted' : 'map-outline'} size={16} color={mode === m ? '#fff' : '#475569'} />
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m === 'list' ? 'Danh sách' : 'Bản đồ'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'list' ? (
        <>
          <View style={styles.chipRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.chip, filter === f.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            data={visiblePlates}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>Không có biển nào trong mục này.</Text>}
            renderItem={({ item }) => {
              const s = plateState(item);
              const d = distanceTo(item);
              return (
                <View style={styles.plateCard}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        Số {item.house.houseNumber} {item.house.street}
                      </Text>
                      <Text style={styles.cardSub}>
                        {item.house.ownerName}
                        {item.house.ownerPhone ? ` • ${item.house.ownerPhone}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.badge, { backgroundColor: STATE_COLOR[s] + '22', color: STATE_COLOR[s] }]}>
                        {STATE_LABEL[s]}
                      </Text>
                      {d != null && <Text style={styles.distance}>{formatDistance(d)}</Text>}
                    </View>
                  </View>
                  {s === 'revisit' && <Text style={styles.revisitNote}>Lý do: {item.revisitReason}</Text>}
                  {s === 'failed' && !!item.notInstalledReason && (
                    <Text style={styles.cardMeta}>Lý do chưa gắn: {item.notInstalledReason}</Text>
                  )}
                  <PlateActions plate={item} />
                </View>
              );
            }}
          />
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={TAYNINH_REGION}
            onMapReady={fitMap}
            onPress={() => setSelectedPlateId(null)}
          >
            {routeCoords.length >= 2 && (
              <>
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#1d4ed8"
                  strokeWidth={5}
                  lineDashPattern={assignment.route?.snapped === false ? [12, 8] : undefined}
                />
                <Marker coordinate={routeCoords[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                  <View collapsable={false} style={[styles.endpoint, { backgroundColor: '#16a34a' }]}>
                    <Text style={styles.endpointText}>A</Text>
                  </View>
                </Marker>
                <Marker
                  coordinate={routeCoords[routeCoords.length - 1]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View collapsable={false} style={[styles.endpoint, { backgroundColor: '#dc2626' }]}>
                    <Text style={styles.endpointText}>B</Text>
                  </View>
                </Marker>
              </>
            )}
            {plates.map((p) => {
              const s = plateState(p);
              return (
                <Marker
                  key={`${p.id}-${s}-${p.id === selectedPlateId ? 's' : ''}`}
                  coordinate={{ latitude: p.house.latitude, longitude: p.house.longitude }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  zIndex={p.id === selectedPlateId ? 50 : 10}
                  onPress={() => setSelectedPlateId(p.id)}
                >
                  <View
                    collapsable={false}
                    style={[
                      styles.plateDot,
                      { backgroundColor: STATE_COLOR[s] },
                      p.id === selectedPlateId && styles.plateDotSelected,
                    ]}
                  >
                    <Text style={styles.plateDotText} numberOfLines={1}>
                      {p.house.houseNumber}
                    </Text>
                  </View>
                </Marker>
              );
            })}
            {myLocation && (
              <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={100} tracksViewChanges={false}>
                <View collapsable={false} style={styles.myDot} />
              </Marker>
            )}
          </MapView>

          <View style={styles.mapButtons}>
            <TouchableOpacity style={styles.fab} onPress={fitMap}>
              <Icon name="fit-to-screen-outline" size={20} color="#1d4ed8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fab} onPress={flyToMe}>
              <Icon name="crosshairs-gps" size={20} color="#1d4ed8" />
            </TouchableOpacity>
          </View>

          {selectedPlate && (
            <View style={styles.mapCard}>
              <Text style={styles.cardTitle}>
                Số {selectedPlate.house.houseNumber} {selectedPlate.house.street}
              </Text>
              <Text style={styles.cardSub}>
                {selectedPlate.house.ownerName} • {STATE_LABEL[plateState(selectedPlate)]}
                {distanceTo(selectedPlate) != null ? ` • ${formatDistance(distanceTo(selectedPlate) as number)}` : ''}
              </Text>
              <PlateActions plate={selectedPlate} />
            </View>
          )}
        </View>
      )}

      <Modal visible={!!reasonTarget} transparent animationType="slide" onRequestClose={() => setReasonTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>Chưa gắn được biển</Text>
              <TouchableOpacity onPress={() => setReasonTarget(null)}>
                <Icon name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>
            {reasonTarget && (
              <Text style={styles.cardSub}>
                Số {reasonTarget.house.houseNumber} {reasonTarget.house.street}
              </Text>
            )}
            <View style={styles.chipRow}>
              {NOT_INSTALLED_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReasonText(r)}
                  style={[styles.chip, reasonText === r && styles.chipActive]}
                >
                  <Text style={[styles.chipText, reasonText === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="Lý do chưa gắn được *"
              placeholderTextColor="#94a3b8"
              multiline
              style={styles.reasonInput}
            />
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, (!reasonText.trim() || submittingReason) && { opacity: 0.5 }]}
              onPress={handleSubmitReason}
              disabled={!reasonText.trim() || submittingReason}
            >
              {submittingReason ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimaryText}>Ghi nhận</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
  listContent: { padding: 12, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  plateCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontWeight: '700', fontSize: 14, color: '#0f172a', flexShrink: 1 },
  cardSub: { fontSize: 12, color: '#475569' },
  cardMeta: { fontSize: 11, color: '#64748b' },
  distance: { fontSize: 11, color: '#1d4ed8', fontWeight: '700', marginTop: 4 },
  revisitNote: { fontSize: 11, color: '#b91c1c', fontWeight: '600' },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#2563eb' },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: '#fff', padding: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },
  btnPrimary: { backgroundColor: '#1d4ed8' },
  btnSuccess: { backgroundColor: '#059669' },
  btnGhost: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnGhostText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  modeRow: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff' },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#f1f5f9',
  },
  modeBtnActive: { backgroundColor: '#1d4ed8' },
  modeText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  modeTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  endpoint: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  plateDot: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 4,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateDotSelected: { borderColor: '#0f172a', transform: [{ scale: 1.25 }] },
  plateDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  myDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2563eb', borderWidth: 3, borderColor: '#fff' },
  mapButtons: { position: 'absolute', right: 12, top: 12, gap: 10 },
  fab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
  },
  mapCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 4,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 8 },
  reasonInput: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
});
