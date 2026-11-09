'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClipboardList, Download, LogOut, Map as MapIcon, MapPin, Share, X } from 'lucide-react';
import { PERMISSIONS } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { getApiUrl } from '@/lib/api';
import { useAppConfig } from '@/lib/app-config';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const TABS = [
  { href: '/survey/map', label: 'Bản đồ', icon: MapIcon },
  { href: '/survey/assignments', label: 'Nhiệm vụ', icon: ClipboardList },
  { href: '/survey/field', label: 'Khảo sát', icon: MapPin },
];

export default function SurveyShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const customLogo = config.appLogoUrl
    ? `${getApiUrl().replace(/\/$/, '')}${config.appLogoUrl}`
    : null;

  useEffect(() => {
    setLogoFailed(false);
  }, [customLogo]);

  useEffect(() => {
    if (!isLoading && !user) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (isLoading || !user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-canvas text-fg-muted text-sm gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
        Đang tải…
      </div>
    );
  }

  const canSurvey = hasPermission(PERMISSIONS.ASSIGNMENT_EXECUTE);
  const isMap = pathname.startsWith('/survey/map');

  return (
    <div className="h-[100dvh] flex flex-col bg-canvas text-fg">
      <header className="shrink-0 h-14 px-3 flex items-center gap-2 border-b border-line bg-shell/90 backdrop-blur-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={customLogo && !logoFailed ? customLogo : '/icons/survey-192.png'}
          alt="AMS"
          className="h-8 w-8 rounded-lg object-contain bg-white p-1 border border-line shrink-0"
          onError={() => {
            if (customLogo) setLogoFailed(true);
          }}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold truncate">AMS Khảo sát</p>
          <p className="text-[11px] text-fg-subtle truncate">{user.fullName}</p>
        </div>
        {!installed && (
          <button
            type="button"
            onClick={handleInstall}
            aria-label="Cài ứng dụng"
            title="Cài ứng dụng"
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-line bg-surface-2/60 text-fg-muted hover:text-accent active:scale-95 transition"
          >
            <Download className="w-[18px] h-[18px]" />
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          aria-label="Đăng xuất"
          title="Đăng xuất"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-line bg-surface-2/60 text-fg-muted hover:text-danger active:scale-95 transition"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </header>

      {canSurvey ? (
        <>
          <main
            className={
              isMap
                ? 'flex-1 min-h-0 overflow-hidden'
                : 'flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(4rem_+_env(safe-area-inset-bottom))]'
            }
          >
            {children}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-shell/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
            <div className="grid h-16 grid-cols-3 max-w-lg mx-auto">
              {TABS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-semibold transition-colors ${
                      active ? 'text-accent' : 'text-fg-subtle hover:text-fg'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.3 : 1.9} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center space-y-3">
            <p className="text-base font-bold">Không có quyền khảo sát</p>
            <p className="text-sm text-fg-muted">
              Tài khoản này không được thực hiện nhiệm vụ khảo sát thực địa.
            </p>
            <Link
              href="/houses/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white"
            >
              Về trang quản trị
            </Link>
          </div>
        </div>
      )}

      {installHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-5"
          onClick={() => setInstallHelp(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 space-y-3 border border-line"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="install-title" className="text-base font-bold">
                Cài AMS Khảo sát
              </h2>
              <button
                type="button"
                onClick={() => setInstallHelp(false)}
                aria-label="Đóng"
                className="text-fg-subtle hover:text-fg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 text-sm text-fg-muted">
              <Share className="w-5 h-5 shrink-0 text-accent mt-0.5" />
              <p>
                Trên iPhone/iPad: mở bằng Safari, nhấn nút <b>Chia sẻ</b> → <b>Thêm vào Màn hình chính</b>.
              </p>
            </div>
            <p className="text-sm text-fg-muted">
              Trên Android/Chrome: mở menu trình duyệt → <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào Màn hình chính</b>.
            </p>
            <p className="text-xs text-fg-subtle">Cần mở trang bằng HTTPS để dùng GPS, camera và cài đặt.</p>
          </div>
        </div>
      )}
    </div>
  );
}
