import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, type CameraRef, GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';
import { distanceToPathM } from '@tayninh/shared';
import GoongMap from './GoongMap';

/** Tuyến đường của nhiệm vụ đang chọn — vẽ lên bản đồ để chấm nhà dọc tuyến. */
export interface PickerRoute {
  name: string;
  path: [number, number][];
  snapped?: boolean;
}

/** Xa tuyến quá khoảng này (mét) thì tô cam dòng khoảng cách — cùng ngưỡng với banner ở SurveyScreen. */
const ROUTE_WARN_DISTANCE_M = 200;
const GPS_TIMEOUT_MS = 10000;

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/**
 * Chọn tọa độ bằng cách chạm bản đồ hoặc thả ghim giữa khung nhìn — thay thế/bổ sung cho
 * "Cập nhật GPS" khi máy không bắt được tín hiệu vệ tinh (trong nhà, khu vực
 * sóng yếu) nhưng khảo sát viên biết rõ vị trí trên bản đồ. Dùng chung
 * MapLibre + tile Goong với MapScreen.tsx.
 *
 * Có `route` (nhiệm vụ đang chọn được giao theo tuyến) → vẽ tuyến và mở ra ngay tại tuyến để
 * chấm nhà dọc tuyến. Nút 📍 bay về vị trí đang đứng (không tự dời ghim).
 */
export default function LocationPickerModal({
  visible,
  initialLat,
  initialLng,
  route,
  houseLocation,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialLat: number;
  initialLng: number;
  route?: PickerRoute | null;
  /**
   * Vị trí của nhà đang được chọn để khảo sát lại — vẽ dấu 🏠 trên bản đồ và có nút bay về đó mỗi khi
   * người dùng kéo bản đồ đi xa. Bỏ trống khi khảo sát nhà mới.
   */
  houseLocation?: { latitude: number; longitude: number } | null;
  /** Giữ để tương thích nơi gọi — ghim giờ do người dùng tự thả bằng nút "Ghim". */
  hasRealLocation?: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const cameraRef = useRef<CameraRef>(null);
  const [coord, setCoord] = useState({ latitude: initialLat, longitude: initialLng });
  /** Có tuyến thì ghim ẩn lúc đầu — bấm nút "Ghim" để thả ghim vào giữa khung nhìn. */
  const [pinPlaced, setPinPlaced] = useState(true);
  /** Tâm khung nhìn hiện tại — nơi nút "Ghim" thả ghim xuống. */
  const centerRef = useRef({ latitude: initialLat, longitude: initialLng });
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const hasRoute = !!route && route.path.length >= 2;
  const routeCoords = hasRoute ? route!.path.map(([latitude, longitude]) => ({ latitude, longitude })) : [];

  function fitRoute() {
    if (routeCoords.length < 2) return;
    const lats = routeCoords.map((p) => p.latitude);
    const lngs = routeCoords.map((p) => p.longitude);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 60, right: 50, bottom: 60, left: 50 }, duration: 800 },
    );
  }

  // Map chỉ mount khi `visible`, nhưng prop ban đầu có thể là mặc định trước khi GPS xong —
  // đặt lại ghim mỗi lần mở modal để khớp tọa độ hiện tại.
  // Có tuyến mà chưa có vị trí thật → ghim ở điểm giữa tuyến để luôn nằm trong khung nhìn.
  useEffect(() => {
    if (!visible) return;
    setCoord({ latitude: initialLat, longitude: initialLng });
    centerRef.current = { latitude: initialLat, longitude: initialLng };
    // Có tuyến: chưa hiện ghim — người dùng bay tới đoạn tuyến cần chấm rồi bấm "Ghim".
    setPinPlaced(!hasRoute);
    setMyLocation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /** Bay về vị trí nhà đang chọn (không dời ghim — người dùng tự chạm hoặc bấm "Ghim"). */
  function flyToHouse() {
    if (!houseLocation) return;
    cameraRef.current?.flyTo({
      center: [houseLocation.longitude, houseLocation.latitude],
      zoom: 18,
      duration: 700,
    });
  }

  function handleLocateMe() {
    setLocating(true);
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      setLocating(false);
      Alert.alert('Lỗi GPS', 'Không lấy được vị trí sau 10 giây. Hãy ra nơi thoáng rồi thử lại.');
    }, GPS_TIMEOUT_MS);
    Geolocation.getCurrentPosition(
      (position) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        const { latitude, longitude } = position.coords;
        setMyLocation({ latitude, longitude });
        cameraRef.current?.flyTo({ center: [longitude, latitude], zoom: 17, duration: 800 });
        setLocating(false);
      },
      () => {
        // Bỏ qua — timer phía trên quyết định có báo lỗi hay không (giống MapScreen).
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  }

  function dropPinAtCenter() {
    setCoord(centerRef.current);
    setPinPlaced(true);
  }

  const distanceM = hasRoute && pinPlaced ? distanceToPathM(coord.latitude, coord.longitude, route!.path) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chọn vị trí trên bản đồ</Text>
          <Text style={styles.hint}>
            {hasRoute
              ? `Di chuyển tới đoạn tuyến "${route!.name}" cần chấm, rồi chạm vào đúng vị trí căn nhà`
              : 'Chạm vào bản đồ hoặc bấm "Ghim" để chọn đúng vị trí căn nhà'}
          </Text>
        </View>

        <View style={styles.mapWrap}>
          {visible && (
            <GoongMap
              onReady={() => {
                if (hasRoute) fitRoute();
              }}
              onRegionDidChange={(center) => {
                centerRef.current = center;
              }}
              onPress={(latitude, longitude) => {
                setCoord({ latitude, longitude });
                setPinPlaced(true);
              }}
            >
              <Camera
                ref={cameraRef}
                initialViewState={{ center: [initialLng, initialLat], zoom: 14 }}
              />

              {hasRoute && (
                <GeoJSONSource
                  id="picker-route"
                  data={{
                    type: 'FeatureCollection',
                    features: [
                      {
                        type: 'Feature',
                        geometry: {
                          type: 'LineString',
                          coordinates: routeCoords.map((p) => [p.longitude, p.latitude]),
                        },
                        properties: {},
                      },
                    ],
                  }}
                >
                  <Layer
                    id="picker-route-line"
                    type="line"
                    source="picker-route"
                    layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    paint={{
                      'line-color': '#1d4ed8',
                      'line-width': 6,
                      ...(route!.snapped === false ? { 'line-dasharray': [2, 2] } : {}),
                    }}
                  />
                </GeoJSONSource>
              )}

              {hasRoute && (
                <>
                  <Marker lngLat={[routeCoords[0].longitude, routeCoords[0].latitude]}>
                    <View style={[styles.endpoint, styles.endpointStart]}>
                      <Text style={styles.endpointText}>A</Text>
                    </View>
                  </Marker>
                  <Marker
                    lngLat={[
                      routeCoords[routeCoords.length - 1].longitude,
                      routeCoords[routeCoords.length - 1].latitude,
                    ]}
                  >
                    <View style={[styles.endpoint, styles.endpointEnd]}>
                      <Text style={styles.endpointText}>B</Text>
                    </View>
                  </Marker>
                </>
              )}

              {houseLocation && (
                <Marker lngLat={[houseLocation.longitude, houseLocation.latitude]}>
                  <View style={styles.homeMarker}>
                    <Text style={styles.homeMarkerText}>🏠</Text>
                  </View>
                </Marker>
              )}

              {myLocation && (
                <Marker lngLat={[myLocation.longitude, myLocation.latitude]}>
                  <View style={styles.myLocationDot} />
                </Marker>
              )}

              {pinPlaced && (
                <Marker lngLat={[coord.longitude, coord.latitude]}>
                  <View style={styles.pinMarker} />
                </Marker>
              )}
            </GoongMap>
          )}

          {/* Thả ghim vào giữa khung nhìn hiện tại (vd sau khi bay tới tuyến). */}
          <TouchableOpacity style={styles.pinButton} onPress={dropPinAtCenter}>
            <Text style={styles.pinButtonText}>📌 {pinPlaced ? 'Ghim lại giữa màn hình' : 'Ghim'}</Text>
          </TouchableOpacity>

          <View style={styles.fabColumn}>
            {!!houseLocation && (
              <TouchableOpacity style={styles.fab} onPress={flyToHouse} accessibilityLabel="Bay về vị trí nhà đang chọn">
                <Text style={styles.fabText}>🏠</Text>
              </TouchableOpacity>
            )}
            {hasRoute && (
              <TouchableOpacity style={styles.fab} onPress={fitRoute} accessibilityLabel="Bay tới tuyến">
                <Text style={styles.fabText}>🛣️</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.fab}
              onPress={handleLocateMe}
              disabled={locating}
              accessibilityLabel="Bay về vị trí đang đứng"
            >
              {locating ? <ActivityIndicator size="small" color="#2563eb" /> : <Text style={styles.fabText}>📍</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.coordRow}>
          <Text style={styles.coordText}>
            {pinPlaced
              ? `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`
              : 'Chưa ghim vị trí'}
          </Text>
          {distanceM != null && (
            <Text style={[styles.distanceText, distanceM > ROUTE_WARN_DISTANCE_M && styles.distanceWarn]}>
              Cách tuyến {formatDistance(distanceM)}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnCancelText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnConfirm, !pinPlaced && styles.btnDisabled]}
            disabled={!pinPlaced}
            onPress={() => onConfirm(coord.latitude, coord.longitude)}
          >
            <Text style={styles.btnConfirmText}>Xác nhận vị trí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  mapWrap: { flex: 1 },
  homeMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1d4ed8',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeMarkerText: { fontSize: 15 },
  fabColumn: { position: 'absolute', right: 14, bottom: 16, gap: 10 },
  fab: {
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
  fabText: { fontSize: 20 },
  endpoint: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointStart: { backgroundColor: '#16a34a' },
  endpointEnd: { backgroundColor: '#dc2626' },
  endpointText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  myLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  pinMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 5,
  },
  coordRow: { padding: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  coordText: { fontFamily: 'monospace', fontSize: 13, color: '#0f172a' },
  distanceText: { fontSize: 12, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  distanceWarn: { color: '#b45309' },
  actions: { flexDirection: 'row', gap: 10, padding: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#475569', fontWeight: '700' },
  btnConfirm: { backgroundColor: '#1d4ed8' },
  btnConfirmText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  pinButton: {
    position: 'absolute',
    left: 14,
    bottom: 16,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  pinButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
