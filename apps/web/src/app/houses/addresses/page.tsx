'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PERMISSIONS } from '@tayninh/shared';
import type { Alley, District, Hamlet, Street, Ward } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { alleysApi, districtsApi, hamletsApi, streetsApi, wardsApi } from '@/lib/addresses-api';
import { FIELD_CLASS, PageHeader, EmptyState, ButtonSpinner } from '@/components/ui';

type TabKey = 'district' | 'ward' | 'hamlet' | 'street' | 'alley';

const TABS: { key: TabKey; label: string }[] = [
  // { key: 'district', label: 'Quận/Huyện' },
  { key: 'ward', label: 'Xã/Phường' },
  { key: 'hamlet', label: 'Thôn/Ấp/Tổ dân phố' },
  { key: 'street', label: 'Đường/Phố' },
  { key: 'alley', label: 'Hẻm/Ngõ' },
];

/**
 * Quản lý danh mục địa chỉ chuẩn hoá (Phase 6 — IV. Quản lý dữ liệu địa chỉ).
 * Chỉ ADMIN được vào — GET danh mục mở cho mọi vai trò (dùng cho dropdown ở
 * form House) nhưng thêm/sửa/xóa chỉ ADMIN mới gọi được ở backend, nên UI
 * quản trị này cũng chỉ hiện cho ADMIN để tránh gây hiểu nhầm cho vai trò khác.
 */
export default function AddressesAdminPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canManage = hasPermission(PERMISSIONS.ADDRESS_WRITE);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  const [tab, setTab] = useState<TabKey>('district');

  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [hamlets, setHamlets] = useState<Hamlet[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [alleys, setAlleys] = useState<Alley[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [d, w, h, s, a] = await Promise.all([
        districtsApi.list(),
        wardsApi.list(),
        hamletsApi.list(),
        streetsApi.list(),
        alleysApi.list(),
      ]);
      setDistricts(d);
      setWards(w);
      setHamlets(h);
      setStreets(s);
      setAlleys(a);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Không tải được danh mục địa chỉ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---- Quận/Huyện ----
  const [districtForm, setDistrictForm] = useState({ name: '', code: '' });
  const [districtSaving, setDistrictSaving] = useState(false);
  const [districtError, setDistrictError] = useState<string | null>(null);

  async function handleAddDistrict(e: React.FormEvent) {
    e.preventDefault();
    setDistrictSaving(true);
    setDistrictError(null);
    try {
      await districtsApi.create({ name: districtForm.name, code: districtForm.code || undefined });
      setDistrictForm({ name: '', code: '' });
      setDistricts(await districtsApi.list());
    } catch (err) {
      setDistrictError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setDistrictSaving(false);
    }
  }

  async function handleDeleteDistrict(id: string) {
    if (!confirm('Xóa quận/huyện này? Xã/phường đang gán sẽ mất liên kết (không bị xóa).')) return;
    try {
      await districtsApi.remove(id);
      setDistricts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  // ---- Xã/Phường ----
  const [wardForm, setWardForm] = useState({ name: '', code: '', districtId: '' });
  const [wardSaving, setWardSaving] = useState(false);
  const [wardError, setWardError] = useState<string | null>(null);

  async function handleAddWard(e: React.FormEvent) {
    e.preventDefault();
    setWardSaving(true);
    setWardError(null);
    try {
      await wardsApi.create({
        name: wardForm.name,
        code: wardForm.code || undefined,
        districtId: wardForm.districtId || undefined,
      });
      setWardForm({ name: '', code: '', districtId: '' });
      setWards(await wardsApi.list());
    } catch (err) {
      setWardError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setWardSaving(false);
    }
  }

  async function handleDeleteWard(id: string) {
    if (!confirm('Xóa xã/phường này? Thôn/ấp trực thuộc sẽ bị xóa theo, đường/phố mất liên kết.'))
      return;
    try {
      await wardsApi.remove(id);
      setWards((prev) => prev.filter((w) => w.id !== id));
      setHamlets((prev) => prev.filter((h) => h.wardId !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  // ---- Thôn/Ấp/Tổ dân phố ----
  const [hamletForm, setHamletForm] = useState({ name: '', wardId: '' });
  const [hamletSaving, setHamletSaving] = useState(false);
  const [hamletError, setHamletError] = useState<string | null>(null);

  async function handleAddHamlet(e: React.FormEvent) {
    e.preventDefault();
    if (!hamletForm.wardId) {
      setHamletError('Vui lòng chọn xã/phường');
      return;
    }
    setHamletSaving(true);
    setHamletError(null);
    try {
      await hamletsApi.create({ name: hamletForm.name, wardId: hamletForm.wardId });
      setHamletForm({ name: '', wardId: '' });
      setHamlets(await hamletsApi.list());
    } catch (err) {
      setHamletError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setHamletSaving(false);
    }
  }

  async function handleDeleteHamlet(id: string) {
    if (!confirm('Xóa thôn/ấp/tổ dân phố này?')) return;
    try {
      await hamletsApi.remove(id);
      setHamlets((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  // ---- Đường/Phố ----
  const [streetForm, setStreetForm] = useState({ name: '', wardId: '' });
  const [streetSaving, setStreetSaving] = useState(false);
  const [streetError, setStreetError] = useState<string | null>(null);

  async function handleAddStreet(e: React.FormEvent) {
    e.preventDefault();
    setStreetSaving(true);
    setStreetError(null);
    try {
      await streetsApi.create({ name: streetForm.name, wardId: streetForm.wardId || undefined });
      setStreetForm({ name: '', wardId: '' });
      setStreets(await streetsApi.list());
    } catch (err) {
      setStreetError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setStreetSaving(false);
    }
  }

  async function handleDeleteStreet(id: string) {
    if (!confirm('Xóa đường/phố này? Hẻm/ngõ trực thuộc sẽ bị xóa theo.')) return;
    try {
      await streetsApi.remove(id);
      setStreets((prev) => prev.filter((s) => s.id !== id));
      setAlleys((prev) => prev.filter((a) => a.streetId !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  // ---- Hẻm/Ngõ ----
  const [alleyForm, setAlleyForm] = useState({ name: '', streetId: '' });
  const [alleySaving, setAlleySaving] = useState(false);
  const [alleyError, setAlleyError] = useState<string | null>(null);

  async function handleAddAlley(e: React.FormEvent) {
    e.preventDefault();
    if (!alleyForm.streetId) {
      setAlleyError('Vui lòng chọn đường/phố');
      return;
    }
    setAlleySaving(true);
    setAlleyError(null);
    try {
      await alleysApi.create({ name: alleyForm.name, streetId: alleyForm.streetId });
      setAlleyForm({ name: '', streetId: '' });
      setAlleys(await alleysApi.list());
    } catch (err) {
      setAlleyError(err instanceof ApiError ? err.message : 'Không thêm được');
    } finally {
      setAlleySaving(false);
    }
  }

  async function handleDeleteAlley(id: string) {
    if (!confirm('Xóa hẻm/ngõ này?')) return;
    try {
      await alleysApi.remove(id);
      setAlleys((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  if (!user || !canManage) {
    return <div className="p-6 text-sm text-slate-400">Đang chuyển hướng…</div>;
  }

  const districtName = (id: string | null) => districts.find((d) => d.id === id)?.name ?? '—';
  const wardName = (id: string | null) => wards.find((w) => w.id === id)?.name ?? '—';
  const streetName = (id: string | null) => streets.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="h-full overflow-auto p-6 bg-app-shell">
      <PageHeader
        title="Danh mục địa chỉ"
        subtitle="Quận/huyện → Xã/phường → Thôn/ấp/Tổ dân phố, và Đường/phố → Hẻm/ngõ. Dùng để chọn trong dropdown khi tạo/sửa hồ sơ số nhà."
        actions={
          <Link
            href="/houses"
            className="text-sm text-blue-600 hover:underline font-semibold whitespace-nowrap"
          >
            ← Về danh sách số nhà
          </Link>
        }
      />

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm mt-4">
          {loadError}
        </div>
      )}

      <div className="inline-flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 mt-4 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
              tab === t.key
                ? 'bg-white text-blue-700 shadow-card'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
          <ButtonSpinner /> Đang tải…
        </div>
      ) : (
        <div className="max-w-3xl">
          {tab === 'district' && (
            <>
              <form
                onSubmit={handleAddDistrict}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 items-end shadow-card"
              >
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Tên quận/huyện *
                  </label>
                  <input
                    required
                    value={districtForm.name}
                    onChange={(e) => setDistrictForm((f) => ({ ...f, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Mã (tùy chọn)
                  </label>
                  <input
                    value={districtForm.code}
                    onChange={(e) => setDistrictForm((f) => ({ ...f, code: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <button
                  disabled={districtSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {districtSaving && <ButtonSpinner light />} + Thêm
                </button>
              </form>
              {districtError && (
                <p className="text-rose-600 text-sm mb-3">{districtError}</p>
              )}
              <CatalogTable
                headers={['Tên', 'Mã']}
                rows={districts.map((d) => [d.name, d.code ?? '—'])}
                onDelete={districts.map((d) => () => handleDeleteDistrict(d.id))}
                emptyLabel="Chưa có quận/huyện nào"
              />
            </>
          )}

          {tab === 'ward' && (
            <>
              <form
                onSubmit={handleAddWard}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 items-end shadow-card flex-wrap"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Tên xã/phường *
                  </label>
                  <input
                    required
                    value={wardForm.name}
                    onChange={(e) => setWardForm((f) => ({ ...f, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Quận/huyện (tùy chọn)
                  </label>
                  <select
                    value={wardForm.districtId}
                    onChange={(e) => setWardForm((f) => ({ ...f, districtId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="">-- Không --</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={wardSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {wardSaving && <ButtonSpinner light />} + Thêm
                </button>
              </form>
              {wardError && <p className="text-rose-600 text-sm mb-3">{wardError}</p>}
              <CatalogTable
                headers={['Tên', 'Quận/huyện']}
                rows={wards.map((w) => [w.name, districtName(w.districtId ?? null)])}
                onDelete={wards.map((w) => () => handleDeleteWard(w.id))}
                emptyLabel="Chưa có xã/phường nào"
              />
            </>
          )}

          {tab === 'hamlet' && (
            <>
              <form
                onSubmit={handleAddHamlet}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 items-end shadow-card flex-wrap"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Tên thôn/ấp/tổ dân phố *
                  </label>
                  <input
                    required
                    value={hamletForm.name}
                    onChange={(e) => setHamletForm((f) => ({ ...f, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Xã/phường *
                  </label>
                  <select
                    required
                    value={hamletForm.wardId}
                    onChange={(e) => setHamletForm((f) => ({ ...f, wardId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="">-- Chọn --</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={hamletSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {hamletSaving && <ButtonSpinner light />} + Thêm
                </button>
              </form>
              {hamletError && <p className="text-rose-600 text-sm mb-3">{hamletError}</p>}
              <CatalogTable
                headers={['Tên', 'Xã/phường']}
                rows={hamlets.map((h) => [h.name, wardName(h.wardId)])}
                onDelete={hamlets.map((h) => () => handleDeleteHamlet(h.id))}
                emptyLabel="Chưa có thôn/ấp/tổ dân phố nào"
              />
            </>
          )}

          {tab === 'street' && (
            <>
              <form
                onSubmit={handleAddStreet}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 items-end shadow-card flex-wrap"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Tên đường/phố *
                  </label>
                  <input
                    required
                    value={streetForm.name}
                    onChange={(e) => setStreetForm((f) => ({ ...f, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Xã/phường (tùy chọn)
                  </label>
                  <select
                    value={streetForm.wardId}
                    onChange={(e) => setStreetForm((f) => ({ ...f, wardId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="">-- Không --</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={streetSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {streetSaving && <ButtonSpinner light />} + Thêm
                </button>
              </form>
              {streetError && <p className="text-rose-600 text-sm mb-3">{streetError}</p>}
              <CatalogTable
                headers={['Tên', 'Xã/phường']}
                rows={streets.map((s) => [s.name, wardName(s.wardId ?? null)])}
                onDelete={streets.map((s) => () => handleDeleteStreet(s.id))}
                emptyLabel="Chưa có đường/phố nào"
              />
            </>
          )}

          {tab === 'alley' && (
            <>
              <form
                onSubmit={handleAddAlley}
                className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex gap-3 items-end shadow-card flex-wrap"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Tên hẻm/ngõ *
                  </label>
                  <input
                    required
                    value={alleyForm.name}
                    onChange={(e) => setAlleyForm((f) => ({ ...f, name: e.target.value }))}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Đường/phố *
                  </label>
                  <select
                    required
                    value={alleyForm.streetId}
                    onChange={(e) => setAlleyForm((f) => ({ ...f, streetId: e.target.value }))}
                    className={FIELD_CLASS}
                  >
                    <option value="">-- Chọn --</option>
                    {streets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={alleySaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
                >
                  {alleySaving && <ButtonSpinner light />} + Thêm
                </button>
              </form>
              {alleyError && <p className="text-rose-600 text-sm mb-3">{alleyError}</p>}
              <CatalogTable
                headers={['Tên', 'Đường/phố']}
                rows={alleys.map((a) => [a.name, streetName(a.streetId)])}
                onDelete={alleys.map((a) => () => handleDeleteAlley(a.id))}
                emptyLabel="Chưa có hẻm/ngõ nào"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Bảng danh mục dùng chung cho cả 5 tab — cột cuối luôn là nút xóa. */
function CatalogTable({
  headers,
  rows,
  onDelete,
  emptyLabel,
}: {
  headers: string[];
  rows: string[][];
  onDelete: (() => void)[];
  emptyLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
      {rows.length === 0 ? (
        <EmptyState icon="📍" text={emptyLabel} />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-2.5">
                  {h}
                </th>
              ))}
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {cell}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={onDelete[i]}
                    className="text-rose-600 hover:underline text-xs font-semibold"
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
  );
}
