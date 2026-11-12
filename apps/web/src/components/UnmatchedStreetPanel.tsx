'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Street, UnmatchedStreet } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { streetsApi } from '@/lib/addresses-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS } from '@/components/ui';

function itemKey(item: UnmatchedStreet) {
  return `${item.wardId ?? ''}::${item.name.toLowerCase()}`;
}

export default function UnmatchedStreetPanel({
  onStreetsChanged,
}: {
  onStreetsChanged?: () => void;
}) {
  const [items, setItems] = useState<UnmatchedStreet[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unmatched, streetList] = await Promise.all([
        streetsApi.unmatched(),
        streetsApi.list(),
      ]);
      setItems(unmatched);
      setStreets(streetList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được tên đường chưa chuẩn hoá');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.wardName ?? '').toLowerCase().includes(term),
    );
  }, [items, search]);

  const totalHouses = items.reduce((sum, item) => sum + item.houseCount, 0);

  function streetsFor(item: UnmatchedStreet) {
    return streets.filter(
      (street) => !item.wardId || !street.wardId || street.wardId === item.wardId,
    );
  }

  async function handleCreate(item: UnmatchedStreet) {
    const key = itemKey(item);
    const wardLabel = item.wardName ?? 'chưa gán xã/phường';
    if (!confirm(`Tạo đường "${item.name}" (${wardLabel}) và liên kết ${item.houseCount} hồ sơ?`))
      return;

    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const result = await streetsApi.resolveUnmatched({
        action: 'create',
        name: item.name,
        wardId: item.wardId ?? undefined,
      });
      setNotice(`Đã tạo "${result.street.name}" và cập nhật ${result.updatedHouses} hồ sơ.`);
      onStreetsChanged?.();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được đường/phố');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMerge(item: UnmatchedStreet) {
    const key = itemKey(item);
    const targetId = targets[key];
    const target = streets.find((street) => street.id === targetId);
    if (!target) return;
    if (
      !confirm(
        `Gộp "${item.name}" (${item.houseCount} hồ sơ) vào "${target.name}"? Tên đường trong các hồ sơ sẽ đổi theo tên đích.`,
      )
    )
      return;

    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const result = await streetsApi.resolveUnmatched({
        action: 'merge',
        name: item.name,
        wardId: item.wardId ?? undefined,
        targetStreetId: target.id,
      });
      setNotice(`Đã gộp vào "${result.street.name}" và cập nhật ${result.updatedHouses} hồ sơ.`);
      setTargets((current) => ({ ...current, [key]: '' }));
      onStreetsChanged?.();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gộp được đường/phố');
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-fg-subtle text-sm py-10">
        <ButtonSpinner /> Đang tải…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass p-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h3 className="font-bold text-sm text-fg">Tên đường chưa có trong danh mục</h3>
          <p className="text-xs text-fg-muted">
            {items.length} tên • {totalHouses} hồ sơ • Tạo đường mới hoặc gộp vào đường đã có.
          </p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên đường…"
          aria-label="Tìm tên đường chưa chuẩn hoá"
          className={`${FIELD_CLASS} !w-56`}
        />
        <button
          type="button"
          onClick={load}
          className="bg-surface-2 hover:bg-surface-2/80 text-fg text-xs font-semibold px-3 py-2 rounded-lg border border-line transition"
        >
          Tải lại
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-2.5 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-ok/10 border border-ok/30 text-ok rounded-lg p-2.5 text-sm">
          {notice}
        </div>
      )}

      <div className="glass overflow-x-auto">
        {visible.length === 0 ? (
          <EmptyState icon="🛣️" text="Không còn tên đường nào chưa chuẩn hoá" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-fg-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Tên đường</th>
                <th className="text-left px-4 py-2.5">Xã/phường</th>
                <th className="text-right px-4 py-2.5">Hồ sơ</th>
                <th className="text-left px-4 py-2.5">Gộp vào</th>
                <th className="w-44" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((item) => {
                const key = itemKey(item);
                const options = streetsFor(item);
                const busy = busyKey === key;
                return (
                  <tr key={key} className="animate-item-in hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-fg">{item.name}</td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {item.wardName ?? 'Chưa gán xã/phường'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{item.houseCount}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={targets[key] ?? ''}
                        onChange={(event) =>
                          setTargets((current) => ({ ...current, [key]: event.target.value }))
                        }
                        aria-label={`Chọn đường để gộp "${item.name}"`}
                        className={`${FIELD_CLASS} !w-52 !py-1.5`}
                      >
                        <option value="">-- Chọn đường --</option>
                        {options.map((street) => (
                          <option key={street.id} value={street.id}>
                            {street.name}
                            {street.wardId ? '' : ' (toàn tỉnh)'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreate(item)}
                          disabled={busyKey !== null}
                          className="text-accent hover:underline text-xs font-semibold disabled:opacity-50"
                        >
                          {busy ? 'Đang xử lý…' : 'Tạo mới'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMerge(item)}
                          disabled={!targets[key] || busyKey !== null}
                          className="text-brand hover:underline text-xs font-semibold disabled:opacity-50"
                        >
                          Gộp
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
