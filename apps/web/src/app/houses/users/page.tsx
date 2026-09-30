'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import type { RoleSummary, UserSummary } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { usersApi } from '@/lib/users-api';
import { rolesApi } from '@/lib/roles-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, PageHeader } from '@/components/ui';

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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm người dùng
          </button>
        }
      />

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <ButtonSpinner /> Đang tải…
          </div>
        ) : users.length === 0 ? (
          <EmptyState text="Chưa có người dùng nào" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 text-left">
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
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'text-slate-400'}>
                  <td className="px-4 py-2.5 font-semibold">{u.fullName}</td>
                  <td className="px-4 py-2.5">{u.username}</td>
                  <td className="px-4 py-2.5">
                    {u.roles?.length ? u.roles.map((r) => r.name).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5">{u.unit ?? '—'}</td>
                  <td className="px-4 py-2.5">{u.position ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {u.isActive ? 'Đang hoạt động' : 'Đã khoá'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
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
          className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-soft w-full max-w-md max-h-[90vh] overflow-auto"
          >
            <div className="px-5 py-4 bg-slate-900 text-white text-sm font-bold rounded-t-2xl">
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
                  className={`${FIELD_CLASS} disabled:bg-slate-100`}
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
                <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5 max-h-44 overflow-auto">
                  {roles.length === 0 ? (
                    <p className="text-xs text-slate-400">Chưa có vai trò nào — tạo ở mục Vai trò & phân quyền.</p>
                  ) : (
                    roles.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.roleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                        />
                        <span>{r.name}</span>
                        {r.isSystem && (
                          <span className="text-[10px] text-slate-400 uppercase">hệ thống</span>
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
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    disabled={isSelf}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Tài khoản đang hoạt động{isSelf && ' (không thể tự khóa chính mình)'}
                </label>
              )}
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-sm">
                  {formError}
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
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
