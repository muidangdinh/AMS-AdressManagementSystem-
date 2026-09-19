import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ASSIGNMENT_STATUS_LABELS, AssignmentStatus } from '@tayninh/shared';
import type { SurveyAssignment } from '@tayninh/shared';
import { fetchMyAssignments, startAssignment, submitAssignment } from '../lib/surveysApi';
import { getActiveAssignmentId, setActiveAssignmentId } from '../lib/activeAssignment';

/**
 * TN-20 — góp ý khách hàng 11/09/2026 (mục Nhiệm vụ): "lưu trong nhật ký".
 * Vòng đời giao việc đã đủ (ASSIGNED → IN_PROGRESS → SUBMITTED →
 * COMPLETED/NEEDS_REVISIT) — KHÔNG thêm bảng mới, chỉ dựng dòng thời gian
 * từ các mốc đã có sẵn trên `SurveyAssignment` (không có mốc "bắt đầu" vì
 * schema không lưu — chỉ suy được từ trạng thái hiện tại).
 */
interface TimelineEntry {
  key: string;
  icon: string;
  title: string;
  detail?: string;
  at: string;
}

function buildTimeline(a: SurveyAssignment): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      key: 'created',
      icon: 'account-arrow-right-outline',
      title: 'Giao nhiệm vụ',
      detail: a.createdBy ? `Bởi ${a.createdBy.fullName}` : undefined,
      at: a.createdAt,
    },
  ];
  if (a.submittedAt) {
    entries.push({
      key: 'submitted',
      icon: 'send-outline',
      title: 'Gửi duyệt',
      detail: `${a._count?.houses ?? 0} nhà đã khảo sát lúc gửi`,
      at: a.submittedAt,
    });
  }
  if (a.reviewedAt) {
    const isRevisit = a.status === AssignmentStatus.NEEDS_REVISIT;
    entries.push({
      key: 'reviewed',
      icon: isRevisit ? 'refresh' : 'check-decagram-outline',
      title: isRevisit ? 'Yêu cầu khảo sát lại' : 'Nghiệm thu hoàn tất',
      detail:
        [a.reviewedBy ? `Bởi ${a.reviewedBy.fullName}` : null, a.reviewNote ? `Lý do: ${a.reviewNote}` : null]
          .filter(Boolean)
          .join(' — ') || undefined,
      at: a.reviewedAt,
    });
  }
  return entries;
}

const STATUS_COLOR: Record<AssignmentStatus, { bg: string; text: string }> = {
  [AssignmentStatus.ASSIGNED]: { bg: '#f1f5f9', text: '#475569' },
  [AssignmentStatus.IN_PROGRESS]: { bg: '#dbeafe', text: '#1e40af' },
  [AssignmentStatus.SUBMITTED]: { bg: '#fef3c7', text: '#92400e' },
  [AssignmentStatus.COMPLETED]: { bg: '#d1fae5', text: '#065f46' },
  [AssignmentStatus.NEEDS_REVISIT]: { bg: '#fee2e2', text: '#991b1b' },
};

/**
 * Phase 9 — mobile nhóm 9 "Quản lý nhiệm vụ". Chỉ đọc "nhiệm vụ của tôi" +
 * bắt đầu/gửi duyệt — giao việc/duyệt cả đợt làm ở web (ADMIN/CADASTRAL).
 */
export default function AssignmentsScreen() {
  const [assignments, setAssignments] = useState<SurveyAssignment[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // TN-20 — nhiệm vụ đang xem dòng thời gian xử lý (null = đóng modal).
  const [historyTarget, setHistoryTarget] = useState<SurveyAssignment | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, active] = await Promise.all([fetchMyAssignments(), getActiveAssignmentId()]);
      setAssignments(list);
      setActiveIdState(active);
    } catch {
      Alert.alert('Lỗi', 'Không tải được danh sách nhiệm vụ (kiểm tra kết nối mạng).');
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

  async function handleStart(assignment: SurveyAssignment) {
    setBusyId(assignment.id);
    try {
      await startAssignment(assignment.id);
      await setActiveAssignmentId(assignment.id);
      await load();
      Alert.alert(
        'Đã bắt đầu',
        `Nhiệm vụ "${assignment.zone.name}" đang là nhiệm vụ khảo sát hiện tại — sang tab Khảo Sát để thêm nhà. Số nhà tạo mới sẽ tự gắn vào nhiệm vụ này.`,
      );
    } catch {
      Alert.alert('Lỗi', 'Không bắt đầu được nhiệm vụ (kiểm tra kết nối mạng).');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSelectActive(assignment: SurveyAssignment) {
    await setActiveAssignmentId(assignment.id);
    setActiveIdState(assignment.id);
    Alert.alert('Đã chọn', `Nhiệm vụ "${assignment.zone.name}" là nhiệm vụ khảo sát hiện tại.`);
  }

  async function handleSubmit(assignment: SurveyAssignment) {
    Alert.alert(
      'Gửi duyệt nhiệm vụ',
      `Xác nhận đã khảo sát xong khu vực "${assignment.zone.name}" (${assignment._count?.houses ?? 0} nhà) và gửi duyệt?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi duyệt',
          onPress: async () => {
            setBusyId(assignment.id);
            try {
              await submitAssignment(assignment.id);
              await load();
              Alert.alert('Đã gửi duyệt', 'Chờ quản trị/cán bộ địa chính duyệt kết quả khảo sát.');
            } catch {
              Alert.alert('Lỗi', 'Không gửi duyệt được (kiểm tra kết nối mạng).');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  function handleSelectAssignment(assignment: SurveyAssignment) {
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [];
    if (assignment.status === AssignmentStatus.ASSIGNED || assignment.status === AssignmentStatus.NEEDS_REVISIT) {
      buttons.push({ text: 'Bắt đầu khảo sát', onPress: () => handleStart(assignment) });
    }
    if (assignment.status === AssignmentStatus.IN_PROGRESS) {
      if (activeId !== assignment.id) {
        buttons.push({ text: 'Chọn làm nhiệm vụ hiện tại', onPress: () => handleSelectActive(assignment) });
      }
      buttons.push({ text: 'Gửi duyệt', onPress: () => handleSubmit(assignment) });
    }
    if (buttons.length === 0) {
      Alert.alert(assignment.zone.name, ASSIGNMENT_STATUS_LABELS[assignment.status]);
      return;
    }
    buttons.push({ text: 'Đóng', style: 'cancel' });
    Alert.alert(
      assignment.zone.name,
      `${assignment.zone.ward?.name ?? ''} • ${ASSIGNMENT_STATUS_LABELS[assignment.status]}${
        assignment.reviewNote ? `\nLý do khảo sát lại: ${assignment.reviewNote}` : ''
      }`,
      buttons,
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{assignments.length} nhiệm vụ được giao</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loading} color="#2563eb" />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>Chưa được giao nhiệm vụ nào.</Text>}
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status];
            const isActive = item.id === activeId;
            return (
              <TouchableOpacity
                style={[styles.item, isActive && styles.itemActive]}
                onPress={() => handleSelectAssignment(item)}
                disabled={busyId === item.id}
              >
                <View style={styles.itemBody}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>{item.zone.name}</Text>
                    {isActive && <Text style={styles.activeBadge}>ĐANG CHỌN</Text>}
                  </View>
                  <Text style={styles.itemSub}>{item.zone.ward?.name ?? 'Chưa gán xã/phường'}</Text>
                  <Text style={styles.itemMeta}>
                    {item._count?.houses ?? 0} nhà đã khảo sát
                    {item.dueDate ? ` • Hạn ${new Date(item.dueDate).toLocaleDateString('vi-VN')}` : ''}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: color.bg }]}>
                    <Text style={[styles.badgeText, { color: color.text }]}>
                      {ASSIGNMENT_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>
                {busyId === item.id ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <TouchableOpacity
                    style={styles.historyBtn}
                    onPress={() => setHistoryTarget(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Icon name="history" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* TN-20 — dòng thời gian xử lý nhiệm vụ ("lưu trong nhật ký"). */}
      <Modal
        visible={historyTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryTarget(null)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyTitle}>{historyTarget?.zone.name}</Text>
                <Text style={styles.historySubtitle}>Dòng thời gian xử lý</Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            {historyTarget &&
              buildTimeline(historyTarget).map((entry, i, arr) => (
                <View key={entry.key} style={styles.timelineRow}>
                  <View style={styles.timelineIconCol}>
                    <View style={styles.timelineIconWrap}>
                      <Icon name={entry.icon} size={16} color="#2563eb" />
                    </View>
                    {i < arr.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineTitle}>{entry.title}</Text>
                    {entry.detail && <Text style={styles.timelineDetail}>{entry.detail}</Text>}
                    <Text style={styles.timelineAt}>{new Date(entry.at).toLocaleString('vi-VN')}</Text>
                  </View>
                </View>
              ))}
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
  loading: { marginTop: 40 },
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
  itemActive: { borderColor: '#2563eb', borderWidth: 2 },
  itemBody: { flex: 1, gap: 2 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { fontWeight: '700', fontSize: 13, color: '#0f172a' },
  activeBadge: { fontSize: 9, fontWeight: '700', color: '#2563eb' },
  itemSub: { fontSize: 12, color: '#475569' },
  itemMeta: { fontSize: 10, color: '#94a3b8' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  historyBtn: { padding: 4 },
  historyOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, maxHeight: '80%' },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  historyTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  historySubtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  timelineRow: { flexDirection: 'row' },
  timelineIconCol: { alignItems: 'center', width: 28 },
  timelineIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 2, minHeight: 20 },
  timelineBody: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  timelineDetail: { fontSize: 12, color: '#475569', marginTop: 1 },
  timelineAt: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
});
