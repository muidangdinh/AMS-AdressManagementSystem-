'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { HouseSummary, NumberingSchemeItem, PaginatedResult, SchemeValidationResult } from '@tayninh/shared';
import {
  EDITOR_ROLES,
  NUMBERING_SCHEME_STATUS_LABELS,
  NUMBERING_SIDE_LABELS,
  NumberingSchemeStatus,
  NumberingSide,
  UserRole,
} from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { numberingSchemesApi } from '@/lib/numbering-api';
import { ButtonSpinner, EmptyState, FIELD_CLASS, FormField } from '@/components/ui';

const STATUS_BADGE: Record<NumberingSchemeStatus, string> = {
  [NumberingSchemeStatus.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [NumberingSchemeStatus.SUBMITTED]: 'bg-amber-100 text-amber-800 border-amber-200',
  [NumberingSchemeStatus.APPROVED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [NumberingSchemeStatus.REJECTED]: 'bg-rose-100 text-rose-800 border-rose-200',
};

export default function NumberingSchemeDetailPage() {
  const params = useParams<{ id: string }>();
  const schemeId = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const isEditorRole = !!user && EDITOR_ROLES.includes(user.role as UserRole);

  const [scheme, setScheme] = useState<Awaited<ReturnType<typeof numberingSchemesApi.get>> | null>(
    null,
  );
  const [validation, setValidation] = useState<SchemeValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, v] = await Promise.all([
        numberingSchemesApi.get(schemeId),
        numberingSchemesApi.validate(schemeId),
      ]);
      setScheme(s);
      setValidation(v);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được phương án');
    } finally {
      setLoading(false);
    }
  }, [schemeId]);

  useEffect(() => {
    load();
  }, [load]);

  const canEdit = isEditorRole && !!scheme &&
    (scheme.status === NumberingSchemeStatus.DRAFT || scheme.status === NumberingSchemeStatus.REJECTED);

  // ---- Sửa thông tin phương án ----
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    oddEvenSplit: true,
    startNumber: '1',
    step: '2',
  });
  useEffect(() => {
    if (scheme) {
      setEditForm({
        name: scheme.name,
        description: scheme.description ?? '',
        oddEvenSplit: scheme.oddEvenSplit,
        startNumber: String(scheme.startNumber),
        step: String(scheme.step),
      });
    }
  }, [scheme]);

  async function handleSaveInfo() {
    setActionLoading(true);
    setActionError(null);
    try {
      await numberingSchemesApi.update(schemeId, {
        name: editForm.name,
        description: editForm.description || undefined,
        oddEvenSplit: editForm.oddEvenSplit,
        startNumber: Number(editForm.startNumber),
        step: Number(editForm.step),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setActionLoading(false);
    }
  }

  // ---- Thêm nhà vào phương án ----
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<HouseSummary[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addSide, setAddSide] = useState<NumberingSide>(NumberingSide.ODD);

  async function handleSearchHouses() {
    if (!scheme) return;
    setAddSearching(true);
    try {
      const res = await apiFetch<PaginatedResult<HouseSummary>>(
        `/api/houses?streetId=${scheme.streetId}&pageSize=50&search=${encodeURIComponent(addQuery)}`,
      );
      const existingIds = new Set((scheme.items ?? []).map((i) => i.houseId));
      setAddResults(res.items.filter((h) => !existingIds.has(h.id)));
    } catch {
      setAddResults([]);
    } finally {
      setAddSearching(false);
    }
  }

  useEffect(() => {
    if (scheme) handleSearchHouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme?.id, scheme?.items?.length]);

  async function handleAddHouse(houseId: string) {
    setActionError(null);
    try {
      await numberingSchemesApi.addItem(schemeId, {
        houseId,
        side: scheme?.oddEvenSplit ? addSide : NumberingSide.NONE,
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không thêm được nhà vào phương án');
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirm('Bỏ nhà này khỏi phương án?')) return;
    try {
      await numberingSchemesApi.removeItem(schemeId, itemId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  async function handleItemFieldChange(item: NumberingSchemeItem, patch: Partial<NumberingSchemeItem>) {
    try {
      await numberingSchemesApi.updateItem(schemeId, item.id, {
        side: patch.side,
        sequenceOrder: patch.sequenceOrder,
        proposedNumber: patch.proposedNumber === null ? undefined : patch.proposedNumber,
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không lưu được thay đổi');
    }
  }

  // ---- Quy trình ----
  async function handleGenerate() {
    setActionLoading(true);
    setActionError(null);
    try {
      await numberingSchemesApi.generate(schemeId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không sinh số được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmit() {
    setActionLoading(true);
    setActionError(null);
    try {
      await numberingSchemesApi.submit(schemeId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không trình duyệt được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!confirm('Phê duyệt phương án này? Số nhà đề xuất sẽ được ghi vào hồ sơ chính thức.')) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await numberingSchemesApi.approve(schemeId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không phê duyệt được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    const reason = prompt('Lý do từ chối phương án:');
    if (!reason) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await numberingSchemesApi.reject(schemeId, reason);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không từ chối được');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Xóa hẳn phương án nháp này?')) return;
    try {
      await numberingSchemesApi.remove(schemeId);
      router.push('/houses/numbering');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không xóa được');
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Đang tải…</div>;
  if (error || !scheme) {
    return <div className="p-6 text-sm text-rose-600">{error ?? 'Không tìm thấy phương án'}</div>;
  }

  const items = scheme.items ?? [];
  const duplicateNumberItemIds = new Set(
    (validation?.duplicateNumbers ?? []).flatMap((d) => d.itemIds),
  );
  const duplicateOrderItemIds = new Set(
    (validation?.duplicateOrders ?? []).flatMap((d) => d.itemIds),
  );
  const wrongStreetItemIds = new Set(validation?.wrongStreetItemIds ?? []);
  const hasIssues =
    (validation?.duplicateNumbers.length ?? 0) > 0 ||
    (validation?.duplicateOrders.length ?? 0) > 0 ||
    (validation?.wrongStreetItemIds.length ?? 0) > 0 ||
    (validation?.missingNumberItemIds.length ?? 0) > 0;

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <Link href="/houses/numbering" className="text-sm text-blue-600 hover:underline font-semibold">
        ← Danh sách phương án
      </Link>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
          {actionError}
        </div>
      )}

      {/* Thông tin phương án */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span
              className={`inline-block mb-2 px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_BADGE[scheme.status]}`}
            >
              {NUMBERING_SCHEME_STATUS_LABELS[scheme.status]}
            </span>
            <h2 className="text-lg font-bold text-slate-900">{scheme.name}</h2>
            <p className="text-sm text-slate-500">
              {scheme.street.name}
              {scheme.ward ? ` • ${scheme.ward.name}` : ''}
            </p>
          </div>
          {canEdit && scheme.status === NumberingSchemeStatus.DRAFT && (
            <button onClick={handleDelete} className="text-rose-600 hover:underline text-xs font-semibold">
              Xóa phương án
            </button>
          )}
        </div>

        {scheme.status === NumberingSchemeStatus.REJECTED && scheme.rejectedReason && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm mb-3">
            <strong>Lý do từ chối:</strong> {scheme.rejectedReason}
          </div>
        )}

        {canEdit ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormField label="Tên phương án">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={FIELD_CLASS}
                />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Mô tả phạm vi">
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className={FIELD_CLASS}
                />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                id="oddEvenSplitEdit"
                type="checkbox"
                checked={editForm.oddEvenSplit}
                onChange={(e) => setEditForm((f) => ({ ...f, oddEvenSplit: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40"
              />
              Tách chẵn/lẻ 2 bên
            </label>
            <div />
            <FormField label="Số bắt đầu">
              <input
                type="number"
                value={editForm.startNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, startNumber: e.target.value }))}
                className={FIELD_CLASS}
              />
            </FormField>
            <FormField label="Bước nhảy">
              <input
                type="number"
                value={editForm.step}
                onChange={(e) => setEditForm((f) => ({ ...f, step: e.target.value }))}
                className={FIELD_CLASS}
              />
            </FormField>
            <div className="col-span-2">
              <button
                onClick={handleSaveInfo}
                disabled={actionLoading}
                className="bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
              >
                {actionLoading && <ButtonSpinner light />}
                Lưu thông tin
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-600 space-y-1">
            {scheme.description && <p>{scheme.description}</p>}
            <p>
              Quy tắc:{' '}
              {scheme.oddEvenSplit
                ? `Tách chẵn/lẻ, bắt đầu ${scheme.startNumber}, bước ${scheme.step}`
                : `Liên tục, bắt đầu ${scheme.startNumber}, bước ${scheme.step}`}
            </p>
            <p className="text-xs text-slate-400">
              Tạo bởi {scheme.createdBy?.fullName ?? '—'} lúc{' '}
              {new Date(scheme.createdAt).toLocaleString('vi-VN')}
              {scheme.approvedBy &&
                ` • Duyệt bởi ${scheme.approvedBy.fullName} lúc ${new Date(scheme.approvedAt!).toLocaleString('vi-VN')}`}
            </p>
          </div>
        )}
      </div>

      {/* Kiểm tra phương án */}
      {validation && (
        <div
          className={`rounded-xl p-4 border text-sm ${hasIssues ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}
        >
          {!hasIssues ? (
            <p className="text-emerald-700 font-semibold">✓ Không phát hiện lỗi trong phương án.</p>
          ) : (
            <div className="space-y-1 text-amber-800">
              {validation.duplicateNumbers.length > 0 && (
                <p>⚠ Số trùng: {validation.duplicateNumbers.map((d) => d.number).join(', ')}</p>
              )}
              {validation.duplicateOrders.length > 0 && (
                <p>
                  ⚠ Trùng thứ tự trong cùng 1 bên:{' '}
                  {validation.duplicateOrders.map((d) => `${NUMBERING_SIDE_LABELS[d.side]} #${d.order}`).join(', ')}
                </p>
              )}
              {validation.wrongStreetItemIds.length > 0 && (
                <p>⚠ Có {validation.wrongStreetItemIds.length} nhà không thuộc tuyến đường của phương án.</p>
              )}
              {validation.missingNumberItemIds.length > 0 && (
                <p>⚠ Còn {validation.missingNumberItemIds.length} nhà chưa có số đề xuất — bấm "Sinh số tự động".</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Danh sách nhà trong phương án */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Danh sách nhà ({items.length})</h3>
          {canEdit && (
            <button
              onClick={handleGenerate}
              disabled={actionLoading || items.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              {actionLoading && <ButtonSpinner light />}
              Sinh số tự động
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyState icon="🏠" text="Chưa có nhà nào trong phương án" />
        ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Bên</th>
              <th className="text-left px-3 py-2">Thứ tự</th>
              <th className="text-left px-3 py-2">Số cũ</th>
              <th className="text-left px-3 py-2">Số đề xuất</th>
              <th className="text-left px-3 py-2">Chủ hộ</th>
              {canEdit && <th className="w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const flagged =
                duplicateNumberItemIds.has(item.id) ||
                duplicateOrderItemIds.has(item.id) ||
                wrongStreetItemIds.has(item.id);
              return (
                <tr key={item.id} className={flagged ? 'bg-rose-50/60' : ''}>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        value={item.side}
                        onChange={(e) =>
                          handleItemFieldChange(item, { side: e.target.value as NumberingSide })
                        }
                        className="border border-slate-300 rounded px-1.5 py-1 text-xs"
                      >
                        {Object.values(NumberingSide).map((s) => (
                          <option key={s} value={s}>
                            {NUMBERING_SIDE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      NUMBERING_SIDE_LABELS[item.side]
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <input
                        type="number"
                        value={item.sequenceOrder}
                        onChange={(e) =>
                          handleItemFieldChange(item, { sequenceOrder: Number(e.target.value) })
                        }
                        className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs"
                      />
                    ) : (
                      item.sequenceOrder
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{item.house.houseNumber}</td>
                  <td className="px-3 py-2 font-bold">
                    {canEdit ? (
                      <input
                        value={item.proposedNumber ?? ''}
                        onChange={(e) =>
                          handleItemFieldChange(item, { proposedNumber: e.target.value })
                        }
                        className="w-20 border border-slate-300 rounded px-1.5 py-1 text-xs font-bold"
                        placeholder="—"
                      />
                    ) : (
                      item.proposedNumber ?? '—'
                    )}
                  </td>
                  <td className="px-3 py-2">{item.house.ownerName}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-rose-600 hover:underline text-xs font-semibold"
                      >
                        Bỏ
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        )}

        {canEdit && (
          <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase">
              + Thêm nhà từ tuyến {scheme.street.name}
            </p>
            <div className="flex gap-2">
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchHouses()}
                placeholder="Tìm số nhà/chủ hộ trên tuyến này..."
                className={`flex-1 ${FIELD_CLASS}`}
              />
              {scheme.oddEvenSplit && (
                <select
                  value={addSide}
                  onChange={(e) => setAddSide(e.target.value as NumberingSide)}
                  className={FIELD_CLASS}
                >
                  <option value={NumberingSide.ODD}>Bên lẻ</option>
                  <option value={NumberingSide.EVEN}>Bên chẵn</option>
                </select>
              )}
              <button
                onClick={handleSearchHouses}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 transition"
              >
                Tìm
              </button>
            </div>
            {addSearching && <p className="text-xs text-slate-400">Đang tìm…</p>}
            {!addSearching && addResults.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {addResults.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleAddHouse(h.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                  >
                    <span>
                      Số {h.houseNumber} — {h.ownerName}
                    </span>
                    <span className="text-xs text-blue-600 font-semibold">+ Thêm</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hành động quy trình */}
      {canEdit && (scheme.status === NumberingSchemeStatus.DRAFT || scheme.status === NumberingSchemeStatus.REJECTED) && (
        <button
          onClick={handleSubmit}
          disabled={actionLoading || items.length === 0}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition flex items-center gap-2"
        >
          {actionLoading && <ButtonSpinner light />}
          Trình duyệt
        </button>
      )}
      {isAdmin && scheme.status === NumberingSchemeStatus.SUBMITTED && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            Phê duyệt
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition"
          >
            Từ chối
          </button>
        </div>
      )}
      {!isAdmin && scheme.status === NumberingSchemeStatus.SUBMITTED && (
        <p className="text-sm text-slate-500">Đang chờ ADMIN phê duyệt.</p>
      )}
      {scheme.status === NumberingSchemeStatus.APPROVED && (
        <p className="text-sm text-emerald-700 font-semibold">
          ✓ Đã phê duyệt — số nhà đề xuất đã được ghi vào hồ sơ chính thức, phương án không sửa được nữa.
        </p>
      )}
    </div>
  );
}
