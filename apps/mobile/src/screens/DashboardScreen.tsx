import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { MainTabsParamList } from '../navigation/MainTabs';
import type {
  ChartSlice,
  DashboardMine,
  DashboardSummary,
  Hamlet,
  HouseCase,
  HousePlate,
  HouseSummary,
  NumberingScheme,
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
  NUMBERING_SCHEME_STATUS_LABELS,
  NumberingSchemeStatus,
  PLATE_STATUS_LABELS,
  PlateStatus,
  // Dựng dữ liệu biểu đồ dùng chung với web (logic thuần; phần vẽ là react-native-svg bên dưới).
  buildCaseSlices,
  buildHouseStatusSlices,
  buildPlateSlices,
  buildReviewStageSlices,
  buildSchemeSlices,
  buildSurveySlices,
  CHART_COLORS,
  SLICE_KEY,
  toStackedBreakdown,
} from '@tayninh/shared';
import { BarList, ChartSection, Donut, Gauge, StackedBarList } from '../components/charts';
import { apiFetch } from '../lib/api';
import { fetchAppConfig } from '../lib/appConfig';
import { fetchHamlets } from '../lib/addressCatalog';
import { fetchMyDashboard, fetchSystemDashboard } from '../lib/dashboardApi';
import { getDrafts, syncAllPending, SurveyDraft } from '../lib/surveyStore';
import { useAuth } from '../lib/AuthContext';
import { useWorkingWard } from '../lib/workingWard';
import WardSelectorBar from '../components/WardSelectorBar';

const TOP_LIST_LIMIT = 5;
const MODAL_ROW_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_PAGE_SIZE = 20;

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
const SCHEME_STATUS_BADGE: Record<NumberingSchemeStatus, { bg: string; text: string }> = {
  [NumberingSchemeStatus.DRAFT]: NEUTRAL_BADGE,
  [NumberingSchemeStatus.SUBMITTED]: WARN_BADGE,
  [NumberingSchemeStatus.APPROVED]: OK_BADGE,
  [NumberingSchemeStatus.REJECTED]: BAD_BADGE,
};
/** Lát donut "Đợt khảo sát" (mục Báo cáo tiến độ khảo sát) — đếm ở app từ danh sách đợt (API tổng quan không trả). */
function buildCampaignSlices(c: Record<CampaignStatus, number>): ChartSlice[] {
  const color: Record<CampaignStatus, string> = {
    [CampaignStatus.DRAFT]: CHART_COLORS.slate,
    [CampaignStatus.ACTIVE]: CHART_COLORS.amber,
    [CampaignStatus.COMPLETED]: CHART_COLORS.green,
  };
  return Object.values(CampaignStatus).map((st) => ({
    key: st,
    name: CAMPAIGN_STATUS_LABELS[st],
    value: c[st],
    color: color[st],
  }));
}

/** 1 dòng hiển thị trong modal xem nhanh — đủ chung để dùng cho mọi loại dữ liệu. */
interface ModalRow {
  key: string;
  primary: string;
  secondary?: string;
  badge?: { text: string; bg: string; color: string };
  /** Có toạ độ — cho phép bấm để bay tới vị trí đó ở tab Bản Đồ. */
  location?: { id: string; lat: number; lng: number };
  /** Có màn hình tương ứng trên mobile — cho phép bấm để chuyển sang tab đó. */
  tab?: 'Assignments';
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
  onTabPress,
  webOnlyNote,
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
  /** Bấm vào 1 dòng có `tab` — chuyển sang tab tương ứng. */
  onTabPress?: (tab: 'Assignments') => void;
  /** Loại dữ liệu chỉ có màn hình chi tiết trên web (đợt, phương án, hồ sơ) — hiện ghi chú cuối popup. */
  webOnlyNote?: boolean;
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
                const { location, tab } = r;
                const onPress =
                  tab && onTabPress
                    ? () => onTabPress(tab)
                    : location && onRowPress
                    ? () => onRowPress(location)
                    : undefined;
                const RowWrapper = onPress ? TouchableOpacity : View;
                return (
                  <RowWrapper key={r.key} style={styles.modalRow} activeOpacity={0.6} onPress={onPress}>
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
                    {onPress && <Icon name="chevron-right" size={18} color="#cbd5e1" />}
                  </RowWrapper>
                );
              })}
          </ScrollView>

          {!loading && !error && totalCount !== null && totalCount > rows.length && (
            <Text style={styles.modalFooterNote}>
              Hiển thị {rows.length}/{totalCount} bản ghi
            </Text>
          )}
          {!loading && !error && webOnlyNote && rows.length > 0 && (
            <Text style={styles.modalFooterNote}>Xem chi tiết trên web.</Text>
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
  // Số đợt khảo sát theo trạng thái — API tổng quan chỉ trả số đợt đang triển khai, nên tự đếm từ
  // danh sách đợt (API có sẵn). null = không tải được → ẩn hàng đợt, không chặn Tổng Quan.
  const [campaignCounts, setCampaignCounts] = useState<Record<CampaignStatus, number> | null>(null);
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
      const [summary, systemSummary, localDrafts, campaignList] = await Promise.all([
        fetchMyDashboard(),
        fetchSystemDashboard(),
        getDrafts(),
        apiFetch<SurveyCampaign[]>('/api/survey-campaigns').catch(() => null),
      ]);
      if (campaignList) {
        const counts = Object.fromEntries(
          Object.values(CampaignStatus).map((st) => [st, 0]),
        ) as Record<CampaignStatus, number>;
        campaignList.forEach((c) => {
          counts[c.status] += 1;
        });
        setCampaignCounts(counts);
      } else {
        setCampaignCounts(null);
      }
      setData(summary);
      setSystem(systemSummary);
      setDrafts(localDrafts);
    } catch {
      Alert.alert('Lỗi', 'Không tải được số liệu tổng quan (kiểm tra kết nối mạng).');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
  const [modalWebOnly, setModalWebOnly] = useState(false);

  function closeModal() {
    setModalTitle(null);
  }

  /** Bấm vào 1 dòng có tab tương ứng — đóng modal rồi chuyển sang tab đó. */
  function goToTab(tab: 'Assignments') {
    closeModal();
    navigation.navigate(tab);
  }

  // Tìm kiếm nhanh (giống web): gõ tìm theo tên đường/chủ hộ/SĐT/CCCD + lọc theo ấp/thôn.
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [hamletId, setHamletId] = useState('');
  const [hamletPickerOpen, setHamletPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<HouseSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchHamlets()
      .then(setHamlets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim() && !hamletId) {
      searchAbortRef.current?.abort();
      setResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearching(true);
      setSearchError(null);
      try {
        const qs = new URLSearchParams({ pageSize: String(SEARCH_PAGE_SIZE) });
        if (search.trim()) qs.set('search', search.trim());
        if (hamletId) qs.set('hamletId', hamletId);
        const res = await apiFetch<PaginatedResult<HouseSummary>>(`/api/houses?${qs.toString()}`, {
          signal: controller.signal,
        });
        if (searchAbortRef.current === controller) setResults(res.items);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSearchError('Tìm kiếm thất bại (kiểm tra kết nối mạng)');
        setResults(null);
      } finally {
        if (searchAbortRef.current === controller) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, hamletId]);

  const selectedHamlet = hamlets.find((h) => h.id === hamletId);

  /** Bấm vào 1 dòng trong modal xem nhanh — đóng modal rồi bay tới vị trí đó ở tab Bản Đồ. */
  function focusOnMap(location: { id: string; lat: number; lng: number }) {
    closeModal();
    navigation.navigate('Map', { focusId: location.id, lat: location.lat, lng: location.lng });
  }

  async function openModal(
    title: string,
    subtitle: string | undefined,
    fetchRows: () => Promise<{ rows: ModalRow[]; total: number | null }>,
    webOnly = false,
  ) {
    setModalTitle(title);
    setModalSubtitle(subtitle);
    setModalWebOnly(webOnly);
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
    }, true);
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
    }, true);
  }

  function assignmentRow(a: SurveyAssignment): ModalRow {
    const badge = ASSIGNMENT_STATUS_BADGE[a.status];
    return {
      key: a.id,
      primary: `${a.zone.name} — ${a.assignee.fullName}`,
      secondary: a.zone.ward?.name ?? undefined,
      badge: { text: ASSIGNMENT_STATUS_LABELS[a.status], bg: badge.bg, color: badge.text },
      tab: 'Assignments',
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

  function schemeRow(s: NumberingScheme): ModalRow {
    const badge = SCHEME_STATUS_BADGE[s.status];
    return {
      key: s.id,
      primary: s.name,
      secondary: s.street?.name ?? undefined,
      badge: { text: NUMBERING_SCHEME_STATUS_LABELS[s.status], bg: badge.bg, color: badge.text },
    };
  }

  /** Phương án đánh số — giống web: cho phép gộp nhiều trạng thái (vd "Đang soạn / trình duyệt"). */
  function openSchemes(title: string, subtitle: string | undefined, statuses?: NumberingSchemeStatus[]) {
    openModal(title, subtitle, async () => {
      const results = await Promise.all(
        (statuses ?? [undefined]).map((s) =>
          apiFetch<NumberingScheme[]>(`/api/numbering-schemes${s ? `?status=${s}` : ''}`),
        ),
      );
      const all = results.flat();
      return { rows: all.map(schemeRow), total: all.length };
    }, true);
  }

  // ---- Dựng dữ liệu biểu đồ (logic dùng chung với web ở @tayninh/shared) ----
  // `byWard` trả ĐỦ danh mục xã/phường (kể cả xã 0 nhà) — cắt top 10 theo tổng số nhà, giống web.
  const topWardBreakdown = toStackedBreakdown(system?.byWard, 10);


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

      {/* Tìm kiếm nhanh — giống web: tên đường/chủ hộ/SĐT/CCCD + lọc ấp/thôn, bấm kết quả bay tới Bản Đồ. */}
      <View style={styles.searchCard}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tên đường, tên chủ hộ, SĐT, CCCD/CMND…"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.hamletButton} onPress={() => setHamletPickerOpen(true)}>
          <Text style={styles.hamletButtonText} numberOfLines={1}>
            {selectedHamlet ? selectedHamlet.name : 'Ấp/Thôn/Tổ dân phố: Tất cả'}
          </Text>
          <Icon name="chevron-down" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>
      {searchError && <Text style={styles.searchError}>{searchError}</Text>}
      {(searching || results !== null) && (
        <View style={styles.rankedCard}>
          {searching && <ActivityIndicator color="#2563eb" style={{ marginVertical: 16 }} />}
          {!searching && results !== null && results.length === 0 && (
            <Text style={styles.rankedEmpty}>Không tìm thấy hồ sơ nào khớp</Text>
          )}
          {!searching &&
            results?.map((h) => (
              <RankedRow
                key={h.id}
                label={`${h.houseNumber} ${h.street}`}
                sub={`${h.ward}${h.hamlet ? ` • ${h.hamlet.name}` : ''} • ${h.ownerName}${
                  h.ownerPhone ? ` • ${h.ownerPhone}` : ''
                }`}
                value={HOUSE_STATUS_LABELS[h.status]}
                onPress={() => focusOnMap({ id: h.id, lat: h.latitude, lng: h.longitude })}
              />
            ))}
        </View>
      )}

      {data && system && (
        <>
          {/* Các khối hệ thống bên dưới đồng bộ với dashboard web: mặc định chỉ hiện biểu đồ,
              chạm lát/thanh → mở danh sách; chạm nền (hoặc nút ▾) → bung khối số liệu cũ. */}
          <ChartSection
            title="Báo cáo số lượng nhà"
            subtitle="10.1 — tổng số nhà toàn tỉnh, theo trạng thái phê duyệt"
            details={
              <View style={styles.grid}>
                <StatCard
                  icon="home-group"
                  label="Tổng số nhà"
                  value={system.houses.total}
                  color="blue"
                  onPress={() => openHouses('Tổng số nhà', undefined, {})}
                />
                <StatCard
                  icon="check-circle-outline"
                  label="Đã có số / QR"
                  value={system.houses.approved}
                  color="emerald"
                  onPress={() => openHouses('Nhà đã có số / QR', undefined, { status: HouseStatus.APPROVED })}
                />
                <StatCard
                  icon="clock-outline"
                  label="Chưa có số"
                  value={system.houses.withoutNumber}
                  color="amber"
                  onPress={() =>
                    openHouses('Nhà chưa có số', 'Trạng thái Chờ duyệt', { status: HouseStatus.PENDING })
                  }
                />
                <StatCard
                  icon="alert-outline"
                  label="Cần điều chỉnh"
                  value={system.houses.needsAdjust}
                  color="rose"
                  onPress={() =>
                    openHouses('Nhà cần điều chỉnh', undefined, { status: HouseStatus.NEEDS_ADJUST })
                  }
                />
              </View>
            }
          >
            <Donut
              centerLabel="Tổng số nhà"
              centerValue={system.houses.total}
              data={buildHouseStatusSlices(system)}
              onSlicePress={(key) =>
                openHouses(`Nhà — ${HOUSE_STATUS_LABELS[key as HouseStatus]}`, undefined, {
                  status: key as HouseStatus,
                })
              }
            />
          </ChartSection>

          {system.reviewStages && (
            <ChartSection
              title="Phân loại số nhà"
              subtitle="5 giai đoạn phân loại — độc lập với trạng thái phê duyệt"
              details={
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
                        openHouses(`Số nhà — ${HOUSE_REVIEW_STAGE_LABELS[stage]}`, undefined, {
                          reviewStage: stage,
                        }),
                    };
                  })}
                />
              }
            >
              <Donut
                centerLabel="Tổng đã phân loại"
                centerValue={system.reviewStages.total}
                data={buildReviewStageSlices(system)}
                onSlicePress={(key) =>
                  openHouses(
                    `Số nhà — ${HOUSE_REVIEW_STAGE_LABELS[key as HouseReviewStage]}`,
                    undefined,
                    { reviewStage: key as HouseReviewStage },
                  )
                }
              />
            </ChartSection>
          )}

          {/* Ấp/thôn — top 5 nhiều nhà nhất (giống web 10.2). */}
          <ChartSection
            title="Ấp/thôn"
            subtitle="10.2 — top 5 ấp/thôn nhiều nhà nhất"
            details={
              <RankedCard
                emptyText="Chưa có dữ liệu"
                items={system.topWards.map((w) => ({
                  label: w.ward,
                  value: `${w.houseCount} nhà`,
                  onPress: () => openHouses(`Nhà ở ${w.ward}`, undefined, { ward: w.ward }),
                }))}
              />
            }
          >
            <BarList
              data={system.topWards.map((w) => ({ key: w.ward, name: w.ward, value: w.houseCount }))}
              onBarPress={(key) => openHouses(`Nhà ở ${key}`, undefined, { ward: key })}
            />
          </ChartSection>

          {/* Theo xã/phường — giống web: top 10 xã/phường nhiều nhà nhất, tách đã có số / chưa có số. */}
          {topWardBreakdown.length > 0 && (
            <ChartSection
              title="Theo xã/phường"
              subtitle="Top 10 xã/phường nhiều nhà nhất — tách rõ đã có số / chưa có số"
              details={
                <RankedCard
                  emptyText="Chưa có dữ liệu"
                  items={topWardBreakdown.map((w) => ({
                    label: w.name,
                    value: `${w.approved} đã có số · ${w.withoutNumber} chưa có số`,
                    onPress: () => openHouses(`Nhà ở ${w.name}`, undefined, { ward: w.name }),
                  }))}
                />
              }
            >
              <StackedBarList
                data={topWardBreakdown}
                onBarPress={(key) => openHouses(`Nhà ở ${key}`, undefined, { ward: key })}
              />
            </ChartSection>
          )}

          {/* Báo cáo theo tuyến đường — giống web 10.3: top 5 tuyến đường nhiều nhà nhất. */}
          <ChartSection
            title="Báo cáo theo tuyến đường"
            subtitle="10.3 — top 5 tuyến đường nhiều nhà nhất"
            details={
              <RankedCard
                emptyText="Chưa có dữ liệu"
                items={system.topStreets.map((s) => ({
                  label: s.street,
                  value: `${s.houseCount} nhà`,
                  onPress: () => openHouses(`Nhà ở đường ${s.street}`, undefined, { street: s.street }),
                }))}
              />
            }
          >
            <BarList
              data={system.topStreets.map((s) => ({ key: s.street, name: s.street, value: s.houseCount }))}
              onBarPress={(key) => openHouses(`Nhà ở đường ${key}`, undefined, { street: key })}
            />
          </ChartSection>

          <ChartSection
            title="Báo cáo số nhà trùng"
            subtitle={`10.5 — cùng phường/xã + đường + số nhà (${system.duplicates.totalGroups} nhóm trùng${
              system.duplicates.totalGroups > system.duplicates.groups.length
                ? `, hiển thị ${system.duplicates.groups.length} nhóm nhiều nhất`
                : ''
            })`}
            details={
              <>
                <RankedCard
                  emptyText="Không phát hiện số nhà trùng"
                  items={system.duplicates.groups.map((d) => ({
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
              </>
            }
          >
            <BarList
              color={CHART_COLORS.red}
              emptyText="Không phát hiện số nhà trùng"
              data={system.duplicates.groups.map((d, i) => ({
                key: String(i),
                name: `${d.houseNumber} — ${d.street}`,
                value: d.count,
              }))}
              onBarPress={(key) => {
                const d = system.duplicates.groups[Number(key)];
                if (!d) return;
                openHouses(`Số nhà trùng: ${d.houseNumber} — ${d.street}`, d.ward, {
                  street: d.street,
                  search: d.houseNumber,
                });
              }}
            />
          </ChartSection>

          <ChartSection
            title="Báo cáo biển số nhà"
            subtitle="10.7-10.9 — đã cấp / đã gắn / chưa gắn"
            details={
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
            }
          >
            <Donut
              centerLabel="Biển đã cấp"
              centerValue={system.plates.total}
              data={buildPlateSlices(system)}
              onSlicePress={(key) =>
                openPlates(
                  `Biển số nhà — ${PLATE_STATUS_LABELS[key as PlateStatus]}`,
                  undefined,
                  key as PlateStatus,
                )
              }
            />
            <Gauge
              value={system.plates.installedPct}
              label="Tiến độ gắn biển"
              color={CHART_COLORS.green}
            />
          </ChartSection>

          <ChartSection
            title="Báo cáo tiến độ khảo sát"
            subtitle="10.10 — theo trạng thái đợt khảo sát và nhiệm vụ"
            details={
              <>
                {campaignCounts && (
                  <>
                    <Text style={styles.detailsGroupLabel}>Đợt khảo sát</Text>
                    <View style={styles.grid}>
                      <StatCard
                        icon="file-document-edit-outline"
                        label="Nháp"
                        value={campaignCounts[CampaignStatus.DRAFT]}
                        color="slate"
                        onPress={() => openCampaigns('Đợt khảo sát — Nháp', undefined, CampaignStatus.DRAFT)}
                      />
                      <StatCard
                        icon="flag-outline"
                        label="Đang triển khai"
                        value={campaignCounts[CampaignStatus.ACTIVE]}
                        color="blue"
                        onPress={() =>
                          openCampaigns('Đợt khảo sát đang triển khai', undefined, CampaignStatus.ACTIVE)
                        }
                      />
                      <StatCard
                        icon="flag-checkered"
                        label="Hoàn tất"
                        value={campaignCounts[CampaignStatus.COMPLETED]}
                        color="emerald"
                        onPress={() =>
                          openCampaigns('Đợt khảo sát đã hoàn tất', undefined, CampaignStatus.COMPLETED)
                        }
                      />
                    </View>
                  </>
                )}
                <Text style={styles.detailsGroupLabel}>Nhiệm vụ khảo sát</Text>
                <View style={styles.grid}>
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
                      openAssignments('Nhiệm vụ cần khảo sát lại', undefined, [
                        AssignmentStatus.NEEDS_REVISIT,
                      ])
                    }
                  />
                </View>
                {system.surveys.assignments.assigned +
                  system.surveys.assignments.inProgress +
                  system.surveys.assignments.submitted +
                  system.surveys.assignments.completed +
                  system.surveys.assignments.needsRevisit ===
                  0 && (
                  <Text style={styles.moreNote}>
                    Chưa có nhiệm vụ — tạo phân vùng và giao nhiệm vụ trong từng đợt ở trang Khảo sát (web).
                  </Text>
                )}
              </>
            }
          >
            {/* Đợt khảo sát — đếm từ danh sách đợt (API tổng quan chỉ trả số đợt đang triển khai). */}
            {campaignCounts && (
              <>
                <Text style={styles.chartCaption}>Đợt khảo sát</Text>
                <Donut
                  centerLabel="Tổng đợt"
                  centerValue={Object.values(campaignCounts).reduce((a, b) => a + b, 0)}
                  data={buildCampaignSlices(campaignCounts)}
                  onSlicePress={(key) =>
                    openCampaigns(
                      `Đợt khảo sát — ${CAMPAIGN_STATUS_LABELS[key as CampaignStatus]}`,
                      undefined,
                      key as CampaignStatus,
                    )
                  }
                />
              </>
            )}
            <Text style={styles.chartCaption}>Nhiệm vụ khảo sát</Text>
            <Donut
              centerLabel="Tổng nhiệm vụ"
              centerValue={
                system.surveys.assignments.assigned +
                system.surveys.assignments.inProgress +
                system.surveys.assignments.submitted +
                system.surveys.assignments.completed +
                system.surveys.assignments.needsRevisit
              }
              data={buildSurveySlices(system)}
              onSlicePress={(key) =>
                key === SLICE_KEY.IN_SURVEY
                  ? openAssignments('Nhiệm vụ đang khảo sát', undefined, [
                      AssignmentStatus.ASSIGNED,
                      AssignmentStatus.IN_PROGRESS,
                    ])
                  : openAssignments(
                      `Nhiệm vụ — ${ASSIGNMENT_STATUS_LABELS[key as AssignmentStatus]}`,
                      undefined,
                      [key as AssignmentStatus],
                    )
              }
            />
            <Gauge
              value={system.surveys.completedPct}
              label="Hoàn tất nhiệm vụ"
              color={CHART_COLORS.green}
            />
          </ChartSection>

          {/* Mục đánh số: web đã có, mobile trước đây chưa hiển thị — bổ sung để đồng bộ. */}
          <ChartSection
            title="Báo cáo tiến độ đánh số"
            subtitle="10.11 — theo trạng thái phương án đánh số"
            details={
              <View style={styles.grid}>
                <StatCard
                  icon="vector-polyline"
                  label="Tổng phương án"
                  value={system.numberingSchemes.total}
                  color="blue"
                  onPress={() => openSchemes('Tổng phương án đánh số', undefined)}
                />
                <StatCard
                  icon="pencil-outline"
                  label="Đang soạn / trình duyệt"
                  value={system.numberingSchemes.draft + system.numberingSchemes.submitted}
                  color="amber"
                  onPress={() =>
                    openSchemes('Phương án đang soạn / trình duyệt', undefined, [
                      NumberingSchemeStatus.DRAFT,
                      NumberingSchemeStatus.SUBMITTED,
                    ])
                  }
                />
                <StatCard
                  icon="check-circle-outline"
                  label="Đã duyệt"
                  value={system.numberingSchemes.approved}
                  color="emerald"
                  onPress={() =>
                    openSchemes('Phương án đã duyệt', undefined, [NumberingSchemeStatus.APPROVED])
                  }
                />
                <StatCard
                  icon="close-circle-outline"
                  label="Bị từ chối"
                  value={system.numberingSchemes.rejected}
                  color="rose"
                  onPress={() =>
                    openSchemes('Phương án bị từ chối', undefined, [NumberingSchemeStatus.REJECTED])
                  }
                />
              </View>
            }
          >
            <Donut
              centerLabel="Tổng phương án"
              centerValue={system.numberingSchemes.total}
              data={buildSchemeSlices(system)}
              onSlicePress={(key) =>
                key === SLICE_KEY.DRAFT_SUBMITTED
                  ? openSchemes('Phương án đang soạn / trình duyệt', undefined, [
                      NumberingSchemeStatus.DRAFT,
                      NumberingSchemeStatus.SUBMITTED,
                    ])
                  : openSchemes(
                      `Phương án — ${NUMBERING_SCHEME_STATUS_LABELS[key as NumberingSchemeStatus]}`,
                      undefined,
                      [key as NumberingSchemeStatus],
                    )
              }
            />
            <Gauge
              value={system.numberingSchemes.approvedPct}
              label="Phương án đã duyệt"
              color={CHART_COLORS.green}
            />
          </ChartSection>

          <ChartSection
            title="Hồ sơ – quy trình"
            subtitle="Hồ sơ xin cấp số nhà đang xử lý (nhóm 9)"
            details={
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
            }
          >
            <Donut
              centerLabel="Tổng hồ sơ"
              centerValue={system.cases.total}
              data={buildCaseSlices(system)}
              onSlicePress={(key) =>
                key === SLICE_KEY.OPEN
                  ? openCases('Hồ sơ đang xử lý', undefined, 'OPEN')
                  : openCases(
                      `Hồ sơ — ${CASE_STATUS_LABELS[key as CaseStatus]}`,
                      undefined,
                      key as CaseStatus,
                    )
              }
            />
          </ChartSection>

          {/* Nút điều hướng như web — chỉ tới các tab mobile có sẵn. */}
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Map')}>
              <Text style={styles.navButtonText}>Xem danh sách/bản đồ →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Assignments')}>
              <Text style={styles.navButtonText}>Xem khảo sát →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Plates')}>
              <Text style={styles.navButtonText}>Xem biển số →</Text>
            </TouchableOpacity>
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

    <Modal
      visible={hamletPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setHamletPickerOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ấp/Thôn/Tổ dân phố</Text>
            <TouchableOpacity onPress={() => setHamletPickerOpen(false)}>
              <Icon name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            {[{ id: '', name: 'Tất cả' }, ...hamlets].map((h) => (
              <TouchableOpacity
                key={h.id || 'all'}
                style={styles.modalRow}
                onPress={() => {
                  setHamletId(h.id);
                  setHamletPickerOpen(false);
                }}
              >
                <Text style={[styles.modalRowPrimary, h.id === hamletId && { color: '#2563eb' }]}>
                  {h.name}
                </Text>
                {h.id === hamletId && <Icon name="check" size={18} color="#2563eb" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>

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
      onTabPress={goToTab}
      webOnlyNote={modalWebOnly}
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
    marginHorizontal: 12,
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
  chartCaption: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  detailsGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
  },
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
  searchCard: { marginHorizontal: 12, marginBottom: 8, gap: 8 },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  hamletButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hamletButtonText: { flex: 1, fontSize: 13, color: '#334155' },
  searchError: { fontSize: 12, color: '#e11d48', marginHorizontal: 16, marginBottom: 8 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 12, marginTop: 8 },
  navButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navButtonText: { fontSize: 12, fontWeight: '600', color: '#334155' },
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
