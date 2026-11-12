'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEPARTMENT_LEVEL_LABELS, PERMISSIONS } from '@tayninh/shared';
import type { Department, DepartmentLevel, Hamlet, Ward } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { useConfirmDialog } from '@/components/ConfirmDialogProvider';
import { ApiError } from '@/lib/api';
import { departmentsApi } from '@/lib/departments-api';
import { hamletsApi, wardsApi } from '@/lib/addresses-api';
import {
  ButtonSpinner,
  EmptyState,
  FIELD_CLASS,
  FormField,
  PageHeader,
  SegmentedControl,
  ToggleSwitch,
} from '@/components/ui';

interface FormState {
  name: string;
  /** '' = chưa chọn (chỉ gặp khi sửa phòng ban cấp tỉnh cũ chưa phân cấp). */
  level: DepartmentLevel | '';
  wardId: string;
  hamletId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { name: '', level: 'WARD', wardId: '', hamletId: '', isActive: true };

/** Bộ lọc cấp: '' = tất cả, 'UNSET' = chưa phân cấp. */
type LevelFilter = '' | DepartmentLevel | 'UNSET';

const UNSET_LABEL = 'Chưa phân cấp';

/** "Thuộc": tên xã (cấp xã) hoặc "ấp — xã" (cấp ấp). */
function placeOf(d: Department): string {
  if (d.level === 'HAMLET') return `${d.hamlet?.name ?? '—'} — ${d.ward?.name ?? ''}`;
  if (d.level === 'WARD') return d.ward?.name ?? '—';
  return '—';
}

/**
 * Danh mục phòng ban — mỗi phòng ban thuộc UBND một xã (cấp xã) hoặc một ấp/thôn (cấp ấp). Dùng để chọn phòng
 * ban cho nhân sự đúng cấp, đúng địa bàn ở trang Người dùng; không ảnh hưởng quyền hay phạm vi dữ liệu.
 * Phòng ban cấp tỉnh cũ (tạo từ ô "Đơn vị") hiện là "Chưa phân cấp" để admin chọn cấp hoặc xóa.
 */
export default function DepartmentsPage() {
  const { user, hasPermission } = useAuth();
  const { confirm } = useConfirmDialog();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.USER_MANAGE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [items, setItems] = useState<Department[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, wardList, hamletList] = await Promise.all([
        departmentsApi.list(),
        wardsApi.list(),
        hamletsApi.list(),
      ]);
      setItems(list);
      setWards(wardList);
      setHamlets(hamletList);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh sách phòng ban');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Không gọi API khi không có quyền (trang đang chuyển hướng).
    if (canManage) load();
  }, [load, canManage]);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('');
  const [wardFilter, setWardFilter] = useState('');

  const unsetCount = items.filter((d) => !d.level).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (d) =>
        (!levelFilter || (levelFilter === 'UNSET' ? !d.level : d.level === levelFilter)) &&
        (!wardFilter || d.wardId === wardFilter) &&
        (!q || d.name.toLowerCase().includes(q)),
    );
  }, [items, levelFilter, wardFilter, search]);

  // `editing` = null: đóng; 'new': thêm mới; Department: sửa.
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    // Đang lọc theo cấp/xã thì phòng ban mới mặc định theo bộ lọc đó.
    setForm({
      ...EMPTY_FORM,
      level: levelFilter === 'HAMLET' ? 'HAMLET' : 'WARD',
      wardId: wardFilter,
    });
    setFormError(null);
    setEditing('new');
  }

  function openEdit(d: Department) {
    setForm({
      name: d.name,
      level: d.level ?? '',
      wardId: d.wardId ?? '',
      hamletId: d.hamletId ?? '',
      isActive: d.isActive,
    });
    setFormError(null);
    setEditing(d);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing === null) return;
    if (!form.level) {
      setFormError('Chọn cấp cho phòng ban: cấp xã hoặc cấp ấp/thôn');
      return;
    }
    if (!form.wardId) {
      setFormError('Chọn xã/phường');
      return;
    }
    if (form.level === 'HAMLET' && !form.hamletId) {
      setFormError('Chọn ấp/thôn');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const dto = {
        name: form.name.trim(),
        level: form.level,
        wardId: form.wardId,
        hamletId: form.level === 'HAMLET' ? form.hamletId : null,
      };
      if (editing === 'new') await departmentsApi.create(dto);
      else await departmentsApi.update(editing.id, { ...dto, isActive: form.isActive });
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d: Department) {
    if (!(await confirm(`Xóa phòng ban "${d.name}"?`))) return;
    setActionError(null);
    try {
      await departmentsApi.remove(d.id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  const isNew = editing === 'new';
  const editingCount = editing && editing !== 'new' ? (editing._count?.users ?? 0) : 0;
  const formHamlets = hamlets.filter((h) => h.wardId === form.wardId);

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Phòng ban"
        subtitle="Danh mục phòng ban của UBND xã và của ấp/thôn — dùng để gán cho nhân sự đúng cấp, đúng địa bàn"
        actions={
          <button
            onClick={openNew}
            className="bg-brand hover:bg-brand/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm phòng ban
          </button>
        }
      />

      {unsetCount > 0 && (
        <div className="bg-warn/10 border border-warn/30 text-fg rounded-lg p-3 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Có <b>{unsetCount}</b> phòng ban <b>chưa phân cấp</b> (tạo từ ô &quot;Đơn vị&quot; cũ, trước đây là cấp
            tỉnh). Bấm &quot;Phân cấp&quot; để chọn cấp xã hoặc ấp/thôn, hoặc xóa nếu không dùng. Chưa phân cấp thì không
            gán được cho tài khoản mới.
          </span>
          {levelFilter !== 'UNSET' && (
            <button onClick={() => setLevelFilter('UNSET')} className="text-xs font-semibold text-accent hover:underline">
              Xem các phòng ban này
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<LevelFilter>
          value={levelFilter}
          onChange={setLevelFilter}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'WARD', label: DEPARTMENT_LEVEL_LABELS.WARD },
            { value: 'HAMLET', label: DEPARTMENT_LEVEL_LABELS.HAMLET },
            ...(unsetCount > 0 ? [{ value: 'UNSET' as const, label: `${UNSET_LABEL} (${unsetCount})` }] : []),
          ]}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên phòng ban"
          className={`${FIELD_CLASS} w-full sm:w-64`}
        />
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className={`${FIELD_CLASS} w-full sm:w-56`}
          aria-label="Lọc theo xã/phường"
        >
          <option value="">Tất cả xã/phường</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {(loadError || actionError) && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
          {loadError ?? actionError}
        </div>
      )}

      <div className="glass overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-subtle">
            <ButtonSpinner /> Đang tải…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState text={items.length === 0 ? 'Chưa có phòng ban nào' : 'Không có phòng ban nào khớp bộ lọc'} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase text-fg-muted text-left">
              <tr>
                <th className="px-4 py-2.5">Tên phòng ban</th>
                <th className="px-4 py-2.5">Cấp</th>
                <th className="px-4 py-2.5">Thuộc</th>
                <th className="px-4 py-2.5 text-right">Nhân sự</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((d) => {
                const count = d._count?.users ?? 0;
                return (
                  <tr key={d.id} className={d.isActive ? '' : 'text-fg-subtle'}>
                    <td className="px-4 py-2.5 font-semibold">{d.name}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {d.level ? (
                        DEPARTMENT_LEVEL_LABELS[d.level]
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-warn/15 text-warn">{UNSET_LABEL}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{placeOf(d)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {count > 0 ? (
                        <Link
                          href={`/houses/users?departmentId=${d.id}`}
                          className="font-semibold text-accent hover:underline"
                          title="Xem danh sách nhân sự"
                        >
                          {count}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap ${
                          d.isActive ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-fg-muted'
                        }`}
                      >
                        {d.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-3">
                      <button onClick={() => openEdit(d)} className="text-xs font-semibold text-accent hover:underline">
                        {d.level ? 'Sửa' : 'Phân cấp'}
                      </button>
                      {count === 0 && (
                        <button
                          onClick={() => handleDelete(d)}
                          className="text-xs font-semibold text-danger hover:underline"
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
              {isNew ? 'Thêm phòng ban' : `Sửa: ${editing.name}`}
            </div>
            <div className="p-5 space-y-3">
              {!isNew && !editing.level && (
                <p className="text-xs bg-warn/10 border border-warn/30 rounded-lg p-2.5 leading-relaxed">
                  Phòng ban này chưa phân cấp (trước đây là cấp tỉnh). Chọn cấp xã hoặc cấp ấp/thôn cho phù hợp; mọi
                  nhân sự đang thuộc phòng ban phải ở đúng xã/ấp đã chọn.
                </p>
              )}
              <FormField label="Tên phòng ban" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={200}
                  placeholder="vd Văn phòng HĐND-UBND, Ban nhân dân ấp"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Cấp" required>
                <SegmentedControl<DepartmentLevel>
                  value={form.level === '' ? ('' as DepartmentLevel) : form.level}
                  onChange={(level) => setForm({ ...form, level, hamletId: level === 'WARD' ? '' : form.hamletId })}
                  options={[
                    { value: 'WARD', label: DEPARTMENT_LEVEL_LABELS.WARD },
                    { value: 'HAMLET', label: DEPARTMENT_LEVEL_LABELS.HAMLET },
                  ]}
                />
                <p className="text-[11px] text-fg-subtle mt-1 leading-relaxed">
                  {form.level === 'HAMLET'
                    ? 'Phòng ban cấp ấp/thôn chỉ gán cho nhân sự của đúng ấp/thôn đó.'
                    : form.level === 'WARD'
                      ? 'Phòng ban cấp xã chỉ gán cho nhân sự UBND của đúng xã/phường đó.'
                      : 'Chọn cấp xã hoặc cấp ấp/thôn.'}
                </p>
              </FormField>
              <FormField label="Xã/phường" required>
                <select
                  value={form.wardId}
                  onChange={(e) => setForm({ ...form, wardId: e.target.value, hamletId: '' })}
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
              {form.level === 'HAMLET' && (
                <FormField label="Ấp/thôn" required>
                  <select
                    value={form.hamletId}
                    onChange={(e) => setForm({ ...form, hamletId: e.target.value })}
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
                </FormField>
              )}
              {!isNew && (
                <label className="flex items-center gap-2.5 text-sm text-fg">
                  <ToggleSwitch
                    checked={form.isActive}
                    onChange={(v) => setForm({ ...form, isActive: v })}
                    label="Đang sử dụng"
                  />
                  Đang sử dụng
                </label>
              )}
              {!isNew && !form.isActive && editingCount > 0 && (
                <p className="text-[11px] text-fg-subtle">
                  Ngừng sử dụng: {editingCount} nhân sự hiện tại vẫn giữ phòng ban này, nhưng không chọn được cho tài khoản mới.
                </p>
              )}
              {!isNew && editingCount > 0 && form.name.trim() !== editing.name && (
                <p className="text-[11px] text-warn">
                  Đổi tên sẽ cập nhật đơn vị hiển thị của {editingCount} nhân sự trong phòng ban.
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
