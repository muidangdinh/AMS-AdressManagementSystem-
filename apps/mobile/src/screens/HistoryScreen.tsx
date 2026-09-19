import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BUILDING_TYPE_LABELS } from '@tayninh/shared';
import { deleteDraft, getDrafts, syncAllPending, SurveyDraft } from '../lib/surveyStore';

const STATUS_LABEL: Record<SurveyDraft['status'], string> = {
  pending_sync: 'Chờ đồng bộ',
  syncing: 'Đang đồng bộ…',
  synced: 'Đã đồng bộ',
  sync_error: 'Lỗi đồng bộ',
};

const STATUS_COLOR: Record<SurveyDraft['status'], { bg: string; text: string }> = {
  pending_sync: { bg: '#fef3c7', text: '#92400e' },
  syncing: { bg: '#dbeafe', text: '#1e40af' },
  synced: { bg: '#d1fae5', text: '#065f46' },
  sync_error: { bg: '#fee2e2', text: '#991b1b' },
};

export default function HistoryScreen() {
  const [drafts, setDrafts] = useState<SurveyDraft[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setDrafts(await getDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSyncAll() {
    setSyncing(true);
    try {
      const { succeeded, failed } = await syncAllPending();
      await load();
      Alert.alert(
        'Đồng bộ hoàn tất',
        `Thành công: ${succeeded} hồ sơ` + (failed > 0 ? ` — Thất bại: ${failed} hồ sơ` : ''),
      );
    } finally {
      setSyncing(false);
    }
  }

  function handleDelete(localId: string) {
    Alert.alert('Xóa hồ sơ', 'Bạn chắc chắn muốn xóa hồ sơ khảo sát này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          await deleteDraft(localId);
          await load();
        },
      },
    ]);
  }

  const pendingCount = drafts.filter((d) => d.status !== 'synced').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{drafts.length} hồ sơ khảo sát</Text>
        <TouchableOpacity
          style={[styles.syncButton, pendingCount === 0 && styles.syncButtonDisabled]}
          onPress={handleSyncAll}
          disabled={syncing || pendingCount === 0}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>Đồng bộ ({pendingCount})</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Chưa có hồ sơ khảo sát nào — sang tab Khảo Sát để thêm mới.</Text>
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.status];
          return (
            <View style={styles.item}>
              <View style={styles.thumbWrap}>
                {item.photoUris && item.photoUris.length > 0 ? (
                  <Image source={{ uri: item.photoUris[0] }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                {item.photoUris && item.photoUris.length > 1 && (
                  <View style={styles.photoCountBadge}>
                    <Text style={styles.photoCountText}>+{item.photoUris.length - 1}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>
                  Số {item.houseNumber} {item.street}
                </Text>
                <Text style={styles.itemSub}>{item.ownerName}</Text>
                <Text style={styles.itemMeta}>
                  {BUILDING_TYPE_LABELS[item.buildingType]} • {new Date(item.createdAt).toLocaleString('vi-VN')}
                </Text>
                <View style={[styles.badge, { backgroundColor: color.bg }]}>
                  <Text style={[styles.badgeText, { color: color.text }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
                {item.syncError && <Text style={styles.errorText}>{item.syncError}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.localId)}>
                <Text style={styles.deleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
  syncButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  syncButtonDisabled: { backgroundColor: '#cbd5e1' },
  syncButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  listContent: { padding: 12, gap: 10 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 13 },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    marginBottom: 10,
  },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e2e8f0' },
  thumbPlaceholder: {},
  photoCountBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 20,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  photoCountText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontWeight: '700', fontSize: 13, color: '#0f172a' },
  itemSub: { fontSize: 12, color: '#475569' },
  itemMeta: { fontSize: 10, color: '#94a3b8' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  errorText: { fontSize: 10, color: '#dc2626', marginTop: 2 },
  deleteText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
});
