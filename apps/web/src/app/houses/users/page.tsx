'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import type { RoleSummary, UserSummary } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { usersApi } from '@/lib/users-api';
import { rolesApi } from '@/lib/roles-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, PageHeader, StatusBadge, ToggleSwitch, type StatusTone } from '@/components/ui';

interface FormState {
  username: string;
  password: string;
  fullName: string;
  roleIds: string[];
  unit: string;
  position: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  username: '',
  password: '',
  fullName: '',
  roleIds: [],
  unit: '',
  position: '',
  isActive: true,
};

/**
 * Quản lý người dùng — cần quyền user:manage. PHASE 17: gán NHIỀU vai trò động
 * (chọn từ danh sách vai trò do admin quản trị ở /houses/roles).
 */
/** Màu tag vai trò hệ thống (UI.md). Vai trò tự tạo dùng màu trung tính. */
const ROLE_TONE: Record<string, StatusTone> = {
  admin: 'danger',
  cadastral: 'accent',
  surveyor: 'ok',
};

export default function UsersAdminPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.USER_MANAGE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [userList, roleList] = await Promise.all([usersApi.list(), rolesApi.list()]);
      setUsers(userList);
      setRoles(roleList.filter((r) => r.isActive));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // `editing` = null: đóng; 'new': thêm mới; UserSummary: sửa.
  const [editing, setEditing] = useState<UserSummary | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing('new');
  }

  function openEdit(u: UserSummary) {
    setForm({
      username: u.username,
      password: '',
      fullName: u.fullName,
      roleIds: u.roles?.map((r) => r.id) ?? [],
      unit: u.unit ?? '',
      position: u.position ?? '',
      isActive: u.isActive,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing === null) return;
    if (form.roleIds.length === 0) {
      setFormError('Phải chọn ít nhất một vai trò');
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
          unit: form.unit.trim() || undefined,
          position: form.position.trim() || undefined,
        });
      } else {
        await usersApi.update(editing.id, {
          fullName: form.fullName.trim(),
          roleIds: form.roleIds,
          unit: form.unit.trim(),
          position: form.position.trim(),
          isActive: form.isActive,
          // Để trống = giữ nguyên mật khẩu hiện tại.
          password: form.password || undefined,
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  }

  const isNew = editing === 'new';
  // Không cho tự khóa chính mình (API cũng chặn) — tránh mất quyền quản trị.
  const isSelf = editing !== null && editing !== 'new' && editing.id === user?.id;

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Quản lý người dùng"
        subtitle="Tạo tài khoản cán bộ và gán vai trò (có thể nhiều vai trò)"
        actions={
          <button
            onClick={openNew}
            className="bg-brand hover:bg-brand/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm người dùng
          </button>
        }
      />

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
        ) : users.length === 0 ? (
          <EmptyState text="Chưa có người dùng nào" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase text-fg-muted text-left">
              <tr>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Tên đăng nhập</th>
                <th className="px-4 py-2.5">Vai trò</th>
                <th className="px-4 py-2.5">Đơn vị</th>
                <th className="px-4 py-2.5">Chức vụ</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
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
                            {r.name}
                          </StatusBadge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5">{u.unit ?? '—'}</td>
                  <td className="px-4 py-2.5">{u.position ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
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
              {isNew ? 'Thêm người dùng' : `Sửa: ${form.username}`}
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
              <FormField label="Đơn vị">
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={FIELD_CLASS}
                />
              </FormField>
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
