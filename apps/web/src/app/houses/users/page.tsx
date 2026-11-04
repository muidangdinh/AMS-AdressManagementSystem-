'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS, USER_LEVEL_LABELS, UserLevel } from '@tayninh/shared';
import type { Department, Hamlet, RoleSummary, UserSummary, Ward } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { usersApi } from '@/lib/users-api';
import { rolesApi } from '@/lib/roles-api';
import { hamletsApi, wardsApi } from '@/lib/addresses-api';
import { departmentsApi } from '@/lib/departments-api';
import {
  ButtonSpinner,
  EmptyState,
  FIELD_CLASS,
  FormField,
  PageHeader,
  SegmentedControl,
  StatusBadge,
  ToggleSwitch,
  type StatusTone,
} from '@/components/ui';

interface FormState {
  username: string;
  password: string;
  fullName: string;
  roleIds: string[];
  /** '' = không thuộc phòng ban. Chỉ dùng cho nhân sự xã/ấp. */
  departmentId: string;
  /** Đơn vị gõ tự do — chỉ dùng cho tài khoản hệ thống (không thuộc phòng ban). */
  unit: string;
  position: string;
  isActive: boolean;
  level: UserLevel;
  wardId: string;
  hamletId: string;
}

/** Mỗi tab là 1 phân hệ con, ứng với 1 cấp tài khoản. Khóa tab nằm trên URL (`?tab=`) để gửi link được. */
type TabKey = 'xa' | 'ap' | 'he-thong';

const TABS: { key: TabKey; level: UserLevel; label: string; subtitle: string }[] = [
  {
    key: 'xa',
    level: UserLevel.WARD,
    label: 'Nhân sự UBND xã',
    subtitle: 'Cán bộ UBND xã/phường — xem được dữ liệu toàn hệ thống',
  },
  {
    key: 'ap',
    level: UserLevel.HAMLET,
    label: 'Nhân sự ấp/thôn',
    subtitle: 'Cán bộ ấp/thôn — chỉ xem được dữ liệu của ấp mình và nhiệm vụ được giao',
  },
  {
    key: 'he-thong',
    level: UserLevel.SYSTEM,
    label: 'Tài khoản hệ thống',
    subtitle: 'Quản trị viên và tài khoản cấp tỉnh — xem toàn bộ, quản lý được người dùng',
  },
];

const TAB_BY_LEVEL = Object.fromEntries(TABS.map((t) => [t.level, t.key])) as Record<UserLevel, TabKey>;

function readTabFromUrl(): TabKey {
  if (typeof window === 'undefined') return 'xa';
  const t = new URLSearchParams(window.location.search).get('tab');
  return TABS.some((x) => x.key === t) ? (t as TabKey) : 'xa';
}

/** Bộ lọc phòng ban: '' = tất cả, '__none__' = chưa gán phòng ban, còn lại = id phòng ban. */
const NO_DEPARTMENT = '__none__';

/** Nhãn phòng ban trong ô chọn: "Tên — xã" (cấp xã), "Tên — ấp, xã" (cấp ấp), hoặc "(chưa phân cấp)". */
function departmentLabel(d: Department): string {
  if (d.level === 'WARD') return `${d.name} — ${d.ward?.name ?? ''}`;
  if (d.level === 'HAMLET') return `${d.name} — ${d.hamlet?.name ?? ''}, ${d.ward?.name ?? ''}`;
  return `${d.name} (chưa phân cấp)`;
}

/** Phòng ban có gán được cho tài khoản ở cấp/địa bàn này không (khớp quy tắc của API). */
function departmentFits(d: Department, level: UserLevel, wardId: string, hamletId: string): boolean {
  if (level === UserLevel.WARD) return d.level === 'WARD' && d.wardId === wardId;
  if (level === UserLevel.HAMLET) return d.level === 'HAMLET' && d.hamletId === hamletId;
  return false;
}

function readUrlParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

/** Bản API cũ chưa trả `level` → coi như tài khoản hệ thống (đúng với giá trị mặc định khi migrate). */
const levelOf = (u: UserSummary): UserLevel => u.level ?? UserLevel.SYSTEM;

const emptyForm = (level: UserLevel): FormState => ({
  username: '',
  password: '',
  fullName: '',
  roleIds: [],
  departmentId: '',
  unit: '',
  position: '',
  isActive: true,
  level,
  wardId: '',
  hamletId: '',
});

/** Màu tag vai trò hệ thống (UI.md). Vai trò tự tạo dùng màu trung tính. */
const ROLE_TONE: Record<string, StatusTone> = {
  admin: 'danger',
  cadastral: 'accent',
  surveyor: 'ok',
};

/**
 * Quản lý người dùng — chỉ tài khoản hệ thống có quyền user:manage. Chia 3 phân hệ con theo cấp tài khoản
 * (UBND xã / ấp, thôn / hệ thống); mỗi phân hệ có đủ chức năng thêm, sửa, khóa, đặt lại mật khẩu, gán vai trò.
 */
export default function UsersAdminPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.USER_MANAGE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [tab, setTabState] = useState<TabKey>('xa');
  useEffect(() => setTabState(readTabFromUrl()), []);
  const setTab = (next: TabKey) => {
    setTabState(next);
    setWardFilter('');
    setHamletFilter('');
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  };
  const current = TABS.find((t) => t.key === tab)!;

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [userList, roleList, wardList, hamletList, departmentList] = await Promise.all([
        usersApi.list(),
        rolesApi.list(),
        wardsApi.list(),
        hamletsApi.list(),
        departmentsApi.list(),
      ]);
      setUsers(userList);
      setDepartments(departmentList);
      setRoles(roleList.filter((r) => r.isActive));
      setWards(wardList);
      setHamlets(hamletList);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Không gọi API khi không có quyền (trang đang chuyển hướng) — tránh 403 vô ích.
    if (canManage) load();
  }, [load, canManage]);

  const wardName = useMemo(() => new Map(wards.map((w) => [w.id, w.name])), [wards]);

  // Bộ lọc của tab đang xem.
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [hamletFilter, setHamletFilter] = useState('');
  // Lọc phòng ban áp dụng cho mọi tab (mở từ trang Phòng ban qua `?departmentId=`).
  const [departmentFilter, setDepartmentFilterState] = useState('');
  const setDepartmentFilter = (next: string) => {
    setDepartmentFilterState(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('departmentId', next);
    else url.searchParams.delete('departmentId');
    window.history.replaceState(null, '', url);
  };
  useEffect(() => setDepartmentFilterState(readUrlParam('departmentId')), []);

  const matchesDepartment = useCallback(
    (u: UserSummary) =>
      !departmentFilter ||
      (departmentFilter === NO_DEPARTMENT ? !u.departmentId : u.departmentId === departmentFilter),
    [departmentFilter],
  );

  const countByLevel = useMemo(() => {
    const c: Record<UserLevel, number> = { SYSTEM: 0, WARD: 0, HAMLET: 0 };
    for (const u of users) if (matchesDepartment(u)) c[levelOf(u)]++;
    return c;
  }, [users, matchesDepartment]);

  // Mở từ trang Phòng ban (có `departmentId`, không chỉ định tab): tự mở tab đầu tiên có nhân sự của phòng ban đó.
  const autoTabDone = useRef(false);
  useEffect(() => {
    if (autoTabDone.current || loading || !departmentFilter || readUrlParam('tab')) return;
    autoTabDone.current = true;
    const first = TABS.find((t) => countByLevel[t.level] > 0);
    if (first && first.key !== tab) setTabState(first.key);
  }, [loading, departmentFilter, countByLevel, tab]);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        levelOf(u) === current.level &&
        (!wardFilter || u.wardId === wardFilter) &&
        (!hamletFilter || u.hamletId === hamletFilter) &&
        matchesDepartment(u) &&
        (!q || u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)),
    );
  }, [users, current.level, wardFilter, hamletFilter, matchesDepartment, search]);

  // `editing` = null: đóng; 'new': thêm mới; UserSummary: sửa.
  const [editing, setEditing] = useState<UserSummary | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(UserLevel.WARD));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    // Thêm mới ở tab nào thì mặc định cấp và xã/ấp theo tab và bộ lọc đang chọn.
    setForm({
      ...emptyForm(current.level),
      wardId: wardFilter,
      hamletId: hamletFilter,
      departmentId: departmentFilter && departmentFilter !== NO_DEPARTMENT ? departmentFilter : '',
    });
    setFormError(null);
    setEditing('new');
  }

  function openEdit(u: UserSummary) {
    setForm({
      username: u.username,
      password: '',
      fullName: u.fullName,
      roleIds: u.roles?.map((r) => r.id) ?? [],
      departmentId: u.departmentId ?? '',
      unit: u.unit ?? '',
      position: u.position ?? '',
      isActive: u.isActive,
      level: levelOf(u),
      wardId: u.wardId ?? '',
      hamletId: u.hamletId ?? '',
    });
    setFormError(null);
    setEditing(u);
  }

  function toggleRole(roleId: string) {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  }

  /** Đổi cấp/xã/ấp trong form: phòng ban đang chọn không còn hợp lệ ở địa bàn mới thì tự bỏ chọn. */
  function setLocation(patch: Partial<Pick<FormState, 'level' | 'wardId' | 'hamletId'>>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const dept = departments.find((d) => d.id === next.departmentId);
      if (dept && !departmentFits(dept, next.level, next.wardId, next.hamletId)) next.departmentId = '';
      return next;
    });
  }

  /** Xã/ấp gửi lên theo cấp: hệ thống không gắn địa bàn; ấp/thôn chỉ cần ấp (xã API tự lấy). */
  function locationPayload() {
    if (form.level === UserLevel.SYSTEM) return { level: form.level, wardId: null, hamletId: null };
    if (form.level === UserLevel.WARD) return { level: form.level, wardId: form.wardId || null, hamletId: null };
    return { level: form.level, wardId: form.wardId || null, hamletId: form.hamletId || null };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing === null) return;
    if (form.roleIds.length === 0) {
      setFormError('Phải chọn ít nhất một vai trò');
      return;
    }
    if (form.level === UserLevel.WARD && !form.wardId) {
      setFormError('Chọn xã/phường cho nhân sự UBND xã');
      return;
    }
    if (form.level === UserLevel.HAMLET && !form.hamletId) {
      setFormError('Chọn ấp/thôn cho nhân sự ấp/thôn');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await usersApi.create({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          roleIds: form.roleIds,
          ...(form.level === UserLevel.SYSTEM
            ? { departmentId: null, unit: form.unit.trim() || undefined }
            : { departmentId: form.departmentId || null }),
          position: form.position.trim() || undefined,
          ...locationPayload(),
        });
      } else {
        await usersApi.update(editing.id, {
          fullName: form.fullName.trim(),
          roleIds: form.roleIds,
          ...(form.level === UserLevel.SYSTEM
            ? // Tài khoản hệ thống không thuộc phòng ban — đơn vị gõ tự do.
              { departmentId: null, unit: form.unit.trim() }
            : {
                departmentId: form.departmentId || null,
                // Bỏ gán phòng ban thì xóa luôn đơn vị (đang là tên phòng ban cũ); chưa từng gán thì giữ chữ cũ.
                ...(!form.departmentId && editing.departmentId ? { unit: '' } : {}),
              }),
          position: form.position.trim(),
          isActive: form.isActive,
          // Để trống = giữ nguyên mật khẩu hiện tại.
          password: form.password || undefined,
          ...locationPayload(),
        });
      }
      setEditing(null);
      // Vừa chuyển cấp → mở tab của cấp mới để thấy ngay tài khoản vừa sửa.
      if (form.level !== current.level) setTab(TAB_BY_LEVEL[form.level]);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  }

  const isNew = editing === 'new';
  // Không cho tự khóa hay tự hạ cấp chính mình (API cũng chặn) — tránh mất quyền quản trị.
  const isSelf = editing !== null && editing !== 'new' && editing.id === user?.id;
  const formHamlets = hamlets.filter((h) => !form.wardId || h.wardId === form.wardId);
  // Phòng ban chọn được: đúng cấp, đúng địa bàn (cấp xã ↔ nhân sự UBND xã đó; cấp ấp ↔ nhân sự ấp đó).
  // Giữ phòng ban hiện tại trong danh sách kể cả đã ngừng sử dụng/chưa phân cấp, để không tự mất khi mở form.
  const formDepartments = departments.filter(
    (d) => d.id === form.departmentId || (d.isActive && departmentFits(d, form.level, form.wardId, form.hamletId)),
  );
  const selectedDepartment = departments.find((d) => d.id === form.departmentId);
  // Không khớp mà là lựa chọn mới hoặc vừa đổi cấp/địa bàn → API sẽ từ chối; báo trước trên form.
  const locationEdited =
    editing !== null &&
    editing !== 'new' &&
    (form.level !== levelOf(editing) ||
      form.wardId !== (editing.wardId ?? '') ||
      form.hamletId !== (editing.hamletId ?? ''));
  const departmentMismatch =
    !!selectedDepartment &&
    !departmentFits(selectedDepartment, form.level, form.wardId, form.hamletId) &&
    (editing === 'new' || selectedDepartment.id !== editing?.departmentId || locationEdited);
  const filterHamlets = hamlets.filter((h) => !wardFilter || h.wardId === wardFilter);

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Quản lý người dùng"
        subtitle={current.subtitle}
        actions={
          <button
            onClick={openNew}
            className="bg-brand hover:bg-brand/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm {current.label.toLowerCase()}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={TABS.map((t) => ({
              value: t.key,
              label: (
                <span className="whitespace-nowrap">
                  {t.label} <span className="text-fg-subtle tabular-nums">({countByLevel[t.level]})</span>
                </span>
              ),
            }))}
          />
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo họ tên, tên đăng nhập"
          className={`${FIELD_CLASS} w-full sm:w-64`}
        />
        {current.level !== UserLevel.SYSTEM && (
          <select
            value={wardFilter}
            onChange={(e) => {
              setWardFilter(e.target.value);
              setHamletFilter('');
            }}
            className={`${FIELD_CLASS} w-full sm:w-52`}
            aria-label="Lọc theo xã/phường"
          >
            <option value="">Tất cả xã/phường</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className={`${FIELD_CLASS} w-full sm:w-56`}
          aria-label="Lọc theo phòng ban"
        >
          <option value="">Tất cả phòng ban</option>
          <option value={NO_DEPARTMENT}>— Chưa gán phòng ban —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {departmentLabel(d)}
            </option>
          ))}
        </select>
        {current.level === UserLevel.HAMLET && (
          <select
            value={hamletFilter}
            onChange={(e) => setHamletFilter(e.target.value)}
            className={`${FIELD_CLASS} w-full sm:w-52`}
            aria-label="Lọc theo ấp/thôn"
          >
            <option value="">Tất cả ấp/thôn</option>
            {filterHamlets.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
                {!wardFilter && wardName.get(h.wardId) ? ` — ${wardName.get(h.wardId)}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadError && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
          {loadError}
        </div>
      )}

      <div className="glass overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-subtle">
            <ButtonSpinner /> Đang tải…
          </div>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            text={
              countByLevel[current.level] === 0
                ? `Chưa có tài khoản nào trong mục "${current.label}"`
                : 'Không có tài khoản nào khớp bộ lọc'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase text-fg-muted text-left">
              <tr>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Tên đăng nhập</th>
                <th className="px-4 py-2.5">Vai trò</th>
                {current.level !== UserLevel.SYSTEM && <th className="px-4 py-2.5">Xã/phường</th>}
                {current.level === UserLevel.HAMLET && <th className="px-4 py-2.5">Ấp/thôn</th>}
                <th className="px-4 py-2.5">{current.level === UserLevel.SYSTEM ? 'Đơn vị' : 'Phòng ban'}</th>
                <th className="px-4 py-2.5">Chức vụ</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleUsers.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'text-fg-subtle'}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar chữ cái đầu + chấm trạng thái hoạt động. */}
                      <span className="relative w-8 h-8 rounded-full bg-brand-gradient text-white text-xs font-bold grid place-items-center shrink-0">
                        {u.fullName.trim()[0]?.toUpperCase() ?? '?'}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-surface ${
                            u.isActive ? 'bg-ok shadow-glow-ok' : 'bg-fg-subtle'
                          }`}
                        />
                      </span>
                      <span className="font-semibold">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{u.username}</td>
                  <td className="px-4 py-2.5">
                    {u.roles?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <StatusBadge key={r.id} tone={ROLE_TONE[r.code] ?? 'neutral'}>
                            <span className="whitespace-nowrap">{r.name}</span>
                          </StatusBadge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  {current.level !== UserLevel.SYSTEM && (
                    <td className="px-4 py-2.5">{u.ward?.name ?? <span className="text-danger">Chưa gán</span>}</td>
                  )}
                  {current.level === UserLevel.HAMLET && (
                    <td className="px-4 py-2.5">
                      {u.hamlet?.name ?? <span className="text-danger">Chưa gán — không xem được dữ liệu ấp</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    {u.department?.name ??
                      (u.unit && current.level === UserLevel.SYSTEM ? (
                        u.unit
                      ) : u.unit ? (
                        <span title="Đơn vị gõ tự do từ trước — sửa tài khoản để chọn phòng ban trong danh mục">
                          {u.unit}{' '}
                          <span className="text-[10px] font-semibold text-warn whitespace-nowrap">chưa chuẩn hóa</span>
                        </span>
                      ) : (
                        '—'
                      ))}
                  </td>
                  <td className="px-4 py-2.5">{u.position ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                        u.isActive ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-fg-muted'
                      }`}
                    >
                      {u.isActive ? 'Đang hoạt động' : 'Đã khoá'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div
          className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl shadow-soft w-full max-w-md max-h-[90vh] overflow-auto"
          >
            <div className="px-5 py-4 bg-shell text-fg border-b border-line text-sm font-bold rounded-t-2xl">
              {isNew ? `Thêm ${USER_LEVEL_LABELS[form.level].toLowerCase()}` : `Sửa: ${form.username}`}
            </div>
            <div className="p-5 space-y-3">
              <FormField label="Tên đăng nhập" required>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!isNew}
                  required
                  minLength={3}
                  className={`${FIELD_CLASS} disabled:bg-surface-2`}
                />
              </FormField>
              <FormField label={isNew ? 'Mật khẩu' : 'Đặt lại mật khẩu'} required={isNew}>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={isNew}
                  minLength={6}
                  placeholder={isNew ? 'Tối thiểu 6 ký tự' : 'Để trống nếu không đổi'}
                  autoComplete="new-password"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Họ tên" required>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  minLength={2}
                  className={FIELD_CLASS}
                />
              </FormField>

              <FormField label="Cấp tài khoản" required>
                <select
                  value={form.level}
                  onChange={(e) => setLocation({ level: e.target.value as UserLevel })}
                  disabled={isSelf}
                  className={`${FIELD_CLASS} disabled:bg-surface-2`}
                >
                  {TABS.map((t) => (
                    <option key={t.level} value={t.level}>
                      {USER_LEVEL_LABELS[t.level]}
                    </option>
                  ))}
                </select>
                {isSelf && (
                  <p className="text-[11px] text-fg-subtle mt-1">Không thể tự chuyển tài khoản của chính mình khỏi cấp hệ thống.</p>
                )}
              </FormField>
              {form.level !== UserLevel.SYSTEM && (
                <FormField label="Xã/phường" required>
                  <select
                    value={form.wardId}
                    onChange={(e) => setLocation({ wardId: e.target.value, hamletId: '' })}
                    required
                    className={FIELD_CLASS}
                  >
                    <option value="">— Chọn xã/phường —</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              {form.level === UserLevel.HAMLET && (
                <FormField label="Ấp/thôn" required>
                  <select
                    value={form.hamletId}
                    onChange={(e) => setLocation({ hamletId: e.target.value })}
                    required
                    disabled={!form.wardId}
                    className={`${FIELD_CLASS} disabled:bg-surface-2`}
                  >
                    <option value="">{form.wardId ? '— Chọn ấp/thôn —' : 'Chọn xã/phường trước'}</option>
                    {formHamlets.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-fg-subtle mt-1 leading-relaxed">
                    Nhân sự ấp/thôn chỉ xem và ghi nhận dữ liệu trong ấp này, cùng các nhiệm vụ khảo sát/thi công
                    được giao cho mình. Các quyền quản lý cấp xã không áp dụng dù vai trò có gán: quản lý tài khoản,
                    vai trò, cấu hình, danh mục địa chỉ, tuyến đường, phương án đánh số, giao việc và nghiệm thu
                    khảo sát/thi công, nhắc việc.
                  </p>
                </FormField>
              )}
              {form.level === UserLevel.WARD && (
                <p className="text-[11px] text-fg-subtle -mt-1 leading-relaxed">
                  Nhân sự UBND xã xem được dữ liệu toàn hệ thống nhưng không quản lý được tài khoản và vai trò.
                </p>
              )}

              <FormField label="Vai trò" required>
                <div className="space-y-1.5 rounded-lg border border-line p-2.5 max-h-44 overflow-auto">
                  {roles.length === 0 ? (
                    <p className="text-xs text-fg-subtle">Chưa có vai trò nào — tạo ở mục Vai trò & phân quyền.</p>
                  ) : (
                    roles.map((r) => (
                      <label key={r.id} className="flex items-center gap-2.5 text-sm text-fg">
                        <ToggleSwitch
                          checked={form.roleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                          label={r.name}
                        />
                        <span>{r.name}</span>
                        {r.isSystem && (
                          <span className="text-[10px] text-fg-subtle uppercase">hệ thống</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </FormField>
              {form.level === UserLevel.SYSTEM ? (
                <FormField label="Đơn vị">
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="vd Sở Xây dựng, Văn phòng UBND tỉnh"
                    className={FIELD_CLASS}
                  />
                  <p className="text-[11px] text-fg-subtle mt-1">Tài khoản hệ thống không thuộc phòng ban — ghi đơn vị công tác tự do.</p>
                </FormField>
              ) : (
                <FormField label="Phòng ban">
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className={FIELD_CLASS}
                  >
                    <option value="">— Không thuộc phòng ban —</option>
                    {formDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {departmentLabel(d)}
                        {d.isActive ? '' : ' (ngừng sử dụng)'}
                      </option>
                    ))}
                  </select>
                  {departmentMismatch ? (
                    <p className="text-[11px] text-danger mt-1">
                      {!selectedDepartment?.level
                        ? 'Phòng ban này chưa phân cấp — vào mục Phòng ban chọn cấp xã/ấp trước, hoặc chọn phòng ban khác.'
                        : form.level === UserLevel.WARD
                          ? 'Nhân sự UBND xã chỉ thuộc phòng ban cấp xã của đúng xã đang chọn.'
                          : 'Nhân sự ấp/thôn chỉ thuộc phòng ban cấp ấp của đúng ấp đang chọn.'}
                    </p>
                  ) : (
                    editing !== 'new' &&
                    !editing.departmentId &&
                    editing.unit && (
                      <p className="text-[11px] text-fg-subtle mt-1">
                        Đơn vị cũ (gõ tự do): <b>{editing.unit}</b> — chọn phòng ban tương ứng để chuẩn hóa.
                      </p>
                    )
                  )}
                  {formDepartments.length === 0 && (
                    <p className="text-[11px] text-fg-subtle mt-1">
                      {form.level === UserLevel.WARD
                        ? form.wardId
                          ? 'Xã này chưa có phòng ban cấp xã.'
                          : 'Chọn xã/phường để xem phòng ban.'
                        : form.hamletId
                          ? 'Ấp này chưa có phòng ban cấp ấp/thôn.'
                          : 'Chọn ấp/thôn để xem phòng ban.'}
                    </p>
                  )}
                  <p className="text-[11px] text-fg-subtle mt-1">
                    Thêm/sửa danh mục ở mục <a href="/houses/departments" className="text-accent hover:underline">Phòng ban</a>.
                  </p>
                </FormField>
              )}
              <FormField label="Chức vụ">
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className={FIELD_CLASS}
                />
              </FormField>
              {!isNew && (
                <label className="flex items-center gap-2.5 text-sm text-fg">
                  <ToggleSwitch
                    checked={form.isActive}
                    disabled={isSelf}
                    onChange={(v) => setForm({ ...form, isActive: v })}
                    label="Tài khoản đang hoạt động"
                  />
                  Tài khoản đang hoạt động{isSelf && ' (không thể tự khóa chính mình)'}
                </label>
              )}
              {editing !== 'new' &&
                (form.level !== levelOf(editing) ||
                  (form.level === UserLevel.WARD && form.wardId !== (editing.wardId ?? '')) ||
                  (form.level === UserLevel.HAMLET && form.hamletId !== (editing.hamletId ?? ''))) && (
                <p className="text-[11px] text-warn">
                  Đổi cấp hoặc địa bàn sẽ đăng xuất người này khỏi mọi thiết bị để áp dụng phạm vi dữ liệu mới.
                </p>
              )}
              {formError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-2.5 text-sm">
                  {formError}
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-fg-muted hover:bg-surface-2"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                {saving && <ButtonSpinner light />}
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
