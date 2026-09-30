'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type {
  ChartSlice,
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
  // Dựng dữ liệu biểu đồ dùng chung với app mobile (logic thuần, phần vẽ mỗi nền tảng tự làm).
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
import { ApiError, apiFetch } from '@/lib/api';
import { dashboardApi } from '@/lib/dashboard-api';
import { hamletsApi } from '@/lib/addresses-api';
import { EmptyState, ButtonSpinner } from '@/components/ui';
import type { ChartBar } from '@/components/DashboardCharts';

// Import động — Chart.js vẽ bằng canvas nên cần `window`, không chạy được khi SSR.
const ChartSection = dynamic(() => import('@/components/DashboardCharts').then((m) => m.ChartSection), { ssr: false });
const DonutChart = dynamic(() => import('@/components/DashboardCharts').then((m) => m.DonutChart), { ssr: false });
const BarChartH = dynamic(() => import('@/components/DashboardCharts').then((m) => m.BarChartH), { ssr: false });
const GaugeChart = dynamic(() => import('@/components/DashboardCharts').then((m) => m.GaugeChart), { ssr: false });
const StackedBarChart = dynamic(() => import('@/components/DashboardCharts').then((m) => m.StackedBarChart), { ssr: false });

/** Nhãn phụ (badge) dùng chung cho các loại trạng thái khác nhau trong modal xem nhanh. */
const NEUTRAL_BADGE = 'bg-slate-100 text-slate-700';
const WARN_BADGE = 'bg-amber-100 text-amber-800';
const OK_BADGE = 'bg-emerald-100 text-emerald-800';
const BAD_BADGE = 'bg-rose-100 text-rose-800';

const PLATE_STATUS_BADGE: Record<PlateStatus, string> = {
  [PlateStatus.ISSUED]: WARN_BADGE,
  [PlateStatus.INSTALLED]: OK_BADGE,
  [PlateStatus.REVOKED]: NEUTRAL_BADGE,
};
const CASE_STATUS_BADGE: Record<CaseStatus, string> = {
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
const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, string> = {
  [CampaignStatus.DRAFT]: NEUTRAL_BADGE,
  [CampaignStatus.ACTIVE]: WARN_BADGE,
  [CampaignStatus.COMPLETED]: OK_BADGE,
};
const ASSIGNMENT_STATUS_BADGE: Record<AssignmentStatus, string> = {
  [AssignmentStatus.ASSIGNED]: NEUTRAL_BADGE,
  [AssignmentStatus.IN_PROGRESS]: WARN_BADGE,
  [AssignmentStatus.SUBMITTED]: WARN_BADGE,
  [AssignmentStatus.COMPLETED]: OK_BADGE,
  [AssignmentStatus.NEEDS_REVISIT]: BAD_BADGE,
};
const SCHEME_STATUS_BADGE: Record<NumberingSchemeStatus, string> = {
  [NumberingSchemeStatus.DRAFT]: NEUTRAL_BADGE,
  [NumberingSchemeStatus.SUBMITTED]: WARN_BADGE,
  [NumberingSchemeStatus.APPROVED]: OK_BADGE,
  [NumberingSchemeStatus.REJECTED]: BAD_BADGE,
};

const MODAL_ROW_LIMIT = 15;

/** 1 dòng hiển thị trong modal xem nhanh — đủ chung để dùng cho mọi loại dữ liệu. */
interface ModalRow {
  key: string;
  primary: string;
  secondary?: string;
  badge?: { text: string; className: string };
  /** Có toạ độ — cho phép bấm để bay tới vị trí đó trên bản đồ `/houses`. */
  location?: { id: string; lat: number; lng: number };
  /** Có trang chi tiết — cho phép bấm để chuyển tới trang đó. */
  href?: string;
}

const SEARCH_DEBOUNCE_MS = 350;

const STATUS_BADGE: Record<HouseStatus, string> = {
  [HouseStatus.APPROVED]: 'bg-emerald-100 text-emerald-800',
  [HouseStatus.PENDING]: 'bg-amber-100 text-amber-800',
  [HouseStatus.NEEDS_ADJUST]: 'bg-rose-100 text-rose-800',
};

type CardColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

const CARD_COLOR: Record<CardColor, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

/** Lát donut "Đợt khảo sát" (mục Báo cáo tiến độ khảo sát) — đếm ở frontend từ danh sách đợt (API tổng quan không trả). */
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

function StatCard({
  label,
  value,
  color,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  color: CardColor;
  icon: string;
  /** Bấm vào ô để mở modal xem nhanh danh sách bản ghi khớp — bỏ trống nếu không có gì để xem. */
  onClick?: () => void;
}) {
  const c = CARD_COLOR[color];
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`group bg-white rounded-xl border border-slate-200 shadow-card p-4 flex items-center gap-3.5 text-left w-full ${
        onClick ? 'hover:border-blue-200 hover:shadow-soft transition cursor-pointer' : ''
      }`}
    >
      <div
        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-lg ${c.bg} ${
          onClick ? 'group-hover:scale-105 transition-transform' : ''
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-slate-900 leading-tight tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 font-medium truncate">{label}</p>
      </div>
    </Wrapper>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  /** Bỏ trống khi dùng làm phần chi tiết bên trong `ChartSection` — tiêu đề đã hiện ở đó. */
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={title ? 'mb-6' : ''}>
      {title && (
        <div className="mb-2.5">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">{children}</div>
    </section>
  );
}

function RankedList<T>({
  title,
  subtitle,
  items,
  emptyText,
  renderItem,
  danger,
}: {
  /** Bỏ trống khi dùng làm phần chi tiết bên trong `ChartSection` — tiêu đề đã hiện ở đó. */
  title?: string;
  subtitle?: string;
  items: T[];
  emptyText: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Viền/tiêu đề màu cảnh báo — dùng cho báo cáo bất thường (số nhà trùng). */
  danger?: boolean;
}) {
  return (
    <section className={title ? 'mb-6' : ''}>
      {title && (
        <div className="mb-2.5">
          <h3 className={`text-sm font-bold ${danger ? 'text-rose-700' : 'text-slate-800'}`}>{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      )}
      <div
        className={`bg-white rounded-xl border shadow-card overflow-hidden ${
          danger ? 'border-rose-200' : 'border-slate-200'
        }`}
      >
        {items.length === 0 ? (
          <EmptyState icon={danger ? '✅' : '📭'} text={emptyText} />
        ) : (
          <ul className="divide-y divide-slate-100 max-h-80 overflow-auto">
            {items.map((item, i) => renderItem(item, i))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Modal xem nhanh — bấm vào 1 ô số liệu/1 dòng xếp hạng trên Dashboard sẽ mở modal này,
 * liệt kê tối đa `MODAL_ROW_LIMIT` bản ghi khớp, không rời khỏi trang Dashboard.
 */
function DetailModal({
  title,
  subtitle,
  loading,
  error,
  rows,
  totalCount,
  onClose,
  onRowClick,
  onHrefClick,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  rows: ModalRow[];
  totalCount: number | null;
  onClose: () => void;
  /** Bấm vào 1 dòng có toạ độ — bay tới vị trí đó trên bản đồ. */
  onRowClick?: (location: { id: string; lat: number; lng: number }) => void;
  /** Bấm vào 1 dòng có `href` — chuyển tới trang chi tiết. */
  onHrefClick?: (href: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-soft w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition ml-3"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <ButtonSpinner /> Đang tải…
            </div>
          )}
          {!loading && error && <p className="text-center py-8 text-sm text-rose-500">{error}</p>}
          {!loading && !error && rows.length === 0 && (
            <EmptyState text="Không có bản ghi nào khớp" />
          )}
          {!loading && !error && rows.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const goHref = r.href && onHrefClick ? () => onHrefClick(r.href!) : undefined;
                const goLocation = r.location && onRowClick ? () => onRowClick(r.location!) : undefined;
                const handler = goHref ?? goLocation;
                const clickable = !!handler;
                const Row = clickable ? 'button' : 'div';
                return (
                  <li key={r.key}>
                    <Row
                      onClick={handler}
                      className={`w-full px-5 py-2.5 text-sm flex items-center justify-between gap-3 text-left ${
                        clickable ? 'hover:bg-blue-50/50 cursor-pointer' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="font-bold text-slate-900">{r.primary}</span>
                        {r.secondary && (
                          <span className="block text-xs text-slate-400 truncate">{r.secondary}</span>
                        )}
                      </span>
                      {r.badge && (
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${r.badge.className}`}
                        >
                          {r.badge.text}
                        </span>
                      )}
                      {r.href && onHrefClick && <span className="shrink-0 text-slate-300">›</span>}
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!loading && !error && totalCount !== null && totalCount > rows.length && (
          <div className="px-5 py-2.5 border-t border-slate-100 text-[11px] text-slate-400 shrink-0">
            Hiển thị {rows.length}/{totalCount} bản ghi — vào trang danh sách để xem đầy đủ.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dashboard tổng quan (Phase 11 — I.1). Thay thế thanh 4 badge nhỏ ở header
 * `/houses` bằng trang riêng, dạng thẻ số liệu theo gợi ý ở
 * `KE_HOACH_NANG_CAP.md` (mục 3). Không làm 1.8 (bản đồ tổng quan — xem
 * chế độ bản đồ có sẵn ở `/houses`), 1.9 (biểu đồ theo thời gian) và 1.10
 * (cảnh báo dữ liệu bất thường) — ngoài phạm vi lần thêm màn hình đầu tiên.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Số đợt khảo sát theo trạng thái — API tổng quan chỉ trả số đợt đang triển khai, nên tự đếm từ
  // danh sách đợt (API có sẵn). Lỗi riêng request này không làm hỏng cả Tổng Quan (ẩn hàng đợt).
  const [campaignCounts, setCampaignCounts] = useState<Record<CampaignStatus, number> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    apiFetch<SurveyCampaign[]>('/api/survey-campaigns')
      .then((list) => {
        const counts = Object.fromEntries(
          Object.values(CampaignStatus).map((st) => [st, 0]),
        ) as Record<CampaignStatus, number>;
        list.forEach((c) => {
          counts[c.status] += 1;
        });
        setCampaignCounts(counts);
      })
      .catch(() => setCampaignCounts(null));
    try {
      setData(await dashboardApi.summary());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được số liệu tổng quan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tìm kiếm nhanh: lọc theo ấp/thôn + gõ tìm theo tên đường/chủ hộ/SĐT/CCCD.
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [hamletId, setHamletId] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<HouseSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    hamletsApi.list().then(setHamlets).catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim() && !hamletId) {
      searchAbortRef.current?.abort();
      setResults(null);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearching(true);
      setSearchError(null);
      try {
        const res = await dashboardApi.searchHouses(
          { search: search.trim() || undefined, hamletId: hamletId || undefined },
          controller.signal,
        );
        setResults(res.items);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSearchError(err instanceof ApiError ? err.message : 'Tìm kiếm thất bại');
        setResults(null);
      } finally {
        if (searchAbortRef.current === controller) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search, hamletId]);

  /** Bấm vào 1 kết quả — chuyển qua `/houses` ở chế độ bản đồ, bay thẳng tới vị trí nhà đó. */
  function goToMap(house: HouseSummary) {
    router.push(`/houses?focusId=${house.id}&lat=${house.latitude}&lng=${house.longitude}`);
  }

  /** Bấm vào 1 dòng trong modal xem nhanh — đóng modal rồi bay tới vị trí đó trên bản đồ. */
  function focusOnMap(location: { id: string; lat: number; lng: number }) {
    closeModal();
    router.push(`/houses?focusId=${location.id}&lat=${location.lat}&lng=${location.lng}`);
  }

  /** Bấm vào 1 dòng có trang chi tiết — đóng modal rồi chuyển tới trang đó. */
  function navigate(href: string) {
    closeModal();
    router.push(href);
  }

  // Modal xem nhanh — bấm 1 ô số liệu/1 dòng xếp hạng để xem danh sách bản ghi khớp,
  // không rời khỏi trang Dashboard (xem DetailModal ở trên).
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalSubtitle, setModalSubtitle] = useState<string | undefined>(undefined);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalRows, setModalRows] = useState<ModalRow[]>([]);
  const [modalTotal, setModalTotal] = useState<number | null>(null);

  function closeModal() {
    setModalTitle(null);
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
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Không tải được danh sách');
    } finally {
      setModalLoading(false);
    }
  }

  function houseRow(h: HouseSummary): ModalRow {
    return {
      key: h.id,
      primary: `${h.houseNumber} ${h.street}`,
      secondary: `${h.ward} • ${h.ownerName}`,
      badge: { text: HOUSE_STATUS_LABELS[h.status], className: STATUS_BADGE[h.status] },
      location: { id: h.id, lat: h.latitude, lng: h.longitude },
    };
  }

  /** Mở modal danh sách nhà — lọc theo status/ward/street/search giống `/api/houses`. */
  function openHouses(
    title: string,
    subtitle: string | undefined,
    params: {
      status?: HouseStatus;
      reviewStage?: HouseReviewStage;
      ward?: string;
      street?: string;
      search?: string;
    },
  ) {
    openModal(title, subtitle, async () => {
      const qs = new URLSearchParams({ pageSize: String(MODAL_ROW_LIMIT) });
      if (params.status) qs.set('status', params.status);
      if (params.reviewStage) qs.set('reviewStage', params.reviewStage);
      if (params.ward) qs.set('ward', params.ward);
      if (params.street) qs.set('street', params.street);
      if (params.search) qs.set('search', params.search);
      const res = await apiFetch<PaginatedResult<HouseSummary>>(`/api/houses?${qs.toString()}`);
      return { rows: res.items.map(houseRow), total: res.total };
    });
  }

  function plateRow(p: HousePlate): ModalRow {
    return {
      key: p.id,
      primary: `${p.plateCode} — ${p.house.houseNumber} ${p.house.street}`,
      secondary: p.house.ward,
      badge: { text: PLATE_STATUS_LABELS[p.status], className: PLATE_STATUS_BADGE[p.status] },
      location: { id: p.house.id, lat: p.house.latitude, lng: p.house.longitude },
    };
  }

  function openPlates(title: string, subtitle: string | undefined, status?: PlateStatus) {
    openModal(title, subtitle, async () => {
      const qs = status ? `?status=${status}` : '';
      const res = await apiFetch<HousePlate[]>(`/api/house-plates${qs}`);
      return { rows: res.map(plateRow), total: res.length };
    });
  }

  function caseRow(c: HouseCase): ModalRow {
    return {
      key: c.id,
      primary: `${c.caseNumber} — ${c.applicantName}`,
      secondary: c.description ?? undefined,
      badge: { text: CASE_STATUS_LABELS[c.status], className: CASE_STATUS_BADGE[c.status] },
      href: `/houses/cases/${c.id}`,
    };
  }

  /** Hồ sơ "đang xử lý" gộp nhiều trạng thái (mọi trạng thái trừ hoàn tất/từ chối) — lọc client-side. */
  function openCases(title: string, subtitle: string | undefined, status?: CaseStatus | 'OPEN') {
    openModal(title, subtitle, async () => {
      const qs = status && status !== 'OPEN' ? `?status=${status}` : '';
      const res = await apiFetch<HouseCase[]>(`/api/house-cases${qs}`);
      const filtered =
        status === 'OPEN'
          ? res.filter((c) => c.status !== CaseStatus.COMPLETED && c.status !== CaseStatus.REJECTED)
          : res;
      return { rows: filtered.map(caseRow), total: filtered.length };
    });
  }

  function campaignRow(c: SurveyCampaign): ModalRow {
    return {
      key: c.id,
      primary: c.name,
      secondary: `${c._count?.zones ?? 0} phân vùng`,
      badge: { text: CAMPAIGN_STATUS_LABELS[c.status], className: CAMPAIGN_STATUS_BADGE[c.status] },
      href: `/houses/surveys/${c.id}`,
    };
  }

  function openCampaigns(title: string, subtitle: string | undefined, status?: CampaignStatus) {
    openModal(title, subtitle, async () => {
      const qs = status ? `?status=${status}` : '';
      const res = await apiFetch<SurveyCampaign[]>(`/api/survey-campaigns${qs}`);
      return { rows: res.map(campaignRow), total: res.length };
    });
  }

  function assignmentRow(a: SurveyAssignment): ModalRow {
    return {
      key: a.id,
      primary: `${a.zone.name} — ${a.assignee.fullName}`,
      secondary: a.zone.ward?.name ?? undefined,
      badge: { text: ASSIGNMENT_STATUS_LABELS[a.status], className: ASSIGNMENT_STATUS_BADGE[a.status] },
      // Nhiệm vụ chưa có trang riêng — mở đợt khảo sát chứa nó.
      href: `/houses/surveys/${a.zone.campaignId}`,
    };
  }

  /** Cho phép gộp nhiều trạng thái (vd "Đang khảo sát" = ASSIGNED + IN_PROGRESS) — gọi song song rồi ghép. */
  function openAssignments(title: string, subtitle: string | undefined, statuses: AssignmentStatus[]) {
    openModal(title, subtitle, async () => {
      const results = await Promise.all(
        statuses.map((s) => apiFetch<SurveyAssignment[]>(`/api/survey-assignments?status=${s}`)),
      );
      const all = results.flat();
      return { rows: all.map(assignmentRow), total: all.length };
    });
  }

  function schemeRow(s: NumberingScheme): ModalRow {
    return {
      key: s.id,
      primary: s.name,
      secondary: s.street?.name ?? undefined,
      badge: { text: NUMBERING_SCHEME_STATUS_LABELS[s.status], className: SCHEME_STATUS_BADGE[s.status] },
      href: `/houses/numbering/${s.id}`,
    };
  }

  function openSchemes(title: string, subtitle: string | undefined, statuses?: NumberingSchemeStatus[]) {
    openModal(title, subtitle, async () => {
      const results = await Promise.all(
        (statuses ?? [undefined]).map((s) =>
          apiFetch<NumberingScheme[]>(`/api/numbering-schemes${s ? `?status=${s}` : ''}`),
        ),
      );
      const all = results.flat();
      return { rows: all.map(schemeRow), total: all.length };
    });
  }

  // `byWard` chỉ có khi gọi summary không kèm wardId, và trả về ĐỦ danh mục xã/phường
  // (kể cả xã 0 nhà) — nên phải cắt top 10 theo tổng số nhà, không vẽ hết được.
  const topWardBreakdown = toStackedBreakdown(data?.byWard, 10);

  return (
    <div className="h-full overflow-auto p-6">
      <section className="mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-3 flex flex-wrap gap-3 items-end">
          <div className="w-80">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Tìm kiếm
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tên đường, tên chủ hộ, SĐT, CCCD/CMND…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-56">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Ấp/Thôn/Tổ dân phố
            </label>
            <select
              value={hamletId}
              onChange={(e) => setHamletId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả</option>
              {hamlets.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            title="Làm mới"
            aria-label="Làm mới"
            className="ml-auto bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <ButtonSpinner light />
                Đang tải…
              </>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path
                  d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>

        {searchError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm mt-3">
            {searchError}
          </div>
        )}

        {(searching || results !== null) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card mt-3 overflow-hidden">
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                <ButtonSpinner /> Đang tìm…
              </div>
            )}
            {!searching && results !== null && results.length === 0 && (
              <EmptyState icon="🔍" text="Không tìm thấy hồ sơ nào khớp" />
            )}
            {!searching && results !== null && results.length > 0 && (
              <ul className="divide-y divide-slate-100 max-h-96 overflow-auto">
                {results.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => goToMap(h)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50/50 flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="font-bold text-slate-900">{h.houseNumber}</span>{' '}
                        <span className="text-slate-700">{h.street}</span>
                        <span className="block text-xs text-slate-400 truncate">
                          {h.ward}
                          {h.hamlet ? ` • ${h.hamlet.name}` : ''} • {h.ownerName}
                          {h.ownerPhone ? ` • ${h.ownerPhone}` : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${STATUS_BADGE[h.status]}`}
                      >
                        {HOUSE_STATUS_LABELS[h.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!data && loading && <p className="text-slate-400 text-sm">Đang tải số liệu…</p>}

      {data && (
        <>
          <ChartSection
            title="Báo cáo số lượng nhà"
            subtitle="10.1 — tổng số nhà toàn tỉnh, theo trạng thái phê duyệt"
            chart={
              <DonutChart
                centerLabel="Tổng số nhà"
                centerValue={data.houses.total}
                data={buildHouseStatusSlices(data)}
                onSliceClick={(key) =>
                  openHouses(`Nhà — ${HOUSE_STATUS_LABELS[key as HouseStatus]}`, undefined, {
                    status: key as HouseStatus,
                  })
                }
              />
            }
            details={
          <Section>
            <StatCard
              label="Tổng số nhà"
              value={data.houses.total}
              color="blue"
              icon="🏠"
              onClick={() => openHouses('Tổng số nhà', undefined, {})}
            />
            <StatCard
              label="Đã có số / QR"
              value={data.houses.approved}
              color="emerald"
              icon="✅"
              onClick={() => openHouses('Nhà đã có số / QR', undefined, { status: HouseStatus.APPROVED })}
            />
            <StatCard
              label="Chưa có số"
              value={data.houses.withoutNumber}
              color="amber"
              icon="⏳"
              onClick={() =>
                openHouses('Nhà chưa có số', 'Trạng thái Chờ duyệt', { status: HouseStatus.PENDING })
              }
            />
            <StatCard
              label="Cần điều chỉnh"
              value={data.houses.needsAdjust}
              color="rose"
              icon="⚠️"
              onClick={() => openHouses('Nhà cần điều chỉnh', undefined, { status: HouseStatus.NEEDS_ADJUST })}
            />
          </Section>
            }
          />

          <ChartSection
            title="Phân loại số nhà"
            subtitle="5 giai đoạn phân loại — độc lập với trạng thái phê duyệt ở trên"
            chart={
              <DonutChart
                centerLabel="Tổng đã phân loại"
                centerValue={data.reviewStages?.total ?? 0}
                data={buildReviewStageSlices(data)}
                onSliceClick={(key) =>
                  openHouses(
                    `Số nhà — ${HOUSE_REVIEW_STAGE_LABELS[key as HouseReviewStage]}`,
                    undefined,
                    { reviewStage: key as HouseReviewStage },
                  )
                }
              />
            }
            details={
          <RankedList
            items={Object.values(HouseReviewStage).map((stage) => ({
              stage,
              // Optional chaining — backend cũ chưa có field reviewStages (chưa chạy
              // migration house_survey_attrs) không được làm crash cả trang dashboard.
              ...(data.reviewStages?.byStage?.[stage] ?? { count: 0, pct: 0 }),
            }))}
            emptyText="Chưa có dữ liệu"
            renderItem={(item) => (
              <li key={item.stage}>
                <button
                  onClick={() =>
                    openHouses(`Số nhà — ${HOUSE_REVIEW_STAGE_LABELS[item.stage]}`, undefined, {
                      reviewStage: item.stage,
                    })
                  }
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50/50 text-left"
                >
                  <span className="text-slate-700 font-medium">
                    {HOUSE_REVIEW_STAGE_LABELS[item.stage]}
                  </span>
                  <span className="font-bold text-slate-900">
                    {item.count} ({item.pct}%)
                  </span>
                </button>
              </li>
            )}
          />
            }
          />

          <ChartSection
            title="Ấp/thôn"
            subtitle="10.2 — top 5 ấp/thôn nhiều nhà nhất"
            chart={
              <BarChartH
                data={
                  data.topWards.map((w) => ({
                    key: w.ward,
                    name: w.ward,
                    value: w.houseCount,
                  })) satisfies ChartBar[]
                }
                onBarClick={(key) => openHouses(`Nhà ở ${key}`, undefined, { ward: key })}
              />
            }
            details={
          <RankedList
            items={data.topWards}
            emptyText="Chưa có dữ liệu"
            renderItem={(w, i) => (
              <li key={w.ward}>
                <button
                  onClick={() => openHouses(`Nhà ở ${w.ward}`, undefined, { ward: w.ward })}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50/50 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 font-medium">{w.ward}</span>
                  </span>
                  <span className="font-bold text-slate-900">{w.houseCount} nhà</span>
                </button>
              </li>
            )}
          />
            }
          />

          {topWardBreakdown.length > 0 && (
            <ChartSection
              title="Theo xã/phường"
              subtitle="Top 10 xã/phường nhiều nhà nhất — tách rõ đã có số / chưa có số"
              chart={
                <StackedBarChart
                  data={topWardBreakdown}
                  onBarClick={(key) => openHouses(`Nhà ở ${key}`, undefined, { ward: key })}
                />
              }
              details={
                <RankedList
                  items={topWardBreakdown}
                  emptyText="Chưa có dữ liệu"
                  renderItem={(w, i) => (
                    <li key={w.key}>
                      <button
                        onClick={() => openHouses(`Nhà ở ${w.name}`, undefined, { ward: w.name })}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50/50 text-left"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-slate-700 font-medium">{w.name}</span>
                        </span>
                        <span className="text-xs">
                          <span className="font-bold text-emerald-600">{w.approved}</span>
                          <span className="text-slate-400"> đã có số · </span>
                          <span className="font-bold text-amber-600">{w.withoutNumber}</span>
                          <span className="text-slate-400"> chưa có số</span>
                        </span>
                      </button>
                    </li>
                  )}
                />
              }
            />
          )}

          <ChartSection
            title="Báo cáo theo tuyến đường"
            subtitle="10.3 — top 5 tuyến đường nhiều nhà nhất"
            chart={
              <BarChartH
                data={
                  data.topStreets.map((s) => ({
                    key: s.street,
                    name: s.street,
                    value: s.houseCount,
                  })) satisfies ChartBar[]
                }
                onBarClick={(key) => openHouses(`Nhà ở đường ${key}`, undefined, { street: key })}
              />
            }
            details={
          <RankedList
            items={data.topStreets}
            emptyText="Chưa có dữ liệu"
            renderItem={(s, i) => (
              <li key={s.street}>
                <button
                  onClick={() => openHouses(`Nhà ở đường ${s.street}`, undefined, { street: s.street })}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-blue-50/50 text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 font-medium">{s.street}</span>
                  </span>
                  <span className="font-bold text-slate-900">{s.houseCount} nhà</span>
                </button>
              </li>
            )}
          />
            }
          />

          <ChartSection
            title="Báo cáo số nhà trùng"
            subtitle={`10.5 — cùng phường/xã + đường + số nhà (${data.duplicates.totalGroups} nhóm trùng${
              data.duplicates.totalGroups > data.duplicates.groups.length ? `, hiển thị ${data.duplicates.groups.length} nhóm nhiều nhất` : ''
            })`}
            chart={
              <BarChartH
                barColor={CHART_COLORS.red}
                data={
                  data.duplicates.groups.map((d) => ({
                    key: `${d.street}|${d.houseNumber}|${d.ward}`,
                    name: `${d.houseNumber} — ${d.street}`,
                    value: d.count,
                  })) satisfies ChartBar[]
                }
                onBarClick={(key) => {
                  const [street, houseNumber, ward] = key.split('|');
                  openHouses(`Số nhà trùng: ${houseNumber} — ${street}`, ward, {
                    street,
                    search: houseNumber,
                  });
                }}
              />
            }
            details={
          <RankedList
            items={data.duplicates.groups}
            emptyText="Không phát hiện số nhà trùng"
            danger={data.duplicates.totalGroups > 0}
            renderItem={(d, i) => (
              <li key={`${d.ward}-${d.street}-${d.houseNumber}-${i}`}>
                <button
                  onClick={() =>
                    openHouses(`Số nhà trùng: ${d.houseNumber} — ${d.street}`, d.ward, {
                      street: d.street,
                      search: d.houseNumber,
                    })
                  }
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-rose-50/50 text-left"
                >
                  <span className="min-w-0">
                    <span className="font-bold text-slate-900">{d.houseNumber}</span>{' '}
                    <span className="text-slate-700">{d.street}</span>
                    <span className="block text-xs text-slate-400">{d.ward}</span>
                  </span>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                    {d.count} nhà trùng
                  </span>
                </button>
              </li>
            )}
          />
            }
          />

          <ChartSection
            title="Báo cáo biển số nhà"
            subtitle="10.7-10.9 — đã cấp / đã gắn / chưa gắn"
            chart={
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full min-w-0">
              <DonutChart
                centerLabel="Biển đã cấp"
                centerValue={data.plates.total}
                data={buildPlateSlices(data)}
                onSliceClick={(key) =>
                  openPlates(
                    `Biển số nhà — ${PLATE_STATUS_LABELS[key as PlateStatus]}`,
                    undefined,
                    key as PlateStatus,
                  )
                }
              />
                </div>
                <div className="w-full sm:w-44 shrink-0">
                  <GaugeChart
                    value={data.plates.installedPct}
                    label="Tiến độ gắn biển"
                    color={CHART_COLORS.green}
                  />
                </div>
              </div>
            }
            details={
          <Section>
            <StatCard
              label="Đã cấp (tổng)"
              value={data.plates.total}
              color="blue"
              icon="📇"
              onClick={() => openPlates('Biển số nhà đã cấp (tổng)', undefined)}
            />
            <StatCard
              label="Đã gắn"
              value={data.plates.installed}
              color="emerald"
              icon="📌"
              onClick={() => openPlates('Biển số nhà đã gắn', undefined, PlateStatus.INSTALLED)}
            />
            <StatCard
              label="Chưa gắn"
              value={data.plates.issued}
              color="amber"
              icon="🏷️"
              onClick={() => openPlates('Biển số nhà chưa gắn', undefined, PlateStatus.ISSUED)}
            />
            <StatCard
              label="Đã thu hồi"
              value={data.plates.revoked}
              color="slate"
              icon="↩️"
              onClick={() => openPlates('Biển số nhà đã thu hồi', undefined, PlateStatus.REVOKED)}
            />
          </Section>
            }
          />

          <ChartSection
            title="Báo cáo tiến độ khảo sát"
            subtitle="10.10 — theo trạng thái đợt khảo sát và nhiệm vụ"
            chart={
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Đợt khảo sát — đếm từ danh sách đợt (API tổng quan chỉ trả số đợt đang triển khai). */}
                {campaignCounts && (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500 text-center mb-1">Đợt khảo sát</p>
                    <DonutChart
                      centerLabel="Tổng đợt"
                      centerValue={Object.values(campaignCounts).reduce((a, b) => a + b, 0)}
                      data={buildCampaignSlices(campaignCounts)}
                      onSliceClick={(key) =>
                        openCampaigns(
                          `Đợt khảo sát — ${CAMPAIGN_STATUS_LABELS[key as CampaignStatus]}`,
                          undefined,
                          key as CampaignStatus,
                        )
                      }
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 text-center mb-1">Nhiệm vụ khảo sát</p>
                  <DonutChart
                    centerLabel="Tổng nhiệm vụ"
                    centerValue={
                      data.surveys.assignments.assigned +
                      data.surveys.assignments.inProgress +
                      data.surveys.assignments.submitted +
                      data.surveys.assignments.completed +
                      data.surveys.assignments.needsRevisit
                    }
                    data={buildSurveySlices(data)}
                    onSliceClick={(key) =>
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
                </div>
                <div className="w-full max-w-44 mx-auto">
                  <GaugeChart
                    value={data.surveys.completedPct}
                    label="Hoàn tất nhiệm vụ"
                    color={CHART_COLORS.green}
                  />
                </div>
              </div>
            }
            details={
              <>
                {campaignCounts && (
                  <Section title="Đợt khảo sát">
                    <StatCard
                      label="Nháp"
                      value={campaignCounts[CampaignStatus.DRAFT]}
                      color="slate"
                      icon="📝"
                      onClick={() => openCampaigns('Đợt khảo sát — Nháp', undefined, CampaignStatus.DRAFT)}
                    />
                    <StatCard
                      label="Đang triển khai"
                      value={campaignCounts[CampaignStatus.ACTIVE]}
                      color="blue"
                      icon="🚩"
                      onClick={() =>
                        openCampaigns('Đợt khảo sát đang triển khai', undefined, CampaignStatus.ACTIVE)
                      }
                    />
                    <StatCard
                      label="Hoàn tất"
                      value={campaignCounts[CampaignStatus.COMPLETED]}
                      color="emerald"
                      icon="🏁"
                      onClick={() =>
                        openCampaigns('Đợt khảo sát đã hoàn tất', undefined, CampaignStatus.COMPLETED)
                      }
                    />
                  </Section>
                )}
                <Section title="Nhiệm vụ khảo sát">
                  <StatCard
                    label="Đang khảo sát"
                    value={data.surveys.assignments.assigned + data.surveys.assignments.inProgress}
                    color="amber"
                    icon="🧭"
                    onClick={() =>
                      openAssignments('Nhiệm vụ đang khảo sát', undefined, [
                        AssignmentStatus.ASSIGNED,
                        AssignmentStatus.IN_PROGRESS,
                      ])
                    }
                  />
                  <StatCard
                    label="Đã hoàn tất"
                    value={data.surveys.assignments.completed}
                    color="emerald"
                    icon="✅"
                    onClick={() =>
                      openAssignments('Nhiệm vụ đã hoàn tất', undefined, [AssignmentStatus.COMPLETED])
                    }
                  />
                  <StatCard
                    label="Cần khảo sát lại"
                    value={data.surveys.assignments.needsRevisit}
                    color="rose"
                    icon="🔁"
                    onClick={() =>
                      openAssignments('Nhiệm vụ cần khảo sát lại', undefined, [AssignmentStatus.NEEDS_REVISIT])
                    }
                  />
                </Section>
                {data.surveys.assignments.assigned +
                  data.surveys.assignments.inProgress +
                  data.surveys.assignments.submitted +
                  data.surveys.assignments.completed +
                  data.surveys.assignments.needsRevisit ===
                  0 && (
                  <p className="text-xs text-slate-400 -mt-3">
                    Chưa có nhiệm vụ — tạo phân vùng và giao nhiệm vụ trong từng đợt ở trang Khảo sát.
                  </p>
                )}
              </>
            }
          />

          <ChartSection
            title="Báo cáo tiến độ đánh số"
            subtitle="10.11 — theo trạng thái phương án đánh số"
            chart={
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full min-w-0">
              <DonutChart
                centerLabel="Tổng phương án"
                centerValue={data.numberingSchemes.total}
                data={buildSchemeSlices(data)}
                onSliceClick={(key) =>
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
                </div>
                <div className="w-full sm:w-44 shrink-0">
                  <GaugeChart
                    value={data.numberingSchemes.approvedPct}
                    label="Phương án đã duyệt"
                    color={CHART_COLORS.green}
                  />
                </div>
              </div>
            }
            details={
          <Section>
            <StatCard
              label="Tổng phương án"
              value={data.numberingSchemes.total}
              color="blue"
              icon="📐"
              onClick={() => openSchemes('Tổng phương án đánh số', undefined)}
            />
            <StatCard
              label="Đang soạn / trình duyệt"
              value={data.numberingSchemes.draft + data.numberingSchemes.submitted}
              color="amber"
              icon="📝"
              onClick={() =>
                openSchemes('Phương án đang soạn / trình duyệt', undefined, [
                  NumberingSchemeStatus.DRAFT,
                  NumberingSchemeStatus.SUBMITTED,
                ])
              }
            />
            <StatCard
              label="Đã duyệt"
              value={data.numberingSchemes.approved}
              color="emerald"
              icon="✅"
              onClick={() => openSchemes('Phương án đã duyệt', undefined, [NumberingSchemeStatus.APPROVED])}
            />
            <StatCard
              label="Bị từ chối"
              value={data.numberingSchemes.rejected}
              color="rose"
              icon="⛔"
              onClick={() => openSchemes('Phương án bị từ chối', undefined, [NumberingSchemeStatus.REJECTED])}
            />
          </Section>
            }
          />

          <ChartSection
            title="Hồ sơ – quy trình"
            subtitle="Hồ sơ xin cấp số nhà đang xử lý (nhóm 9)"
            chart={
              <DonutChart
                centerLabel="Tổng hồ sơ"
                centerValue={data.cases.total}
                data={buildCaseSlices(data)}
                onSliceClick={(key) =>
                  key === SLICE_KEY.OPEN
                    ? openCases('Hồ sơ đang xử lý', undefined, 'OPEN')
                    : openCases(
                        `Hồ sơ — ${CASE_STATUS_LABELS[key as CaseStatus]}`,
                        undefined,
                        key as CaseStatus,
                      )
                }
              />
            }
            details={
          <Section>
            <StatCard
              label="Tổng hồ sơ"
              value={data.cases.total}
              color="blue"
              icon="📄"
              onClick={() => openCases('Tổng hồ sơ', undefined)}
            />
            <StatCard
              label="Đang xử lý"
              value={data.cases.open}
              color="amber"
              icon="🔄"
              onClick={() => openCases('Hồ sơ đang xử lý', undefined, 'OPEN')}
            />
            <StatCard
              label="Đã hoàn tất"
              value={data.cases.completed}
              color="emerald"
              icon="✅"
              onClick={() => openCases('Hồ sơ đã hoàn tất', undefined, CaseStatus.COMPLETED)}
            />
            <StatCard
              label="Bị từ chối"
              value={data.cases.rejected}
              color="rose"
              icon="⛔"
              onClick={() => openCases('Hồ sơ bị từ chối', undefined, CaseStatus.REJECTED)}
            />
          </Section>
            }
          />

          <div className="flex flex-wrap gap-2 mt-6">
            <Link
              href="/houses"
              className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700"
            >
              Xem danh sách/bản đồ →
            </Link>
            <Link
              href="/houses/cases"
              className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700"
            >
              Xem hồ sơ →
            </Link>
            <Link
              href="/houses/surveys"
              className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700"
            >
              Xem khảo sát →
            </Link>
            <Link
              href="/houses/numbering"
              className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700"
            >
              Xem phương án đánh số →
            </Link>
          </div>
        </>
      )}

      {modalTitle !== null && (
        <DetailModal
          title={modalTitle}
          subtitle={modalSubtitle}
          loading={modalLoading}
          error={modalError}
          rows={modalRows}
          totalCount={modalTotal}
          onClose={closeModal}
          onRowClick={focusOnMap}
          onHrefClick={navigate}
        />
      )}
    </div>
  );
}
