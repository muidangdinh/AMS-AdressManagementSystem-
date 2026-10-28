'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PERMISSIONS } from '@tayninh/shared';
import { useAppConfig } from '@/lib/app-config';
import { ApiError, getApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { brandingApi, type BrandLogoKind } from '@/lib/branding-api';
import { Button, ButtonSpinner, Card, PageHeader } from '@/components/ui';

const LABELS: Record<BrandLogoKind, string> = {
  web: 'logo web',
  app: 'logo app',
};

function WebPreview({ src }: { src: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'Nền sáng', dark: false },
        { label: 'Nền tối', dark: true },
      ].map(({ label, dark }) => (
        <div key={label}>
          <div
            className={`min-h-24 rounded-lg p-4 flex items-center justify-center ${
              dark ? 'bg-slate-900' : 'bg-white border border-slate-200'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className={`h-9 w-auto max-w-full object-contain ${dark ? '' : 'invert'}`}
            />
          </div>
          <p className="mt-1 text-[11px] text-fg-subtle text-center">{label}</p>
        </div>
      ))}
    </div>
  );
}

function AppPreview({ src }: { src: string }) {
  function maskStyle(size: number): CSSProperties {
    return {
      width: size,
      height: size,
      backgroundColor: '#2563eb',
      WebkitMaskImage: `url("${src}")`,
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskImage: `url("${src}")`,
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      maskSize: 'contain',
    };
  }

  return (
    <div className="min-h-24 rounded-lg bg-white border border-slate-200 p-5 flex items-end justify-center gap-6">
      <div style={maskStyle(28)} />
      <div style={maskStyle(56)} />
    </div>
  );
}

function LogoCard({
  kind,
  title,
  description,
  preview,
  hasCustom,
  saving,
  onUpload,
  onReset,
}: {
  kind: BrandLogoKind;
  title: string;
  description: string;
  preview: ReactNode;
  hasCustom: boolean;
  saving: BrandLogoKind | null;
  onUpload: (kind: BrandLogoKind, file: File) => Promise<boolean>;
  onReset: (kind: BrandLogoKind) => Promise<boolean>;
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
        <p className="text-[11px] text-fg-subtle">
          PNG/WebP, nền trong suốt, màu trắng, tối đa 2MB.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" onClick={() => void handleUpload()} disabled={!file || busy}>
          {busy && <ButtonSpinner light />}
          {hasCustom ? 'Thay logo' : 'Tải logo lên'}
        </Button>
        {hasCustom && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onReset(kind)}
            disabled={busy}
          >
            Khôi phục mặc định
          </Button>
        )}
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
  const webLogoSrc = config.webLogoUrl ? `${apiBase}${config.webLogoUrl}` : '/logo.png';
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

  async function reset(kind: BrandLogoKind): Promise<boolean> {
    if (!window.confirm(`Khôi phục ${LABELS[kind]} mặc định?`)) return false;
    setSaving(kind);
    setError(null);
    setNotice(null);
    try {
      await brandingApi.reset(kind);
      await refresh();
      setNotice(`Đã khôi phục ${LABELS[kind]} mặc định.`);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Không thể khôi phục ${LABELS[kind]}.`);
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
            kind="web"
            title="Logo web"
            description="Hiển thị ở góc trái header của trang quản trị web."
            preview={<WebPreview src={webLogoSrc} />}
            hasCustom={!!config.webLogoUrl}
            saving={saving}
            onUpload={upload}
            onReset={reset}
          />
          <LogoCard
            kind="app"
            title="Logo app"
            description="Hiển thị ở góc trái header ứng dụng di động; logo trắng được tô xanh."
            preview={<AppPreview src={appLogoSrc} />}
            hasCustom={!!config.appLogoUrl}
            saving={saving}
            onUpload={upload}
            onReset={reset}
          />
        </div>
      </div>
    </div>
  );
}
