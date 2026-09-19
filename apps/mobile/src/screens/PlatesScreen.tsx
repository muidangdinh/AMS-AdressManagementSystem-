import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera } from 'react-native-image-picker';
import type { HousePlate, HouseSummary, PaginatedResult } from '@tayninh/shared';
import { HOUSE_STATUS_LABELS } from '@tayninh/shared';
import { apiFetch } from '../lib/api';
import { fetchPendingPlates, installPlate, markPlateNotInstalled } from '../lib/platesApi';
import type { MainTabsParamList } from '../navigation/MainTabs';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULT_LIMIT = 15;

/**
 * Phase 8 — mobile nhóm 7 "Quản lý gắn biển số". Không quét QR bằng camera
 * (chưa có thư viện scan trong dự án, thêm mới cần native-link không kiểm
 * chứng được ở máy dev này) — cán bộ chọn thẳng biển từ danh sách "chờ gắn"
 * thay vì quét, tác dụng nghiệp vụ tương đương (7.1, 7.4 qua xem trực tiếp
 * thông tin nhà trước khi xác nhận).
 *
 * TN-19 — góp ý khách hàng 11/09/2026: đổi tab "Gắn Biển" thành "Tra Cứu",
 * thêm thanh tra cứu toàn bộ hồ sơ số nhà (GET /api/houses?search=) ở đầu
 * màn hình. Danh sách "biển chờ gắn" và thao tác xác nhận gắn/ghi lý do
 * chưa gắn GIỮ NGUYÊN bên dưới — đây là đường DUY NHẤT để hồ sơ tự chuyển
 * sang "Đã cấp biển & QR" (BR-40 trong business-logic.md), không được bỏ.
 */
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

export default function PlatesScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const [plates, setPlates] = useState<HousePlate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // TN-19 — thanh tra cứu toàn bộ hồ sơ số nhà, độc lập với danh sách "biển
  // chờ gắn" bên dưới (debounce 400ms, cùng nhịp với MapScreen).
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HouseSummary[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch<PaginatedResult<HouseSummary>>(
          `/api/houses?search=${encodeURIComponent(query)}&pageSize=${SEARCH_RESULT_LIMIT}`,
        );
        setSearchResults(res.items);
        setSearchTotal(res.total);
      } catch {
        // Mất mạng — im lặng, thanh tra cứu chỉ là tiện ích phụ, không chặn danh sách gắn biển bên dưới.
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  function handleSelectSearchResult(house: HouseSummary) {
    navigation.navigate('Map', { focusId: house.id, lat: house.latitude, lng: house.longitude });
  }

  const [reasonTarget, setReasonTarget] = useState<HousePlate | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlates(await fetchPendingPlates());
    } catch {
      Alert.alert('Lỗi', 'Không tải được danh sách biển cần gắn (kiểm tra kết nối mạng).');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleInstall(plate: HousePlate) {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Thiếu quyền', 'Cần cấp quyền máy ảnh để chụp ảnh xác nhận đã gắn.');
      return;
    }
    const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert('Lỗi máy ảnh', result.errorMessage ?? result.errorCode);
      return;
    }
    const uri = result.assets?.[0]?.uri;

    setBusyId(plate.id);
    try {
      await installPlate(plate.id, uri);
      Alert.alert('Thành công', 'Đã xác nhận gắn biển số.');
      await load();
    } catch {
      Alert.alert('Lỗi', 'Không xác nhận gắn biển được (có thể do mất mạng) — thử lại sau.');
    } finally {
      setBusyId(null);
    }
  }

  function openNotInstalledModal(plate: HousePlate) {
    setReasonTarget(plate);
    setReasonText('');
  }

  async function handleSubmitReason() {
    if (!reasonTarget || !reasonText.trim()) return;
    setSubmittingReason(true);
    try {
      await markPlateNotInstalled(reasonTarget.id, reasonText.trim());
      setReasonTarget(null);
      await load();
    } catch {
      Alert.alert('Lỗi', 'Không ghi nhận được — thử lại sau.');
    } finally {
      setSubmittingReason(false);
    }
  }

  function handleSelectPlate(plate: HousePlate) {
    Alert.alert(
      `Biển ${plate.plateCode}`,
      `Số ${plate.house.houseNumber} ${plate.house.street} — ${plate.house.ownerName}`,
      [
        { text: 'Xác nhận đã gắn (chụp ảnh)', onPress: () => handleInstall(plate) },
        { text: 'Ghi nhận chưa gắn được', onPress: () => openNotInstalledModal(plate) },
        { text: 'Hủy', style: 'cancel' },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Icon name="magnify" size={18} color="#64748b" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tra cứu số nhà, chủ hộ, SĐT, CCCD hoặc mã QR..."
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#2563eb" />}
      </View>

      {searchQuery.trim().length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !searching ? <Text style={styles.empty}>Không tìm thấy hồ sơ nào khớp.</Text> : null
          }
          ListHeaderComponent={
            searchResults.length > 0 ? (
              <Text style={styles.searchResultNote}>
                {searchTotal > SEARCH_RESULT_LIMIT
                  ? `Hiện ${SEARCH_RESULT_LIMIT}/${searchTotal} kết quả — thu hẹp từ khoá để tìm chính xác hơn`
                  : `${searchTotal} kết quả`}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => handleSelectSearchResult(item)}>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>
                  Số {item.houseNumber} {item.street}
                </Text>
                <Text style={styles.itemSub}>
                  {item.ward} • {item.ownerName}
                </Text>
                <Text style={styles.itemMeta}>
                  {HOUSE_STATUS_LABELS[item.status]} • {item.qrCode}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{plates.length} biển chờ gắn</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={plates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Không có biển nào đang chờ gắn.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelectPlate(item)}
              disabled={busyId === item.id}
            >
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>
                  Số {item.house.houseNumber} {item.house.street}
                </Text>
                <Text style={styles.itemSub}>{item.house.ownerName}</Text>
                <Text style={styles.itemMeta}>
                  {item.plateCode} • Cấp lúc {new Date(item.issuedAt).toLocaleDateString('vi-VN')}
                </Text>
                {item.notInstalledReason && (
                  <Text style={styles.warnText}>
                    Lần trước chưa gắn được: {item.notInstalledReason}
                  </Text>
                )}
              </View>
              {busyId === item.id ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
        </>
      )}

      <Modal visible={!!reasonTarget} animationType="slide" transparent onRequestClose={() => setReasonTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lý do chưa gắn được</Text>
            {reasonTarget && (
              <Text style={styles.itemMeta}>
                {reasonTarget.plateCode} — Số {reasonTarget.house.houseNumber} {reasonTarget.house.street}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              value={reasonText}
              onChangeText={setReasonText}
              placeholder="vd: Chủ nhà đi vắng, hẹn lại lần sau"
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setReasonTarget(null)}
              >
                <Text style={styles.modalButtonCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSubmitReason}
                disabled={submittingReason || !reasonText.trim()}
              >
                {submittingReason ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonSubmitText}>Ghi nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },
  searchResultNote: { fontSize: 11, color: '#64748b', paddingHorizontal: 4, marginBottom: 6 },
  listContent: { padding: 12, gap: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginBottom: 10,
  },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontWeight: '700', fontSize: 13, color: '#0f172a' },
  itemSub: { fontSize: 12, color: '#475569' },
  itemMeta: { fontSize: 10, color: '#94a3b8' },
  warnText: { fontSize: 10, color: '#d97706', marginTop: 2 },
  chevron: { fontSize: 22, color: '#cbd5e1', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 10 },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#f1f5f9' },
  modalButtonCancelText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  modalButtonSubmit: { backgroundColor: '#1d4ed8' },
  modalButtonSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
