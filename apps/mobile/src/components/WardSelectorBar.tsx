import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Ward } from '@tayninh/shared';
import { fetchWards } from '../lib/addressCatalog';
import { useWorkingWard, type WorkingWard } from '../lib/workingWard';

/**
 * TN-03 — thanh chọn "xã đang làm việc" (góp ý khách hàng 11/09/2026 — hệ
 * thống phục vụ nhiều xã, có cán bộ phụ trách nhiều xã nên bộ chọn PHẢI dễ
 * thấy, không chôn vào menu sâu). Đặt ở đầu tab Tổng Quan và tab Khảo Sát.
 *
 * Khi đang có NHIỆM VỤ KHẢO SÁT được chọn (lớp 1), xã hiển thị luôn theo
 * nhiệm vụ đó — lớp 1 luôn thắng lớp 3 (tự chọn), đúng mô hình 3 lớp ở
 * `workingWard.ts`. Người dùng vẫn đổi lựa chọn tự chọn được (áp dụng ngay
 * khi không còn nhiệm vụ đang chọn), tránh gây khó hiểu bằng 1 dòng ghi chú.
 */
export default function WardSelectorBar() {
  const { ward, source, chooseWard } = useWorkingWard();
  const [modalVisible, setModalVisible] = useState(false);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);

  useEffect(() => {
    if (!modalVisible) return;
    setLoadingWards(true);
    fetchWards()
      .then(setWards)
      .finally(() => setLoadingWards(false));
  }, [modalVisible]);

  function handlePick(next: WorkingWard | null) {
    setModalVisible(false);
    chooseWard(next);
  }

  return (
    <>
      <TouchableOpacity style={styles.bar} onPress={() => setModalVisible(true)}>
        <Icon name="map-marker-radius-outline" size={16} color="#2563eb" />
        <Text style={styles.text} numberOfLines={1}>
          {ward ? `Xã ${ward.name}` : 'Toàn tỉnh'}
        </Text>
        {source === 'assignment' && <Text style={styles.hint}>· theo nhiệm vụ đang khảo sát</Text>}
        <Icon name="chevron-down" size={16} color="#64748b" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn xã đang làm việc</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Icon name="close" size={22} color="#334155" />
            </TouchableOpacity>
          </View>

          {source === 'assignment' && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Đang có nhiệm vụ khảo sát chọn xã "{ward?.name}" — lựa chọn dưới đây chỉ áp dụng khi
                không còn nhiệm vụ đang chọn (tab Nhiệm Vụ).
              </Text>
            </View>
          )}

          {loadingWards ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2563eb" />
          ) : (
            <FlatList
              data={wards}
              keyExtractor={(w) => w.id}
              ListHeaderComponent={
                <TouchableOpacity style={styles.item} onPress={() => handlePick(null)}>
                  <Icon name="earth" size={18} color="#2563eb" style={{ marginRight: 10 }} />
                  <Text style={styles.itemText}>Tất cả xã (Toàn tỉnh)</Text>
                  {!ward && <Icon name="check" size={18} color="#16a34a" />}
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => handlePick({ id: item.id, name: item.name })}>
                  <Icon name="map-marker-outline" size={18} color="#64748b" style={{ marginRight: 10 }} />
                  <Text style={styles.itemText}>{item.name}</Text>
                  {ward?.id === item.id && <Icon name="check" size={18} color="#16a34a" />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  text: { flex: 0, fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  hint: { flex: 1, fontSize: 11, color: '#3b82f6' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  notice: { backgroundColor: '#fffbeb', padding: 12, margin: 12, borderRadius: 8 },
  noticeText: { fontSize: 12, color: '#92400e' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemText: { flex: 1, fontSize: 14, color: '#0f172a' },
});
