'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import type { PermissionDef, RoleSummary } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { rolesApi } from '@/lib/roles-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField, PageHeader, ToggleSwitch } from '@/components/ui';

interface RoleForm {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  permissionCodes: string[];
}

const EMPTY_FORM: RoleForm = {
  code: '',
  name: '',
  description: '',
  isActive: true,
  permissionCodes: [],
};

/** PHASE 17 — Quản trị vai trò động + gán quyền. Cần quyền role:manage. */
export default function RolesAdminPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.ROLE_MANAGE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [roleList, permList] = await Promise.all([rolesApi.list(), rolesApi.listPermissions()]);
      setRoles(roleList);
      setPermissions(permList);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu vai trò');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nhóm quyền theo `group` để hiển thị ma trận.
  const permissionGroups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group)!.push(p);
    }
    return [...map.entries()];
  }, [permissions]);

  const [editing, setEditing] = useState<RoleSummary | 'new' | null>(null);
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openNew() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing('new');
  }

  function openEdit(r: RoleSummary) {
    setForm({
      code: r.code,
      name: r.name,
      description: r.description ?? '',
      isActive: r.isActive,
      permissionCodes: [...r.permissionCodes],
    });
    setFormError(null);
    setEditing(r);
  }

  function togglePermission(code: string) {
    setForm((prev) => ({
      ...prev,
      permissionCodes: prev.permissionCodes.includes(code)
        ? prev.permissionCodes.filter((c) => c !== code)
        : [...prev.permissionCodes, code],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing === null) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await rolesApi.create({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissionCodes: form.permissionCodes,
        });
      } else {
        await rolesApi.update(editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          isActive: form.isActive,
        });
        await rolesApi.setPermissions(editing.id, { permissionCodes: form.permissionCodes });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được vai trò');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: RoleSummary) {
    if (!window.confirm(`Xóa vai trò "${r.name}"?`)) return;
    try {
      await rolesApi.remove(r.id);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được vai trò');
    }
  }

  const isNew = editing === 'new';

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <PageHeader
        title="Vai trò & phân quyền"
        subtitle="Tạo vai trò và gán quyền linh hoạt — không cần sửa mã nguồn"
        actions={
          <button
            onClick={openNew}
            className="bg-brand hover:bg-brand/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            + Thêm vai trò
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
        ) : roles.length === 0 ? (
          <EmptyState text="Chưa có vai trò nào" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase text-fg-muted text-left">
              <tr>
                <th className="px-4 py-2.5">Tên vai trò</th>
                <th className="px-4 py-2.5">Mã</th>
                <th className="px-4 py-2.5">Số quyền</th>
                <th className="px-4 py-2.5">Người dùng</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {roles.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : 'text-fg-subtle'}>
                  <td className="px-4 py-2.5 font-semibold">
                    {r.name}
                    {r.isSystem && (
                      <span className="ml-2 text-[10px] text-fg-subtle uppercase">hệ thống</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5">{r.permissionCodes.length}</td>
                  <td className="px-4 py-2.5">{r.userCount}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.isActive ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-fg-muted'
                      }`}
                    >
                      {r.isActive ? 'Đang dùng' : 'Tạm ẩn'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Sửa
                    </button>
                    {!r.isSystem && r.userCount === 0 && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Xóa
                      </button>
                    )}
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
            className="bg-surface rounded-2xl shadow-soft w-full max-w-2xl max-h-[90vh] overflow-auto"
          >
            <div className="px-5 py-4 bg-shell text-fg border-b border-line text-sm font-bold rounded-t-2xl">
              {isNew ? 'Thêm vai trò' : `Sửa vai trò: ${form.name}`}
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Mã vai trò" required>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!isNew}
                    required
                    placeholder="vd: viewer, reporter"
                    pattern="[a-z][a-z0-9_]*"
                    title="Chữ thường, số, gạch dưới; bắt đầu bằng chữ"
                    className={`${FIELD_CLASS} disabled:bg-surface-2 font-mono`}
                  />
                </FormField>
                <FormField label="Tên hiển thị" required>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    minLength={2}
                    className={FIELD_CLASS}
                  />
                </FormField>
              </div>
              <FormField label="Mô tả">
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={FIELD_CLASS}
                />
              </FormField>
              {!isNew && (
                <label className="flex items-center gap-2.5 text-sm text-fg">
                  <ToggleSwitch
                    checked={form.isActive}
                    onChange={(v) => setForm({ ...form, isActive: v })}
                    label="Vai trò đang dùng"
                  />
                  Vai trò đang dùng
                </label>
              )}

              <div>
                <p className="text-xs font-semibold uppercase text-fg-muted mb-2">Quyền của vai trò</p>
                <div className="space-y-3 rounded-lg border border-line p-3 max-h-72 overflow-auto">
                  {permissionGroups.map(([group, perms]) => (
                    <div key={group}>
                      <p className="text-[11px] font-bold text-fg-muted mb-1">{group}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((p) => (
                          <label
                            key={p.code}
                            className="flex items-center gap-2.5 text-sm text-fg rounded-md px-1.5 py-1 hover:bg-surface-2"
                          >
                            <ToggleSwitch
                              checked={form.permissionCodes.includes(p.code)}
                              onChange={() => togglePermission(p.code)}
                              label={p.name}
                            />
                            <span>{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
