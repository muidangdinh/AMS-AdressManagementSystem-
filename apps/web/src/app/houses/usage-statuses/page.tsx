'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import type { UsageStatusItem } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { usageStatusesApi } from '@/lib/addresses-api';
import { FIELD_CLASS, PageHeader, EmptyState, ButtonSpinner } from '@/components/ui';

/**
 * Phân hệ "Hiện trạng nhà": quản lý danh mục hiện trạng sử dụng nhà (Nhà ở, Bỏ trống, …) dùng cho
 * dropdown ở form khảo sát mobile và form hồ sơ số nhà. Đọc mở cho mọi vai trò, ghi cần `address:write`.
 */
export default function UsageStatusesPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.ADDRESS_WRITE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [items, setItems] = useState<UsageStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await usageStatusesApi.list(true));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh sách hiện trạng nhà');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [form, setForm] = useState({ name: '', sortOrder: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await usageStatusesApi.create({
        name: form.name.trim(),
        sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
      });
      setForm({ name: '', sortOrder: '' });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: UsageStatusItem) {
    try {
      await usageStatusesApi.update(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không cập nhật được');
    }
  }

  async function handleDelete(item: UsageStatusItem) {
    if (!confirm(`Xóa hiện trạng "${item.name}"?`)) return;
    try {
      await usageStatusesApi.remove(item.id);
      setItems((prev) => prev.filter((u) => u.id !== item.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  if (!user || !canManage) {
    return <div className="p-6 text-sm text-fg-subtle">Đang chuyển hướng…</div>;
  }

  return (
    <div className="h-full overflow-auto p-6 bg-app-shell">
      <PageHeader
        title="Hiện trạng nhà"
        subtitle="Danh mục hiện trạng sử dụng nhà (Nhà ở, Bỏ trống, Đang xây dựng…). Dùng để chọn trong dropdown ở form khảo sát và hồ sơ số nhà."
      />

      {loadError && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm mt-4">
          {loadError}
        </div>
      )}

      <div className="max-w-3xl mt-4">
        <form onSubmit={handleAdd} className="glass p-4 mb-4 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
              Tên hiện trạng *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1">
              Thứ tự
            </label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className={FIELD_CLASS}
            />
          </div>
          <button
            disabled={saving}
            className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
          >
            {saving && <ButtonSpinner light />} + Thêm
          </button>
        </form>
        {formError && <p className="text-danger text-sm mb-3">{formError}</p>}

        <div className="glass overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-fg-subtle text-sm py-10">
              <ButtonSpinner /> Đang tải…
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon="🏠" text="Chưa có hiện trạng nhà nào" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-fg-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Tên</th>
                  <th className="text-left px-4 py-2.5">Thứ tự</th>
                  <th className="text-left px-4 py-2.5">Hiển thị</th>
                  <th className="w-36" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((u) => (
                  <tr key={u.id} className="animate-item-in hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-2.5">{u.name}</td>
                    <td className="px-4 py-2.5">{u.sortOrder}</td>
                    <td className="px-4 py-2.5">{u.isActive ? 'Đang bật' : 'Đã ẩn'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggle(u)}
                        className="text-brand hover:underline text-xs font-semibold mr-3"
                      >
                        {u.isActive ? 'Ẩn' : 'Bật'}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-danger hover:underline text-xs font-semibold"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
