import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NearbyHouseItem } from '@tayninh/shared';
import { HOUSE_STATUS_LABELS, HouseStatus } from '@tayninh/shared';
import { fetchNearbyHouses } from '../lib/surveysApi';

const RADIUS_OPTIONS = [50, 100, 300];
const DEFAULT_RADIUS = 100;
const MAX_ROWS = 10;
/** Đứng dịch chuyển hơn ngưỡng này (mét) thì tải lại danh sách — tránh gọi API liên tục khi GPS dao động. */
const REFRESH_MOVE_M = 30;
const DEBOUNCE_MS = 500;

const STATUS_COLOR: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: '#10b981',
  [HouseStatus.PENDING]: '#f59e0b',
  [HouseStatus.NEEDS_ADJUST]: '#ef4444',
};

/** Khoảng cách mặt cầu giữa 2 điểm (mét). */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Thẻ "Chủ hộ gần bạn" ở form khảo sát: liệt kê nhà/chủ hộ quanh vị trí GPS (mặc định 100 m, tối đa 10
 * nhà) để cán bộ tránh khảo sát trùng và chạm 1 dòng tự điền chủ hộ + khu vực. Chỉ dùng toạ độ đã có trên
 * form (không theo dõi GPS liên tục) nên không tốn pin; chỉ tải lại khi vị trí dịch hơn ~30 m.
 */
export default function NearbyOwnersCard({
  lat,
  lng,
  hasLocation,
  gettingGps,
  onGetGps,
  onPick,
}: {
  lat: number;
  lng: number;
  /** false = toạ độ còn là mặc định (chưa có GPS/chưa chọn trên bản đồ). */
  hasLocation: boolean;
  gettingGps: boolean;
  onGetGps: () => void;
  onPick: (house: NearbyHouseItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [items, setItems] = useState<NearbyHouseItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** Toạ độ của lần tải gần nhất — để biết đã dịch chuyển đủ xa chưa. */
  const lastRef = useRef<{ lat: number; lng: number; radius: number } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(
    async (force: boolean) => {
      const last = lastRef.current;
      if (
        !force &&
        last &&
        last.radius === radius &&
        distanceM(last.lat, last.lng, lat, lng) < REFRESH_MOVE_M
      ) {
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetchNearbyHouses(lat, lng, radius, MAX_ROWS, controller.signal);
        if (controller.signal.aborted) return;
        lastRef.current = { lat, lng, radius };
        setItems(res);
      } catch {
        // Mất mạng/lỗi — chỉ hiện dòng nhẹ, nhập tay vẫn dùng bình thường.
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [lat, lng, radius],
  );

  // Tự tải khi có vị trí thật, sau khi vị trí/bán kính đổi (debounce); bấm làm mới thì tải ngay.
  useEffect(() => {
    if (!hasLocation || !open) return;
    // Bấm làm mới đã xóa `lastRef` nên `load` không bị chặn bởi ngưỡng dịch chuyển.
    const timer = setTimeout(() => load(false), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hasLocation, open, load, refreshTick]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <Icon name="home-search-outline" size={18} color="#1d4ed8" />
        <Text style={styles.title}>Chủ hộ gần bạn</Text>
        {loading && <ActivityIndicator size="small" color="#2563eb" />}
        <View style={{ flex: 1 }} />
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
      </TouchableOpacity>

      {open && (
        <View>
          <View style={styles.controls}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setRadius(r)}
                style={[styles.chip, radius === r && styles.chipActive]}
              >
                <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r} m</Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => {
                lastRef.current = null;
                setRefreshTick((t) => t + 1);
              }}
              disabled={!hasLocation}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="refresh" size={20} color={hasLocation ? '#1d4ed8' : '#cbd5e1'} />
            </TouchableOpacity>
          </View>

          {!hasLocation ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Chưa có vị trí — lấy GPS để xem chủ hộ quanh bạn.</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={onGetGps} disabled={gettingGps}>
                {gettingGps ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.gpsBtnText}>Lấy GPS</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : failed && !items ? (
            <Text style={styles.emptyText}>Cần có mạng để xem chủ hộ gần đây.</Text>
          ) : items && items.length === 0 ? (
            <Text style={styles.emptyText}>
              Chưa có hồ sơ nào trong {radius} m — đây có thể là nhà đầu tiên ở khu vực này.
            </Text>
          ) : (
            (items ?? []).map((h, i) => (
              <TouchableOpacity
                key={h.id}
                style={[styles.row, i === 0 && styles.rowNearest, i > 0 && styles.rowBorder]}
                onPress={() => onPick(h)}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.house} numberOfLines={1}>
                    Số {h.houseNumber} {h.street}
                  </Text>
                  <Text style={styles.owner} numberOfLines={1}>
                    {h.ownerName}
                    {h.ownerPhone ? ` • ${h.ownerPhone}` : ''}
                  </Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.dot, { backgroundColor: STATUS_COLOR[h.status] ?? '#94a3b8' }]} />
                    <Text style={styles.status}>{HOUSE_STATUS_LABELS[h.status]}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.distance}>{h.distance} m</Text>
                  <Text style={styles.tap}>Chạm để điền</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          {failed && !!items && <Text style={styles.stale}>Không cập nhật được (mất mạng) — đang hiện danh sách lần trước.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#fff' },
  empty: { gap: 8, paddingVertical: 4 },
  emptyText: { fontSize: 12, color: '#64748b', paddingVertical: 6 },
  gpsBtn: { alignSelf: 'flex-start', backgroundColor: '#1d4ed8', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  gpsBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  rowNearest: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  house: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  owner: { fontSize: 12, color: '#475569' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 10, color: '#64748b' },
  distance: { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  tap: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  stale: { fontSize: 10, color: '#b45309', paddingTop: 6 },
});
