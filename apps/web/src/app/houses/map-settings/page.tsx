'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import { useAppConfig } from '@/lib/app-config';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { mapSettingsApi } from '@/lib/map-settings-api';
import { ButtonSpinner, Card, PageHeader, ToggleSwitch } from '@/components/ui';

const PROVIDER_LABELS: Record<string, string> = {
  goong: 'Goong',
  google: 'Google Maps',
  leaflet: 'Esri (Leaflet)',
};

/** Nền bản đồ nào ẩn được icon địa điểm — Esri là ảnh dựng sẵn, chữ/icon đã in vào ảnh. */
const POI_SUPPORT: Record<string, boolean> = { goong: true, google: true, leaflet: false };

export default function MapSettingsPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const { config, refresh } = useAppConfig();
  const canManage = hasPermission(PERMISSIONS.SETTING_MANAGE);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  if (!canManage) return null;

  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER === 'goong' || process.env.NEXT_PUBLIC_MAP_PROVIDER === 'google'
    ? process.env.NEXT_PUBLIC_MAP_PROVIDER
    : 'leaflet';
  const supported = POI_SUPPORT[provider];

  async function toggleHidePoi(next: boolean) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await mapSettingsApi.update({ hidePoi: next });
      await refresh();
      setNotice(next ? 'Đã ẩn icon địa điểm trên bản đồ.' : 'Đã hiện lại icon địa điểm trên bản đồ.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được cấu hình bản đồ.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader
          title="Cấu hình bản đồ"
          subtitle="Áp dụng cho mọi người dùng, trên bản đồ hồ sơ nhà và bản đồ tuyến khảo sát/thi công."
        />

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">{notice}</div>
        )}

        <Card className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-fg">Ẩn icon địa điểm trên nền bản đồ</h2>
              <p className="text-xs text-fg-muted mt-1">
                Ẩn icon nhà hàng, cửa hàng, cây xăng, trường học, công viên… của nền bản đồ, chỉ còn marker số nhà và
                tuyến của hệ thống. Tên đường và tên xã/ấp vẫn hiển thị.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              {saving && <ButtonSpinner />}
              <ToggleSwitch
                checked={config.mapHidePoi}
                onChange={(next) => void toggleHidePoi(next)}
                disabled={saving}
                label="Ẩn icon địa điểm trên nền bản đồ"
              />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 text-xs text-fg-muted">
            Nền bản đồ đang dùng: <span className="font-semibold text-fg">{PROVIDER_LABELS[provider]}</span>
            {supported ? (
              <> — hỗ trợ ẩn icon địa điểm.</>
            ) : (
              <>
                {' '}
                — <span className="text-warn font-semibold">không ẩn được</span>: nền Esri là ảnh dựng sẵn, icon đã in vào
                ảnh. Chuyển sang Goong (<code className="font-mono">NEXT_PUBLIC_MAP_PROVIDER=goong</code>) để dùng tính
                năng này.
              </>
            )}
          </div>

          <p className="text-[11px] text-fg-subtle">
            Bản đồ đang mở sẽ cập nhật ngay sau khi lưu; người dùng khác thấy thay đổi khi tải lại trang. Chưa áp dụng
            cho app di động.
          </p>
        </Card>
      </div>
    </div>
  );
}
