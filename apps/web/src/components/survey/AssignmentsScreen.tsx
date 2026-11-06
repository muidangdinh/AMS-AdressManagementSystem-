'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Flag,
  History,
  Loader2,
  MapPin,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import {
  ASSIGNMENT_EVENT_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  AssignmentEventAction,
  AssignmentStatus,
  type AssignmentEvent,
  type AssignmentHouse,
  type AssignmentIssueKind,
  type SurveyAssignment,
} from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import {
  fetchAssignmentHouses,
  fetchMyAssignments,
  getAssignment,
  reportAssignmentIssue,
  startAssignment,
  submitAssignment,
} from '@/lib/survey-field-api';
import {
  clearActiveAssignmentId,
  getActiveAssignmentId,
  setActiveAssignmentId,
} from '@/lib/survey-session';

const STATUS_STYLES: Record<AssignmentStatus, string> = {
  [AssignmentStatus.ASSIGNED]: 'bg-info/10 text-info border-info/25',
  [AssignmentStatus.IN_PROGRESS]: 'bg-accent/10 text-accent border-accent/25',
  [AssignmentStatus.SUBMITTED]: 'bg-warn/10 text-warn border-warn/25',
  [AssignmentStatus.COMPLETED]: 'bg-ok/10 text-ok border-ok/25',
  [AssignmentStatus.NEEDS_REVISIT]: 'bg-danger/10 text-danger border-danger/25',
};

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function AssignmentsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SurveyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SurveyAssignment | null>(null);
  const [issueTarget, setIssueTarget] = useState<SurveyAssignment | null>(null);
  const [revisitTarget, setRevisitTarget] = useState<SurveyAssignment | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await fetchMyAssignments());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách nhiệm vụ. Kiểm tra kết nối mạng.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setActiveId(getActiveAssignmentId());
    void load();
  }, [load]);

  function replaceItem(updated: SurveyAssignment) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function handleStart(assignment: SurveyAssignment) {
    setBusyId(assignment.id);
    try {
      const updated = await startAssignment(assignment.id);
      replaceItem(updated);
      setActiveAssignmentId(updated.id);
      setActiveId(updated.id);
      router.push('/survey/field');
    } catch (err) {
      setError(errorMessage(err, 'Không bắt đầu được nhiệm vụ.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSelect(assignment: SurveyAssignment) {
    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      await handleStart(assignment);
      return;
    }
    setActiveAssignmentId(assignment.id);
    setActiveId(assignment.id);
    router.push('/survey/field');
  }

  async function handleSubmit(assignment: SurveyAssignment) {
    if (!window.confirm(`Gửi duyệt nhiệm vụ "${assignment.zone.name}"? Sau khi gửi sẽ không thêm nhà được nữa.`)) {
      return;
    }
    setBusyId(assignment.id);
    try {
      const updated = await submitAssignment(assignment.id);
      replaceItem(updated);
      if (activeId === assignment.id) {
        clearActiveAssignmentId();
        setActiveId(null);
      }
      window.alert('Đã gửi duyệt nhiệm vụ.');
    } catch (err) {
      setError(errorMessage(err, 'Không gửi duyệt được nhiệm vụ.'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenRevisitHouse(assignment: SurveyAssignment, houseId: string) {
    setBusyId(assignment.id);
    try {
      if (assignment.status === AssignmentStatus.ASSIGNED || assignment.status === AssignmentStatus.NEEDS_REVISIT) {
        const updated = await startAssignment(assignment.id);
        replaceItem(updated);
      }
      setActiveAssignmentId(assignment.id);
      setActiveId(assignment.id);
      setRevisitTarget(null);
      router.push(`/survey/field?house=${encodeURIComponent(houseId)}`);
    } catch (err) {
      setError(errorMessage(err, 'Không mở được nhà cần khảo sát lại.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Nhiệm vụ của tôi</h1>
          <p className="text-xs text-fg-subtle">
            {items.length > 0 ? `${items.length} nhiệm vụ được giao` : 'Danh sách nhiệm vụ khảo sát'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          aria-label="Làm mới"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-line bg-surface text-fg-muted disabled:opacity-50"
        >
          <RefreshCw className={`w-[18px] h-[18px] ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-fg-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Đang tải nhiệm vụ…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 py-12 px-5 text-center">
          <CheckCircle2 className="w-9 h-9 mx-auto text-ok mb-2" />
          <p className="text-sm font-semibold">Chưa có nhiệm vụ</p>
          <p className="text-xs text-fg-subtle mt-1">Khi được giao việc, nhiệm vụ sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        items.map((assignment) => {
          const isActive = activeId === assignment.id;
          const busy = busyId === assignment.id;
          const canStart =
            assignment.status === AssignmentStatus.ASSIGNED ||
            assignment.status === AssignmentStatus.NEEDS_REVISIT;
          const revisitCount = assignment.revisitPending ?? 0;
          return (
            <article
              key={assignment.id}
              className={`rounded-2xl border bg-surface p-3.5 space-y-3 ${
                isActive ? 'border-accent/60 shadow-glow-accent' : 'border-line'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[assignment.status]}`}
                    >
                      {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-white">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold mt-1.5 leading-snug">{assignment.zone.name}</h2>
                  <p className="text-xs text-fg-muted truncate">
                    {assignment.route ? `Tuyến ${assignment.route.name}` : 'Cả phường/xã'}
                    {assignment.zone.ward ? ` · ${assignment.zone.ward.name}` : ''}
                  </p>
                </div>
              </div>

              {assignment.note && (
                <p className="text-xs text-fg-muted rounded-lg bg-surface-2/60 px-2.5 py-1.5">
                  {assignment.note}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-2/50 px-2.5 py-1.5">
                  <p className="text-[10px] text-fg-subtle">Đã khảo sát</p>
                  <p className="font-semibold">
                    {assignment._count?.houses ?? 0}
                    {assignment.targetCount ? ` / ${assignment.targetCount}` : ' nhà'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-2/50 px-2.5 py-1.5">
                  <p className="text-[10px] text-fg-subtle">Hạn xử lý</p>
                  <p className="font-semibold flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(assignment.dueDate) || 'Không có'}
                  </p>
                </div>
              </div>

              {revisitCount > 0 && (
                <div className="rounded-lg border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-xs text-danger font-semibold">
                  {revisitCount} nhà cần khảo sát lại
                </div>
              )}

              {assignment.status === AssignmentStatus.COMPLETED && assignment.reviewNote && (
                <p className="text-xs text-ok">Nhận xét duyệt: {assignment.reviewNote}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {canStart && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStart(assignment)}
                    className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Bắt đầu
                  </button>
                )}
                {assignment.status === AssignmentStatus.IN_PROGRESS && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSelect(assignment)}
                      className={`flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-60 ${
                        isActive
                          ? 'border border-accent/40 bg-accent/10 text-accent'
                          : 'bg-accent/10 text-accent border border-accent/30'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {isActive ? 'Vào khảo sát' : 'Chọn nhiệm vụ'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSubmit(assignment)}
                      className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-fg disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Gửi duyệt
                    </button>
                  </>
                )}
                {revisitCount > 0 &&
                  (assignment.status === AssignmentStatus.IN_PROGRESS ||
                    assignment.status === AssignmentStatus.NEEDS_REVISIT) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRevisitTarget(assignment)}
                      className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-bold text-danger disabled:opacity-60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Khảo sát lại ({revisitCount})
                    </button>
                  )}
              </div>

              <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setHistoryTarget(assignment)}
                    className="inline-flex items-center gap-1 text-fg-muted hover:text-accent"
                  >
                    <History className="w-3.5 h-3.5" />
                    Lịch sử
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueTarget(assignment)}
                    className="inline-flex items-center gap-1 text-fg-muted hover:text-danger"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Báo vấn đề
                  </button>
                </div>
                <span className="text-fg-subtle text-[10px]">Cập nhật {formatDate(assignment.updatedAt)}</span>
              </div>
            </article>
          );
        })
      )}

      {historyTarget && (
        <HistorySheet
          assignment={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {issueTarget && (
        <IssueSheet
          assignment={issueTarget}
          onClose={() => setIssueTarget(null)}
          onSent={(updated) => {
            replaceItem(updated);
            setIssueTarget(null);
          }}
        />
      )}
      {revisitTarget && (
        <RevisitSheet
          assignment={revisitTarget}
          onClose={() => setRevisitTarget(null)}
          busy={busyId === revisitTarget.id}
          onPick={(houseId) => void handleOpenRevisitHouse(revisitTarget, houseId)}
        />
      )}
    </div>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-surface border border-line"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <h2 id="sheet-title" className="text-sm font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-fg-subtle hover:text-fg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

function HistorySheet({
  assignment,
  onClose,
}: {
  assignment: SurveyAssignment;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<AssignmentEvent[] | null>(assignment.events ?? null);
  const [loading, setLoading] = useState(!assignment.events);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assignment.events) return;
    let cancelled = false;
    getAssignment(assignment.id)
      .then((detail) => {
        if (!cancelled) setEvents(detail.events ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Không tải được lịch sử nhiệm vụ.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignment]);

  const fallback: AssignmentEvent[] = [];
  if (!assignment.events && events && events.length === 0) {
    fallback.push({
      id: 1,
      assignmentId: assignment.id,
      action: AssignmentEventAction.CREATED,
      createdAt: assignment.createdAt,
      note: null,
      actor: assignment.createdBy ?? null,
    });
    if (assignment.submittedAt) {
      fallback.push({
        id: 2,
        assignmentId: assignment.id,
        action: AssignmentEventAction.SUBMITTED,
        createdAt: assignment.submittedAt,
        note: null,
        actor: assignment.assignee,
      });
    }
  }
  const list = assignment.events ?? (events?.length ? events : fallback);

  return (
    <Sheet title="Lịch sử nhiệm vụ" onClose={onClose}>
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-sm text-fg-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-fg-muted">Chưa có ghi nhận lịch sử.</p>
      ) : (
        <ol className="relative border-l border-line ml-2 space-y-4">
          {list.map((event) => (
            <li key={event.id} className="ml-4">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-surface" />
              <p className="text-sm font-semibold">
                {ASSIGNMENT_EVENT_LABELS[event.action] ?? event.action}
              </p>
              <p className="text-xs text-fg-subtle">
                {formatDateTime(event.createdAt)}
                {event.actor ? ` · ${event.actor.fullName}` : ''}
              </p>
              {event.note && <p className="text-xs text-fg-muted mt-1">{event.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

function IssueSheet({
  assignment,
  onClose,
  onSent,
}: {
  assignment: SurveyAssignment;
  onClose: () => void;
  onSent: (assignment: SurveyAssignment) => void;
}) {
  const [kind, setKind] = useState<AssignmentIssueKind>('ISSUE');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    if (!note.trim()) {
      setError('Vui lòng mô tả vấn đề hoặc nội dung cần hỗ trợ.');
      return;
    }
    setSending(true);
    setError('');
    try {
      onSent(await reportAssignmentIssue(assignment.id, kind, note.trim()));
    } catch (err) {
      setError(errorMessage(err, 'Không gửi được báo cáo.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet title="Báo vấn đề hiện trường" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['ISSUE', 'HELP'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                kind === value
                  ? 'border-danger/40 bg-danger/10 text-danger'
                  : 'border-line bg-surface-2 text-fg-muted'
              }`}
            >
              {value === 'ISSUE' ? 'Báo vấn đề' : 'Xin hỗ trợ'}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Mô tả cụ thể để người giao việc xử lý…"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
          Gửi báo cáo
        </button>
      </div>
    </Sheet>
  );
}

function RevisitSheet({
  assignment,
  onClose,
  busy,
  onPick,
}: {
  assignment: SurveyAssignment;
  onClose: () => void;
  busy: boolean;
  onPick: (houseId: string) => void;
}) {
  const [houses, setHouses] = useState<AssignmentHouse[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAssignmentHouses(assignment.id, true)
      .then((result) => {
        if (!cancelled) setHouses(result);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Không tải được nhà cần khảo sát lại.'));
      });
    return () => {
      cancelled = true;
    };
  }, [assignment.id]);

  return (
    <Sheet title="Nhà cần khảo sát lại" onClose={onClose}>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !houses ? (
        <div className="py-8 flex items-center justify-center gap-2 text-sm text-fg-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
        </div>
      ) : houses.length === 0 ? (
        <p className="text-sm text-fg-muted">Không còn nhà nào cần khảo sát lại.</p>
      ) : (
        <ul className="space-y-2">
          {houses.map((house) => (
            <li key={house.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(house.id)}
                className="w-full flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-left disabled:opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {house.houseNumber} {house.street}
                  </p>
                  <p className="text-xs text-fg-muted truncate">{house.ownerName}</p>
                  {house.revisitReason && (
                    <p className="text-[11px] text-danger mt-0.5">Lý do: {house.revisitReason}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
