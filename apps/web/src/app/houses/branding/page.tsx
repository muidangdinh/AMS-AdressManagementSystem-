'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import { useAppConfig } from '@/lib/app-config';
import { ApiError, getApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { brandingApi, type BrandLogoKind } from '@/lib/branding-api';
import { Button, ButtonSpinner, Card, PageHeader } from '@/components/ui';

const LABELS: Record<BrandLogoKind, string> = {
  'web-light': 'logo web nền sáng',
  'web-dark': 'logo web nền tối',
  app: 'logo app',
};

function WebPreview({ src, dark }: { src: string; dark: boolean }) {
  return (
    <div
      className={`min-h-24 rounded-lg p-4 flex items-center justify-center ${
        dark ? 'bg-slate-900' : 'bg-white border border-slate-200'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-9 w-auto max-w-full object-contain" />
    </div>
  );
}

function AppPreview({ src }: { src: string }) {
  return (
    <div className="min-h-24 rounded-lg bg-white border border-slate-200 p-5 flex items-end justify-center gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: 28, height: 28 }} className="object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ width: 56, height: 56 }} className="object-contain" />
    </div>
  );
}

function LogoCard({
  kind,
  title,
  description,
  hint,
  preview,
  hasCustom,
  saving,
  onUpload,
}: {
  kind: BrandLogoKind;
  title: string;
  description: string;
  hint: string;
  preview: ReactNode;
  hasCustom: boolean;
  saving: BrandLogoKind | null;
  onUpload: (kind: BrandLogoKind, file: File) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = saving === kind;

  async function handleUpload() {
    if (!file) return;
    if (await onUpload(kind, file)) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-fg">{title}</h2>
        <p className="text-xs text-fg-muted mt-1">{description}</p>
      </div>

      {preview}

      <p className="text-[11px] text-fg-subtle">
        {hasCustom ? 'Đang dùng logo tùy chỉnh.' : 'Đang dùng logo mặc định.'}
      </p>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-fg hover:file:bg-surface"
        />
        <p className="text-[11px] text-fg-subtle">{hint}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" onClick={() => void handleUpload()} disabled={!file || busy}>
          {busy && <ButtonSpinner light />}
          {hasCustom ? 'Thay logo' : 'Tải logo lên'}
        </Button>
      </div>
    </Card>
  );
}

export default function BrandingPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const { config, refresh } = useAppConfig();
  const canManage = hasPermission(PERMISSIONS.SETTING_MANAGE);

  const [saving, setSaving] = useState<BrandLogoKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user && !canManage) router.replace('/houses');
  }, [user, canManage, router]);

  if (!canManage) return null;

  const apiBase = getApiUrl().replace(/\/$/, '');
  const webLightSrc = config.webLogoLightUrl
    ? `${apiBase}${config.webLogoLightUrl}`
    : '/logo-light.png';
  const webDarkSrc = config.webLogoDarkUrl ? `${apiBase}${config.webLogoDarkUrl}` : '/logo.png';
  const appLogoSrc = config.appLogoUrl ? `${apiBase}${config.appLogoUrl}` : '/ams-mark.png';

  async function upload(kind: BrandLogoKind, file: File): Promise<boolean> {
    setSaving(kind);
    setError(null);
    setNotice(null);
    try {
      await brandingApi.upload(kind, file);
      await refresh();
      setNotice(`Đã cập nhật ${LABELS[kind]}.`);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Không thể cập nhật ${LABELS[kind]}.`);
      return false;
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          title="Cấu hình logo"
          subtitle="Logo hiển thị ở góc trái header web và header app."
        />

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
            {notice}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <LogoCard
            kind="web-light"
            title="Logo web nền sáng"
            description="Dùng khi giao diện web ở chế độ sáng."
            hint="PNG/WebP, tối đa 2MB. Nên dùng logo màu tối/đen, nền trong suốt."
            preview={<WebPreview src={webLightSrc} dark={false} />}
            hasCustom={!!config.webLogoLightUrl}
            saving={saving}
            onUpload={upload}
          />
          <LogoCard
            kind="web-dark"
            title="Logo web nền tối"
            description="Dùng khi giao diện web ở chế độ tối."
            hint="PNG/WebP, tối đa 2MB. Nên dùng logo màu sáng/trắng, nền trong suốt."
            preview={<WebPreview src={webDarkSrc} dark />}
            hasCustom={!!config.webLogoDarkUrl}
            saving={saving}
            onUpload={upload}
          />
          <LogoCard
            kind="app"
            title="Logo app"
            description="Hiển thị ở góc trái header ứng dụng di động, giữ đúng màu gốc."
            hint="PNG/WebP, tối đa 2MB. Nên dùng logo màu đậm, nền trong suốt vì header app nền trắng."
            preview={<AppPreview src={appLogoSrc} />}
            hasCustom={!!config.appLogoUrl}
            saving={saving}
            onUpload={upload}
          />
        </div>
      </div>
    </div>
  );
}
