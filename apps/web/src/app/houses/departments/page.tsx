'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import type { Department, Ward } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { departmentsApi } from '@/lib/departments-api';
import { wardsApi } from '@/lib/addresses-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, PageHeader, ToggleSwitch } from '@/components/ui';

interface FormState {
  name: string;
  /** '' = cấp tỉnh. */
  wardId: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { name: '', wardId: '', isActive: true };

/** Bộ lọc "Thuộc": '' = tất cả, 'province' = cấp tỉnh, còn lại = id xã. */
type ScopeFilter = string;

/**
 * Danh mục phòng ban — dùng để chọn phòng ban cho tài khoản ở trang Người dùng (thay cho ô "Đơn vị" gõ
 * tự do). Không ảnh hưởng quyền hay phạm vi dữ liệu. Cùng quyền với quản lý người dùng.
 */
export default function DepartmentsPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.USER_MANAGE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [items, setItems] = useState<Department[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, wardList] = await Promise.all([departmentsApi.list(), wardsApi.list()]);
      setItems(list);
      setWards(wardList);
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
  const [scope, setScope] = useState<ScopeFilter>('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (d) =>
        (!scope || (scope === 'province' ? d.wardId === null : d.wardId === scope)) &&
        (!q || d.name.toLowerCase().includes(q)),
    );
  }, [items, scope, search]);

  // `editing` = null: đóng; 'new': thêm mới; Department: sửa.
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    // Đang lọc theo 1 xã thì phòng ban mới mặc định thuộc xã đó.
    setForm({ ...EMPTY_FORM, wardId: scope && scope !== 'province' ? scope : '' });
    setFormError(null);
    setEditing('new');
  }

  function openEdit(d: Department) {
    setForm({ name: d.name, wardId: d.wardId ?? '', isActive: d.isActive });
    setFormError(null);
    setEditing(d);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing === null) return;
    setSaving(true);
    setFormError(null);
    try {
      const dto = { name: form.name.trim(), wardId: form.wardId || null };
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
    if (!confirm(`Xóa phòng ban "${d.name}"?`)) return;
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

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Phòng ban"
        subtitle="Danh mục phòng ban để gán cho tài khoản — cấp tỉnh hoặc thuộc từng UBND xã"
        actions={
          <button
            onClick={openNew}
            className="bg-brand hover:bg-brand/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm phòng ban
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên phòng ban"
          className={`${FIELD_CLASS} w-full sm:w-64`}
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className={`${FIELD_CLASS} w-full sm:w-56`}
          aria-label="Lọc theo nơi trực thuộc"
        >
          <option value="">Tất cả</option>
          <option value="province">Cấp tỉnh</option>
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
                    <td className="px-4 py-2.5 whitespace-nowrap">{d.ward?.name ?? 'Cấp tỉnh'}</td>
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
                        Sửa
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
              <FormField label="Tên phòng ban" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={200}
                  placeholder="vd Phòng Kinh tế, Văn phòng HĐND-UBND"
                  className={FIELD_CLASS}
                />
              </FormField>
              <FormField label="Thuộc">
                <select
                  value={form.wardId}
                  onChange={(e) => setForm({ ...form, wardId: e.target.value })}
                  className={FIELD_CLASS}
                >
                  <option value="">Cấp tỉnh</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>
                      UBND {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-fg-subtle mt-1 leading-relaxed">
                  Phòng ban cấp tỉnh gán được cho mọi tài khoản. Phòng ban của một xã chỉ gán cho nhân sự thuộc xã đó.
                </p>
              </FormField>
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
