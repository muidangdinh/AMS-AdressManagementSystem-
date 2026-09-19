import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MainTabsParamList } from '../navigation/MainTabs';
import type {
  DashboardMine,
  DashboardSummary,
  HouseCase,
  HousePlate,
  HouseSummary,
  PaginatedResult,
  SurveyAssignment,
  SurveyCampaign,
} from '@tayninh/shared';
import {
  ASSIGNMENT_STATUS_LABELS,
  AssignmentStatus,
  CAMPAIGN_STATUS_LABELS,
  CampaignStatus,
  CASE_STATUS_LABELS,
  CaseStatus,
  HOUSE_STATUS_LABELS,
  HouseStatus,
  HOUSE_REVIEW_STAGE_LABELS,
  HouseReviewStage,
  PLATE_STATUS_LABELS,
  PlateStatus,
} from '@tayninh/shared';
import { apiFetch } from '../lib/api';
import { fetchAppConfig } from '../lib/appConfig';
import { fetchMyDashboard, fetchSystemDashboard } from '../lib/dashboardApi';
import { getDrafts, syncAllPending, SurveyDraft } from '../lib/surveyStore';
import { useAuth } from '../lib/AuthContext';
import { useWorkingWard } from '../lib/workingWard';
import WardSelectorBar from '../components/WardSelectorBar';

const TOP_LIST_LIMIT = 5;
const MODAL_ROW_LIMIT = 15;

const NEUTRAL_BADGE = { bg: '#f1f5f9', text: '#475569' };
const WARN_BADGE = { bg: '#fef3c7', text: '#92400e' };
const OK_BADGE = { bg: '#d1fae5', text: '#065f46' };
const BAD_BADGE = { bg: '#fee2e2', text: '#991b1b' };

const HOUSE_STATUS_BADGE: Record<HouseStatus, { bg: string; text: string }> = {
  APPROVED: OK_BADGE,
  PENDING: WARN_BADGE,
  NEEDS_ADJUST: BAD_BADGE,
} as Record<HouseStatus, { bg: string; text: string }>;
const PLATE_STATUS_BADGE: Record<PlateStatus, { bg: string; text: string }> = {
  [PlateStatus.ISSUED]: WARN_BADGE,
  [PlateStatus.INSTALLED]: OK_BADGE,
  [PlateStatus.REVOKED]: NEUTRAL_BADGE,
};
const CASE_STATUS_BADGE: Record<CaseStatus, { bg: string; text: string }> = {
  [CaseStatus.RECEIVED]: NEUTRAL_BADGE,
  [CaseStatus.ASSIGNED]: WARN_BADGE,
  [CaseStatus.REVIEWING]: WARN_BADGE,
  [CaseStatus.SURVEYING]: WARN_BADGE,
  [CaseStatus.NUMBERING]: WARN_BADGE,
  [CaseStatus.APPROVED]: WARN_BADGE,
  [CaseStatus.PLATE_ISSUED]: WARN_BADGE,
  [CaseStatus.COMPLETED]: OK_BADGE,
  [CaseStatus.REJECTED]: BAD_BADGE,
};
const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, { bg: string; text: string }> = {
  [CampaignStatus.DRAFT]: NEUTRAL_BADGE,
  [CampaignStatus.ACTIVE]: WARN_BADGE,
  [CampaignStatus.COMPLETED]: OK_BADGE,
};
const ASSIGNMENT_STATUS_BADGE: Record<AssignmentStatus, { bg: string; text: string }> = {
  [AssignmentStatus.ASSIGNED]: NEUTRAL_BADGE,
  [AssignmentStatus.IN_PROGRESS]: WARN_BADGE,
  [AssignmentStatus.SUBMITTED]: WARN_BADGE,
  [AssignmentStatus.COMPLETED]: OK_BADGE,
  [AssignmentStatus.NEEDS_REVISIT]: BAD_BADGE,
};
/** 1 dòng hiển thị trong modal xem nhanh — đủ chung để dùng cho mọi loại dữ liệu. */
interface ModalRow {
  key: string;
  primary: string;
  secondary?: string;
  badge?: { text: string; bg: string; color: string };
  /** Có toạ độ — cho phép bấm để bay tới vị trí đó ở tab Bản Đồ. */
  location?: { id: string; lat: number; lng: number };
}

type CardColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

const CARD_COLOR: Record<CardColor, string> = {
  blue: '#2563eb',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#64748b',
};

function StatCard({
  icon,
  label,
  value,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  value: number;
  color: CardColor;
  /** Bấm vào ô để mở modal xem nhanh danh sách bản ghi khớp — bỏ trống nếu không có gì để xem. */
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.cardIcon, { backgroundColor: `${CARD_COLOR[color]}1a` }]}>
        <Icon name={icon} size={20} color={CARD_COLOR[color]} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </Wrapper>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/**
 * TN-23 — góp ý khách hàng 11/09/2026: "cải thiện bố cục nên đồ hoạ màu...
 * hiện chỉ hiển thị thông tin rất đơn điệu". Thanh tiến độ trực quan cho các
 * khối có % (biển số, khảo sát) thay vì chỉ hiện số trong tiêu đề.
 */
function ProgressBar({ pct, color = '#2563eb' }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

function RankedRow({
  label,
  sub,
  value,
  danger,
  onPress,
}: {
  label: string;
  sub?: string;
  value: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.rankedRow} onPress={onPress} activeOpacity={0.6}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rankedLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub && (
          <Text style={styles.rankedSub} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
      <Text style={[styles.rankedValue, danger && styles.rankedValueDanger]}>{value}</Text>
    </Wrapper>
  );
}

function RankedCard({
  items,
  emptyText,
}: {
  items: { label: string; sub?: string; value: string; danger?: boolean; onPress?: () => void }[];
  emptyText: string;
}) {
  return (
    <View style={styles.rankedCard}>
      {items.length === 0 ? (
        <Text style={styles.rankedEmpty}>{emptyText}</Text>
      ) : (
        items.map((it, i) => <RankedRow key={`${it.label}-${i}`} {...it} />)
      )}
    </View>
  );
}

/**
 * Modal xem nhanh — bấm vào 1 ô số liệu/1 dòng xếp hạng trên Dashboard sẽ mở modal này,
 * liệt kê tối đa `MODAL_ROW_LIMIT` bản ghi khớp, không rời khỏi tab Tổng Quan.
 */
function DetailModal({
  visible,
  title,
  subtitle,
  loading,
  error,
  rows,
  totalCount,
  onClose,
  onRowPress,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  rows: ModalRow[];
  totalCount: number | null;
  onClose: () => void;
  /** Bấm vào 1 dòng có toạ độ — bay tới vị trí đó ở tab Bản Đồ. */
  onRowPress?: (location: { id: string; lat: number; lng: number }) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {title}
              </Text>
              {subtitle && <Text style={styles.modalSubtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {loading && <ActivityIndicator color="#2563eb" style={{ marginVertical: 28 }} />}
            {!loading && error && <Text style={styles.modalMessage}>{error}</Text>}
            {!loading && !error && rows.length === 0 && (
              <Text style={styles.modalMessage}>Không có bản ghi nào khớp</Text>
            )}
            {!loading &&
              !error &&
              rows.map((r) => {
                const location = r.location;
                const RowWrapper = location && onRowPress ? TouchableOpacity : View;
                return (
                  <RowWrapper
                    key={r.key}
                    style={styles.modalRow}
                    activeOpacity={0.6}
                    onPress={location && onRowPress ? () => onRowPress(location) : undefined}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalRowPrimary} numberOfLines={1}>
                        {r.primary}
                      </Text>
                      {r.secondary && (
                        <Text style={styles.modalRowSecondary} numberOfLines={1}>
                          {r.secondary}
                        </Text>
                      )}
                    </View>
                    {r.badge && (
                      <View style={[styles.modalBadge, { backgroundColor: r.badge.bg }]}>
                        <Text style={[styles.modalBadgeText, { color: r.badge.color }]}>
                          {r.badge.text}
                        </Text>
                      </View>
                    )}
                  </RowWrapper>
                );
              })}
          </ScrollView>

          {!loading && !error && totalCount !== null && totalCount > rows.length && (
            <Text style={styles.modalFooterNote}>
              Hiển thị {rows.length}/{totalCount} bản ghi
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Tab đầu tiên khi mở app. Gồm 2 phần: báo cáo nhanh cá nhân (mobile nhóm
 * 10.1-10.8, `GET /api/dashboard/mine` + bản nháp cục bộ chưa đồng bộ từ
 * `surveyStore`) và báo cáo toàn hệ thống (`GET /api/dashboard/summary`,
 * cùng dữ liệu với dashboard web) — người dùng mobile (kể cả ADMIN/CADASTRAL
 * xem nhanh trên điện thoại) cũng cần thấy được 10.1-10.12 như trên web.
 */
export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const [data, setData] = useState<DashboardMine | null>(null);
  const [system, setSystem] = useState<DashboardSummary | null>(null);
  const [drafts, setDrafts] = useState<SurveyDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // TN-03/TN-10 — "xã đang làm việc" quyết định tiêu đề khối quản lý nhà
  // (TN-14) và báo cáo byHamlet/byStreet của riêng xã đó thay cho byWard
  // gộp toàn tỉnh (TN-17/TN-18).
  const { ward: workingWard } = useWorkingWard();
  // TN-13 — tên tỉnh cho lời chào ("... xã X, Tỉnh Tây Ninh"). Không đổi
  // trong phiên làm việc nên chỉ cần tải 1 lần, dùng giá trị dự phòng khi
  // chưa tải xong/mất mạng — không chặn hiển thị Dashboard.
  const [provinceName, setProvinceName] = useState('Tỉnh Tây Ninh');

  const load = useCallback(async () => {
    try {
      const [summary, systemSummary, localDrafts] = await Promise.all([
        fetchMyDashboard(),
        fetchSystemDashboard(workingWard?.id),
        getDrafts(),
      ]);
      setData(summary);
      setSystem(systemSummary);
      setDrafts(localDrafts);
    } catch {
      Alert.alert('Lỗi', 'Không tải được số liệu tổng quan (kiểm tra kết nối mạng).');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workingWard?.id]);

  useEffect(() => {
    fetchAppConfig()
      .then((cfg) => setProvinceName(cfg.provinceName))
      .catch(() => {});
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

  const pendingCount = drafts.filter((d) => d.status !== 'synced').length;

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

  // Modal xem nhanh — bấm 1 ô số liệu/1 dòng xếp hạng để xem danh sách bản ghi khớp,
  // không rời khỏi tab Tổng Quan (xem DetailModal ở trên).
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalSubtitle, setModalSubtitle] = useState<string | undefined>(undefined);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalRows, setModalRows] = useState<ModalRow[]>([]);
  const [modalTotal, setModalTotal] = useState<number | null>(null);

  function closeModal() {
    setModalTitle(null);
  }

  /** Bấm vào 1 dòng trong modal xem nhanh — đóng modal rồi bay tới vị trí đó ở tab Bản Đồ. */
  function focusOnMap(location: { id: string; lat: number; lng: number }) {
    closeModal();
    navigation.navigate('Map', { focusId: location.id, lat: location.lat, lng: location.lng });
  }

  async function openModal(
    title: string,
    subtitle: string | undefined,
    fetchRows: () => Promise<{ rows: ModalRow[]; total: number | null }>,
  ) {
    setModalTitle(title);
    setModalSubtitle(subtitle);
    setModalLoading(true);
    setModalError(null);
    setModalRows([]);
    setModalTotal(null);
    try {
      const { rows, total } = await fetchRows();
      setModalRows(rows.slice(0, MODAL_ROW_LIMIT));
      setModalTotal(total);
    } catch {
      setModalError('Không tải được danh sách (kiểm tra kết nối mạng)');
    } finally {
      setModalLoading(false);
    }
  }

  function houseRow(h: HouseSummary): ModalRow {
    const badge = HOUSE_STATUS_BADGE[h.status];
    return {
      key: h.id,
      primary: `${h.houseNumber} ${h.street}`,
      secondary: `${h.ward} • ${h.ownerName}`,
      badge: { text: HOUSE_STATUS_LABELS[h.status], bg: badge.bg, color: badge.text },
      location: { id: h.id, lat: h.latitude, lng: h.longitude },
    };
  }

  function openHouses(
    title: string,
    subtitle: string | undefined,
    params: {
      status?: HouseStatus;
      reviewStage?: HouseReviewStage;
      createdById?: string;
      ward?: string;
      street?: string;
      search?: string;
      /** TN-17/TN-18 — lọc theo danh mục chuẩn hoá (khác `ward`/`street` dạng chữ ở trên). */
      wardId?: string;
      hamletId?: string;
      streetId?: string;
    },
  ) {
    openModal(title, subtitle, async () => {
      const qs = new URLSearchParams({ pageSize: String(MODAL_ROW_LIMIT) });
      if (params.status) qs.set('status', params.status);
      if (params.reviewStage) qs.set('reviewStage', params.reviewStage);
      if (params.createdById) qs.set('createdById', params.createdById);
      if (params.ward) qs.set('ward', params.ward);
      if (params.street) qs.set('street', params.street);
      if (params.search) qs.set('search', params.search);
      if (params.wardId) qs.set('wardId', params.wardId);
      if (params.hamletId) qs.set('hamletId', params.hamletId);
      if (params.streetId) qs.set('streetId', params.streetId);
      const res = await apiFetch<PaginatedResult<HouseSummary>>(`/api/houses?${qs.toString()}`);
      return { rows: res.items.map(houseRow), total: res.total };
    });
  }

  function plateRow(p: HousePlate): ModalRow {
    const badge = PLATE_STATUS_BADGE[p.status];
    return {
      key: p.id,
      primary: `${p.plateCode} — ${p.house.houseNumber} ${p.house.street}`,
      secondary: p.house.ward,
      badge: { text: PLATE_STATUS_LABELS[p.status], bg: badge.bg, color: badge.text },
      location: { id: p.house.id, lat: p.house.latitude, lng: p.house.longitude },
    };
  }

  function openPlates(title: string, subtitle: string | undefined, status?: PlateStatus) {
    openModal(title, subtitle, async () => {
      const res = await apiFetch<HousePlate[]>(`/api/house-plates${status ? `?status=${status}` : ''}`);
      return { rows: res.map(plateRow), total: res.length };
    });
  }

  function caseRow(c: HouseCase): ModalRow {
    const badge = CASE_STATUS_BADGE[c.status];
    return {
      key: c.id,
      primary: `${c.caseNumber} — ${c.applicantName}`,
      secondary: c.description ?? undefined,
      badge: { text: CASE_STATUS_LABELS[c.status], bg: badge.bg, color: badge.text },
    };
  }

  /** Hồ sơ "đang xử lý" gộp nhiều trạng thái (mọi trạng thái trừ hoàn tất/từ chối) — lọc client-side. */
  function openCases(title: string, subtitle: string | undefined, status?: CaseStatus | 'OPEN') {
    openModal(title, subtitle, async () => {
      const res = await apiFetch<HouseCase[]>(
        `/api/house-cases${status && status !== 'OPEN' ? `?status=${status}` : ''}`,
      );
      const filtered =
        status === 'OPEN'
          ? res.filter((c) => c.status !== CaseStatus.COMPLETED && c.status !== CaseStatus.REJECTED)
          : res;
      return { rows: filtered.map(caseRow), total: filtered.length };
    });
  }

  function campaignRow(c: SurveyCampaign): ModalRow {
    const badge = CAMPAIGN_STATUS_BADGE[c.status];
    return {
      key: c.id,
      primary: c.name,
      secondary: `${c._count?.zones ?? 0} phân vùng`,
      badge: { text: CAMPAIGN_STATUS_LABELS[c.status], bg: badge.bg, color: badge.text },
    };
  }

  function openCampaigns(title: string, subtitle: string | undefined, status?: CampaignStatus) {
    openModal(title, subtitle, async () => {
      const res = await apiFetch<SurveyCampaign[]>(
        `/api/survey-campaigns${status ? `?status=${status}` : ''}`,
      );
      return { rows: res.map(campaignRow), total: res.length };
    });
  }

  function assignmentRow(a: SurveyAssignment): ModalRow {
    const badge = ASSIGNMENT_STATUS_BADGE[a.status];
    return {
      key: a.id,
      primary: `${a.zone.name} — ${a.assignee.fullName}`,
      secondary: a.zone.ward?.name ?? undefined,
      badge: { text: ASSIGNMENT_STATUS_LABELS[a.status], bg: badge.bg, color: badge.text },
    };
  }

  /** Cho phép gộp nhiều trạng thái (vd "Đang khảo sát" = ASSIGNED + IN_PROGRESS) và lọc "của tôi". */
  function openAssignments(
    title: string,
    subtitle: string | undefined,
    statuses: AssignmentStatus[],
    mine?: boolean,
  ) {
    openModal(title, subtitle, async () => {
      const results = await Promise.all(
        statuses.map((s) =>
          apiFetch<SurveyAssignment[]>(
            `/api/survey-assignments?status=${s}${mine ? '&mine=true' : ''}`,
          ),
        ),
      );
      const all = results.flat();
      return { rows: all.map(assignmentRow), total: all.length };
    });
  }


  if (loading) {
    return <ActivityIndicator style={styles.loading} color="#2563eb" />;
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <WardSelectorBar />

      <View style={styles.header}>
        <Text style={styles.headerGreeting}>Xin chào, {user?.fullName ?? ''}</Text>
        {/* TN-13 — chức vụ + đơn vị + xã đang làm việc (góp ý khách hàng 11/09/2026). Bỏ qua
            đoạn nào không có dữ liệu (chức vụ/đơn vị tài khoản cũ, hoặc chưa chọn xã) — không
            để lòi dấu phẩy/dấu gạch thừa. */}
        <Text style={styles.headerSub}>
          {[
            [user?.position, user?.unit].filter(Boolean).join(' — '),
            workingWard ? `Xã ${workingWard.name}, ${provinceName}` : provinceName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {data && system && (
        <>
          <SectionTitle>
            {workingWard ? `Thông Tin Quản Lý Nhà Xã ${workingWard.name}` : 'Thông Tin Quản Lý Nhà — Toàn Tỉnh'}
          </SectionTitle>
          <View style={styles.grid}>
            <StatCard
              icon="home-group"
              label="Tổng số nhà/hộ"
              value={data.myHouses.total}
              color="blue"
              onPress={() => openHouses('Nhà tôi đã khảo sát', undefined, { createdById: user?.id })}
            />
            <StatCard
              icon="check-circle-outline"
              label="Nhà đã cấp số"
              value={data.myHouses.withNumber}
              color="emerald"
              onPress={() =>
                openHouses('Nhà tôi khảo sát — đã có số', undefined, {
                  createdById: user?.id,
                  status: HouseStatus.APPROVED,
                })
              }
            />
            <StatCard
              icon="clock-outline"
              label="Nhà chưa cấp/chờ duyệt số"
              value={data.myHouses.withoutNumber}
              color="amber"
              onPress={() =>
                openHouses('Nhà tôi khảo sát — chưa có số', undefined, {
                  createdById: user?.id,
                  status: HouseStatus.PENDING,
                })
              }
            />
            <StatCard
              icon="alert-outline"
              label="Số nhà cần hiệu chỉnh"
              value={data.myHouses.needsAdjust}
              color="rose"
              onPress={() =>
                openHouses('Nhà tôi khảo sát — cần hiệu chỉnh', undefined, {
                  createdById: user?.id,
                  status: HouseStatus.NEEDS_ADJUST,
                })
              }
            />
          </View>

          {system.reviewStages && (
            <>
              <SectionTitle>Phân loại số nhà</SectionTitle>
              <RankedCard
                emptyText="Chưa có dữ liệu"
                items={Object.values(HouseReviewStage).map((stage) => {
                  // Optional chaining — backend cũ (chưa deploy field reviewStages) vẫn
                  // không được crash cả màn hình Dashboard vì 1 khối thống kê phụ.
                  const stat = system.reviewStages?.byStage?.[stage] ?? { count: 0, pct: 0 };
                  return {
                    label: HOUSE_REVIEW_STAGE_LABELS[stage],
                    value: `${stat.count} (${stat.pct}%)`,
                    danger: stage === HouseReviewStage.REJECTED && stat.count > 0,
                    onPress: () =>
                      openHouses(`Số nhà — ${HOUSE_REVIEW_STAGE_LABELS[stage]}`, undefined, { reviewStage: stage }),
                  };
                })}
              />
            </>
          )}

          {/* TN-17 — góp ý khách hàng 11/09/2026: đang xem 1 xã thì liệt kê đủ ẤP của xã đó
              (system.byHamlet, TN-10); đang xem Toàn tỉnh thì liệt kê đủ XÃ/PHƯỜNG (system.byWard)
              thay cho `topWards` cũ (chỉ top 5) — mỗi dòng 2 chỉ số: đã cấp số / chưa-chờ cấp số. */}
          <SectionTitle>{workingWard ? 'Theo ấp' : 'Theo xã/phường'}</SectionTitle>
          <RankedCard
            emptyText="Chưa có dữ liệu"
            items={(workingWard ? system.byHamlet ?? [] : system.byWard ?? []).map((item) => ({
              label: item.id ? item.name : `${item.name} (chưa gán ${workingWard ? 'ấp' : 'xã'})`,
              value: `${item.approved} đã cấp · ${item.withoutNumber} chưa cấp`,
              danger: item.id === null,
              onPress: item.id
                ? () =>
                    openHouses(
                      workingWard ? `Nhà ở ấp ${item.name}` : `Nhà ở xã ${item.name}`,
                      undefined,
                      workingWard ? { hamletId: item.id! } : { wardId: item.id! },
                    )
                : undefined,
            }))}
          />

          {/* TN-18 — đang xem 1 xã thì liệt kê đủ ĐƯỜNG của xã đó (system.byStreet, TN-10); đang
              xem Toàn tỉnh thì giữ nguyên top 5 tuyến đường nhiều nhà nhất như trước (topStreets). */}
          <SectionTitle>Theo tuyến đường</SectionTitle>
          <RankedCard
            emptyText="Chưa có dữ liệu"
            items={
              workingWard
                ? (system.byStreet ?? []).map((item) => ({
                    label: item.id ? item.name : `${item.name} (chưa gán đường)`,
                    value: `${item.approved} đã cấp · ${item.withoutNumber} chưa cấp`,
                    danger: item.id === null,
                    onPress: item.id
                      ? () => openHouses(`Nhà ở đường ${item.name}`, undefined, { streetId: item.id! })
                      : undefined,
                  }))
                : system.topStreets.slice(0, TOP_LIST_LIMIT).map((s) => ({
                    label: s.street,
                    value: `${s.houseCount} nhà`,
                    onPress: () => openHouses(`Nhà ở đường ${s.street}`, undefined, { street: s.street }),
                  }))
            }
          />

          <SectionTitle>Nhiệm vụ khảo sát</SectionTitle>
          <View style={styles.grid}>
            <StatCard
              icon="clipboard-list-outline"
              label="Đang thực hiện"
              value={data.myAssignments.active}
              color="blue"
              onPress={() =>
                openAssignments(
                  'Nhiệm vụ tôi đang thực hiện',
                  undefined,
                  [AssignmentStatus.ASSIGNED, AssignmentStatus.IN_PROGRESS],
                  true,
                )
              }
            />
            <StatCard
              icon="send-outline"
              label="Chờ duyệt"
              value={data.myAssignments.submitted}
              color="slate"
              onPress={() =>
                openAssignments('Nhiệm vụ của tôi — chờ duyệt', undefined, [AssignmentStatus.SUBMITTED], true)
              }
            />
            <StatCard
              icon="check-circle-outline"
              label="Đã hoàn tất"
              value={data.myAssignments.completed}
              color="emerald"
              onPress={() =>
                openAssignments('Nhiệm vụ của tôi — đã hoàn tất', undefined, [AssignmentStatus.COMPLETED], true)
              }
            />
            <StatCard
              icon="refresh"
              label="Cần khảo sát lại"
              value={data.myAssignments.needsRevisit}
              color="rose"
              onPress={() =>
                openAssignments(
                  'Nhiệm vụ của tôi — cần khảo sát lại',
                  undefined,
                  [AssignmentStatus.NEEDS_REVISIT],
                  true,
                )
              }
            />
          </View>

          <SectionTitle>Số nhà trùng</SectionTitle>
          <RankedCard
            emptyText="Không phát hiện số nhà trùng"
            items={system.duplicates.groups.slice(0, TOP_LIST_LIMIT).map((d) => ({
              label: `${d.houseNumber} — ${d.street}`,
              sub: d.ward,
              value: `${d.count} nhà`,
              danger: true,
              onPress: () =>
                openHouses(`Số nhà trùng: ${d.houseNumber} — ${d.street}`, d.ward, {
                  street: d.street,
                  search: d.houseNumber,
                }),
            }))}
          />
          {system.duplicates.totalGroups > TOP_LIST_LIMIT && (
            <Text style={styles.moreNote}>
              + {system.duplicates.totalGroups - TOP_LIST_LIMIT} nhóm trùng khác — xem đầy đủ trên web
            </Text>
          )}

          <SectionTitle>{`Biển số nhà — tiến độ gắn biển ${system.plates.installedPct}%`}</SectionTitle>
          <View style={styles.progressWrap}>
            <ProgressBar pct={system.plates.installedPct} color="#059669" />
          </View>
          <View style={styles.grid}>
            <StatCard
              icon="card-multiple-outline"
              label="Đã cấp (tổng)"
              value={system.plates.total}
              color="blue"
              onPress={() => openPlates('Biển số nhà đã cấp (tổng)', undefined)}
            />
            <StatCard
              icon="check-decagram-outline"
              label="Đã gắn"
              value={system.plates.installed}
              color="emerald"
              onPress={() => openPlates('Biển số nhà đã gắn', undefined, PlateStatus.INSTALLED)}
            />
            <StatCard
              icon="tag-outline"
              label="Chưa gắn"
              value={system.plates.issued}
              color="amber"
              onPress={() => openPlates('Biển số nhà chưa gắn', undefined, PlateStatus.ISSUED)}
            />
            <StatCard
              icon="undo-variant"
              label="Đã thu hồi"
              value={system.plates.revoked}
              color="slate"
              onPress={() => openPlates('Biển số nhà đã thu hồi', undefined, PlateStatus.REVOKED)}
            />
          </View>

          <SectionTitle>{`Tiến độ khảo sát — ${system.surveys.completedPct}% hoàn tất`}</SectionTitle>
          <View style={styles.progressWrap}>
            <ProgressBar pct={system.surveys.completedPct} color="#2563eb" />
          </View>
          <View style={styles.grid}>
            <StatCard
              icon="flag-outline"
              label="Đợt đang triển khai"
              value={system.surveys.campaignsActive}
              color="blue"
              onPress={() => openCampaigns('Đợt khảo sát đang triển khai', undefined, CampaignStatus.ACTIVE)}
            />
            <StatCard
              icon="compass-outline"
              label="Đang khảo sát"
              value={system.surveys.assignments.assigned + system.surveys.assignments.inProgress}
              color="amber"
              onPress={() =>
                openAssignments('Nhiệm vụ đang khảo sát', undefined, [
                  AssignmentStatus.ASSIGNED,
                  AssignmentStatus.IN_PROGRESS,
                ])
              }
            />
            <StatCard
              icon="check-circle-outline"
              label="Đã hoàn tất"
              value={system.surveys.assignments.completed}
              color="emerald"
              onPress={() =>
                openAssignments('Nhiệm vụ đã hoàn tất', undefined, [AssignmentStatus.COMPLETED])
              }
            />
            <StatCard
              icon="refresh"
              label="Cần khảo sát lại"
              value={system.surveys.assignments.needsRevisit}
              color="rose"
              onPress={() =>
                openAssignments('Nhiệm vụ cần khảo sát lại', undefined, [AssignmentStatus.NEEDS_REVISIT])
              }
            />
          </View>

          <SectionTitle>Hồ sơ – quy trình</SectionTitle>
          <View style={styles.grid}>
            <StatCard
              icon="file-document-outline"
              label="Tổng hồ sơ"
              value={system.cases.total}
              color="blue"
              onPress={() => openCases('Tổng hồ sơ', undefined)}
            />
            <StatCard
              icon="progress-clock"
              label="Đang xử lý"
              value={system.cases.open}
              color="amber"
              onPress={() => openCases('Hồ sơ đang xử lý', undefined, 'OPEN')}
            />
            <StatCard
              icon="check-circle-outline"
              label="Đã hoàn tất"
              value={system.cases.completed}
              color="emerald"
              onPress={() => openCases('Hồ sơ đã hoàn tất', undefined, CaseStatus.COMPLETED)}
            />
            <StatCard
              icon="close-circle-outline"
              label="Bị từ chối"
              value={system.cases.rejected}
              color="rose"
              onPress={() => openCases('Hồ sơ bị từ chối', undefined, CaseStatus.REJECTED)}
            />
          </View>
        </>
      )}
      <SectionTitle>Đồng bộ dữ liệu</SectionTitle>
      <View style={styles.syncCard}>
        <View style={styles.syncInfo}>
          <Icon name="cloud-upload-outline" size={22} color={pendingCount > 0 ? '#d97706' : '#059669'} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.syncValue}>
              {pendingCount > 0 ? `${pendingCount} hồ sơ chờ đồng bộ` : 'Đã đồng bộ hết'}
            </Text>
            <Text style={styles.syncSub}>Hồ sơ khảo sát lưu cục bộ trên máy</Text>
          </View>
        </View>
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.syncButton} onPress={handleSyncAll} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.syncButtonText}>Đồng bộ ngay</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>

    <DetailModal
      visible={modalTitle !== null}
      title={modalTitle ?? ''}
      subtitle={modalSubtitle}
      loading={modalLoading}
      error={modalError}
      rows={modalRows}
      totalCount={modalTotal}
      onClose={closeModal}
      onRowPress={focusOnMap}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, marginTop: 40 },
  header: { padding: 16, paddingBottom: 8 },
  headerGreeting: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  progressWrap: { paddingHorizontal: 16, marginBottom: 10 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cardValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  cardLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },
  rankedCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  rankedLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  rankedSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  rankedValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  rankedValueDanger: { color: '#e11d48' },
  rankedEmpty: { textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 16 },
  moreNote: { fontSize: 11, color: '#94a3b8', marginHorizontal: 16, marginTop: 4 },
  syncCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  syncInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  syncValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  syncSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  syncButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  syncButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  modalSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  modalBody: { flexGrow: 0 },
  modalMessage: { textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingVertical: 28 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalRowPrimary: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  modalRowSecondary: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  modalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modalBadgeText: { fontSize: 10, fontWeight: '700' },
  modalFooterNote: {
    fontSize: 11,
    color: '#94a3b8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
