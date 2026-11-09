'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClipboardList, Download, Eye, EyeOff, LogOut, Map as MapIcon, MapPin, Share, UserRound, X } from 'lucide-react';
import { PERMISSIONS, USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getApiUrl } from '@/lib/api';
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
  const { user, isLoading, logout, hasPermission, changePassword, updateUnit } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(false);
  const [unitDraft, setUnitDraft] = useState('');
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [unitSuccess, setUnitSuccess] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({ current: false, next: false, confirm: false });
  const customLogo = config.appLogoUrl
    ? `${getApiUrl().replace(/\/$/, '')}${config.appLogoUrl}`
    : null;

  useEffect(() => {
    setLogoFailed(false);
  }, [customLogo]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

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

  function openAccount() {
    setProfileMenuOpen(false);
    setUnitDraft(user?.unit ?? '');
    setEditingUnit(false);
    setUnitError(null);
    setUnitSuccess(false);
    setPasswordError(null);
    setPasswordSuccess(false);
    setAccountOpen(true);
  }

  function closeAccount() {
    if (savingUnit || savingPassword) return;
    setAccountOpen(false);
  }

  async function handleSaveUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnitError(null);
    setUnitSuccess(false);
    setSavingUnit(true);
    try {
      await updateUnit({ unit: unitDraft });
      setEditingUnit(false);
      setUnitSuccess(true);
    } catch (err) {
      setUnitError(err instanceof ApiError ? err.message : 'Không cập nhật được đơn vị');
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu mới nhập lại không khớp');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Không đổi được mật khẩu');
    } finally {
      setSavingPassword(false);
    }
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((open) => !open)}
            aria-label="Hồ sơ người dùng"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            title="Hồ sơ người dùng"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-line bg-accent/10 text-accent font-bold active:scale-95 transition"
          >
            {user.fullName.trim().charAt(0).toLocaleUpperCase() || <UserRound className="w-[18px] h-[18px]" />}
          </button>
          {profileMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Đóng menu hồ sơ"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setProfileMenuOpen(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-line bg-surface py-1.5 text-fg shadow-xl"
              >
                <div className="border-b border-line px-4 py-2">
                  <p className="truncate text-sm font-semibold">{user.fullName}</p>
                  <p className="truncate text-xs text-fg-subtle">{user.username}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={openAccount}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-2"
                >
                  Tài khoản
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-danger hover:bg-danger/10"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {accountOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAccount();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-account-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-canvas text-fg shadow-2xl sm:rounded-2xl"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-canvas/95 px-5 py-4 backdrop-blur">
              <div>
                <h2 id="pwa-account-title" className="text-lg font-bold">Tài khoản</h2>
                <p className="text-xs text-fg-subtle">Thông tin tài khoản đang đăng nhập</p>
              </div>
              <button
                type="button"
                onClick={closeAccount}
                disabled={savingUnit || savingPassword}
                aria-label="Đóng hồ sơ"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-muted hover:bg-surface-2 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-xl border border-line bg-surface p-4 text-sm">
                <ProfileRow label="Họ tên" value={user.fullName} />
                <ProfileRow label="Tên đăng nhập" value={user.username} />
                <ProfileRow label="Vai trò" value={USER_ROLE_LABELS[user.role as UserRole]} />
                {editingUnit ? (
                  <form onSubmit={handleSaveUnit} className="mt-3 space-y-2">
                    <label htmlFor="pwa-account-unit" className="block text-xs font-semibold text-fg-muted">
                      Đơn vị
                    </label>
                    <input
                      id="pwa-account-unit"
                      value={unitDraft}
                      onChange={(event) => setUnitDraft(event.target.value)}
                      placeholder="VD: Sở Xây dựng Tây Ninh"
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingUnit(false)}
                        disabled={savingUnit}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-fg-muted hover:bg-surface-2 disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingUnit}
                        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {savingUnit ? 'Đang lưu…' : 'Lưu'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <ProfileRow
                    label={user.department ? 'Phòng ban' : 'Đơn vị'}
                    value={user.department?.name ?? user.unit ?? '—'}
                    onEdit={user.department ? undefined : () => {
                      setUnitDraft(user.unit ?? '');
                      setUnitError(null);
                      setUnitSuccess(false);
                      setEditingUnit(true);
                    }}
                  />
                )}
                <ProfileRow label="Chức vụ" value={user.position ?? '—'} />
                {unitError && <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{unitError}</p>}
                {unitSuccess && <p className="mt-3 rounded-lg bg-ok/10 p-2.5 text-sm text-ok">Đã cập nhật đơn vị.</p>}
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Đổi mật khẩu</h3>
                {([
                  ['current', 'Mật khẩu hiện tại', currentPassword, setCurrentPassword, 'current-password'],
                  ['next', 'Mật khẩu mới', newPassword, setNewPassword, 'new-password'],
                  ['confirm', 'Xác nhận mật khẩu mới', confirmPassword, setConfirmPassword, 'new-password'],
                ] as const).map(([field, label, value, setValue, autoComplete]) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-xs font-semibold text-fg-muted">{label}</span>
                    <span className="relative block">
                      <input
                        type={passwordVisibility[field] ? 'text' : 'password'}
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        autoComplete={autoComplete}
                        minLength={field === 'current' ? undefined : 6}
                        required
                        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 pr-10 text-sm text-fg outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        aria-label={passwordVisibility[field] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        onClick={() =>
                          setPasswordVisibility((visibility) => ({ ...visibility, [field]: !visibility[field] }))
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-subtle hover:text-fg"
                      >
                        {passwordVisibility[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </span>
                  </label>
                ))}
                {passwordError && <p role="alert" className="rounded-lg bg-danger/10 p-2.5 text-sm text-danger">{passwordError}</p>}
                {passwordSuccess && <p className="rounded-lg bg-ok/10 p-2.5 text-sm text-ok">Đổi mật khẩu thành công.</p>}
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {savingPassword ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}

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

function ProfileRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-line/70 py-2 last:border-b-0">
      <span className="shrink-0 text-fg-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        <span className="truncate font-semibold text-fg">{value}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="shrink-0 text-xs font-semibold text-accent">
            Sửa
          </button>
        )}
      </span>
    </div>
  );
}
