import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ASSIGNMENT_EVENT_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  AssignmentEventAction,
  AssignmentStatus,
  assignmentProgressPercent,
} from '@tayninh/shared';
import type {
  AssignmentEvent,
  AssignmentHouse,
  AssignmentIssueKind,
  SurveyAssignment,
} from '@tayninh/shared';
import {
  fetchAssignmentHouses,
  fetchMyAssignments,
  getAssignment,
  reportAssignmentIssue,
  startAssignment,
  submitAssignment,
} from '../lib/surveysApi';
import { ApiError } from '../lib/api';
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

const EVENT_ICON: Record<AssignmentEventAction, string> = {
  [AssignmentEventAction.CREATED]: 'account-arrow-right-outline',
  [AssignmentEventAction.STARTED]: 'play-circle-outline',
  [AssignmentEventAction.SUBMITTED]: 'send-outline',
  [AssignmentEventAction.COMPLETED]: 'check-decagram-outline',
  [AssignmentEventAction.REVISIT_REQUESTED]: 'refresh',
  [AssignmentEventAction.ISSUE_REPORTED]: 'flag-outline',
  [AssignmentEventAction.HELP_REQUESTED]: 'lifebuoy',
  [AssignmentEventAction.HOUSE_RESURVEYED]: 'file-document-edit-outline',
};

/** Phase 11 Đợt 2 — dòng thời gian lấy từ nhật ký sự kiện thật do API ghi lại. */
function eventToEntry(e: AssignmentEvent): TimelineEntry {
  return {
    key: String(e.id),
    icon: EVENT_ICON[e.action] ?? 'circle-small',
    title: ASSIGNMENT_EVENT_LABELS[e.action] ?? e.action,
    detail: [e.actor?.fullName ? `Bởi ${e.actor.fullName}` : null, e.note].filter(Boolean).join(' — ') || undefined,
    at: e.createdAt,
  };
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
  // Nhật ký sự kiện của nhiệm vụ đang xem (null = chưa tải/lỗi → dùng các mốc thời gian có sẵn làm dự phòng).
  const [historyEvents, setHistoryEvents] = useState<AssignmentEvent[] | null>(null);
  // Phase 11 Đợt 2 — báo vấn đề / xin hỗ trợ (null = đóng modal).
  const [issueTarget, setIssueTarget] = useState<SurveyAssignment | null>(null);
  const [issueKind, setIssueKind] = useState<AssignmentIssueKind>('ISSUE');
  const [issueNote, setIssueNote] = useState('');
  const [sendingIssue, setSendingIssue] = useState(false);
  // Phase 11 Đợt 2b — danh sách nhà bị yêu cầu khảo sát lại của 1 nhiệm vụ (null = đóng modal).
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [revisitTarget, setRevisitTarget] = useState<SurveyAssignment | null>(null);
  const [revisitHouses, setRevisitHouses] = useState<AssignmentHouse[] | null>(null);

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

  async function openHistory(assignment: SurveyAssignment) {
    setHistoryTarget(assignment);
    setHistoryEvents(null);
    try {
      const detail = await getAssignment(assignment.id);
      setHistoryEvents(detail.events ?? null);
    } catch {
      // Offline/lỗi mạng: giữ dòng thời gian dựng từ các mốc thời gian có sẵn.
    }
  }

  async function openRevisit(assignment: SurveyAssignment) {
    // Nhiệm vụ còn NEEDS_REVISIT: phải bấm "Bắt đầu khảo sát lại" (chuyển IN_PROGRESS) thì server mới cho sửa nhà.
    if (assignment.status === AssignmentStatus.NEEDS_REVISIT) {
      Alert.alert(
        'Khảo sát lại',
        'Hãy bấm "Bắt đầu khảo sát lại" trước, sau đó mới sửa được các nhà được yêu cầu.',
        [
          { text: 'Bắt đầu khảo sát lại', onPress: () => handleStart(assignment) },
          { text: 'Đóng', style: 'cancel' },
        ],
      );
      return;
    }
    setRevisitTarget(assignment);
    setRevisitHouses(null);
    try {
      setRevisitHouses(await fetchAssignmentHouses(assignment.id, true));
    } catch {
      setRevisitTarget(null);
      Alert.alert('Lỗi', 'Không tải được danh sách nhà (cần có mạng).');
    }
  }

  function handlePickRevisitHouse(house: AssignmentHouse) {
    setRevisitTarget(null);
    // Mở tab Khảo Sát ở chế độ sửa lại đúng nhà này (điền sẵn thông tin, cần có mạng).
    navigation.navigate('Survey', { resurveyHouseId: house.id });
  }

  function openIssue(assignment: SurveyAssignment) {
    setIssueTarget(assignment);
    setIssueKind('ISSUE');
    setIssueNote('');
  }

  async function handleSendIssue() {
    if (!issueTarget || !issueNote.trim()) return;
    setSendingIssue(true);
    try {
      await reportAssignmentIssue(issueTarget.id, issueKind, issueNote.trim());
      setIssueTarget(null);
      Alert.alert(
        'Đã gửi',
        issueKind === 'HELP' ? 'Yêu cầu hỗ trợ đã được gửi tới người giao việc.' : 'Báo cáo vấn đề đã được gửi tới người giao việc.',
      );
    } catch (e) {
      Alert.alert('Lỗi', e instanceof ApiError ? e.message : 'Không gửi được (kiểm tra kết nối mạng).');
    } finally {
      setSendingIssue(false);
    }
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

  const timelineEntries: TimelineEntry[] = historyTarget
    ? historyEvents
      ? historyEvents.map(eventToEntry)
      : buildTimeline(historyTarget)
    : [];

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
                    {item._count?.houses ?? 0}{item.targetCount ? ` / ${item.targetCount}` : ''} nhà đã khảo sát
                    {item.dueDate ? ` • Hạn ${new Date(item.dueDate).toLocaleDateString('vi-VN')}` : ''}
                  </Text>
                  {item.targetCount ? (
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(100, assignmentProgressPercent(item) ?? 0)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>{assignmentProgressPercent(item)}%</Text>
                    </View>
                  ) : null}
                  {(item.revisitPending ?? 0) > 0 &&
                    (item.status === AssignmentStatus.IN_PROGRESS || item.status === AssignmentStatus.NEEDS_REVISIT) && (
                      <TouchableOpacity style={styles.revisitBtn} onPress={() => openRevisit(item)}>
                        <Icon name="alert-circle-outline" size={14} color="#b91c1c" />
                        <Text style={styles.revisitBtnText}>Khảo sát lại ({item.revisitPending} nhà)</Text>
                      </TouchableOpacity>
                    )}
                  <View style={[styles.badge, { backgroundColor: color.bg }]}>
                    <Text style={[styles.badgeText, { color: color.text }]}>
                      {ASSIGNMENT_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>
                {busyId === item.id ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <View style={styles.sideButtons}>
                    <TouchableOpacity
                      style={styles.historyBtn}
                      onPress={() => openHistory(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Xem nhật ký"
                    >
                      <Icon name="history" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    {item.status !== AssignmentStatus.COMPLETED && (
                      <TouchableOpacity
                        style={styles.historyBtn}
                        onPress={() => openIssue(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Báo vấn đề hoặc cần hỗ trợ"
                      >
                        <Icon name="flag-outline" size={20} color="#dc2626" />
                      </TouchableOpacity>
                    )}
                  </View>
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
              timelineEntries.map((entry, i, arr) => (
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
      {/* Phase 11 Đợt 2b — các nhà bị yêu cầu khảo sát lại: chọn 1 nhà để sửa đúng nhà đó. */}
      <Modal
        visible={revisitTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRevisitTarget(null)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyTitle}>Nhà cần khảo sát lại</Text>
                <Text style={styles.historySubtitle}>{revisitTarget?.zone.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setRevisitTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            {revisitHouses === null ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <FlatList
                style={styles.houseList}
                data={revisitHouses}
                keyExtractor={(h) => h.id}
                ListEmptyComponent={<Text style={styles.empty}>Không còn nhà nào cần sửa.</Text>}
                renderItem={({ item: h }) => (
                  <TouchableOpacity style={styles.houseRow} onPress={() => handlePickRevisitHouse(h)}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.houseRowTitle}>
                        Số {h.houseNumber} {h.street}
                      </Text>
                      <Text style={styles.houseRowOwner}>{h.ownerName}</Text>
                      {!!h.revisitReason && <Text style={styles.houseRowReason}>Lý do: {h.revisitReason}</Text>}
                    </View>
                    <Icon name="chevron-right" size={22} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Phase 11 Đợt 2 — báo vấn đề / xin hỗ trợ tới người giao việc (không đổi trạng thái nhiệm vụ). */}
      <Modal
        visible={issueTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIssueTarget(null)}
      >
        <View style={styles.historyOverlay}>
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyTitle}>{issueTarget?.zone.name}</Text>
                <Text style={styles.historySubtitle}>Gửi tới người giao việc</Text>
              </View>
              <TouchableOpacity onPress={() => setIssueTarget(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.kindRow}>
              {(['ISSUE', 'HELP'] as AssignmentIssueKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindBtn, issueKind === k && styles.kindBtnActive]}
                  onPress={() => setIssueKind(k)}
                >
                  <Text style={[styles.kindText, issueKind === k && styles.kindTextActive]}>
                    {k === 'ISSUE' ? 'Báo vấn đề' : 'Cần hỗ trợ'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.issueInput}
              value={issueNote}
              onChangeText={setIssueNote}
              placeholder={issueKind === 'ISSUE' ? 'Mô tả vấn đề gặp phải tại hiện trường...' : 'Bạn cần hỗ trợ điều gì?'}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!issueNote.trim() || sendingIssue) && styles.sendBtnDisabled]}
              onPress={handleSendIssue}
              disabled={!issueNote.trim() || sendingIssue}
            >
              {sendingIssue ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Gửi</Text>}
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
  revisitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  revisitBtnText: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
  houseList: { maxHeight: 360 },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  houseRowTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  houseRowOwner: { fontSize: 12, color: '#475569', marginTop: 1 },
  houseRowReason: { fontSize: 11, color: '#b91c1c', marginTop: 2 },
  sideButtons: { alignItems: 'center', gap: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  progressTrack: { height: 6, width: 90, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#2563eb' },
  progressText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kindBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  kindBtnActive: { backgroundColor: '#fef2f2', borderColor: '#dc2626' },
  kindText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  kindTextActive: { color: '#b91c1c' },
  issueInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: { marginTop: 12, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
