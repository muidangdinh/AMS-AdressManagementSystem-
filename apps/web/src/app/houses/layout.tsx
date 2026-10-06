'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Database,
  FileText,
  Globe,
  Hammer,
  Home,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  Moon,
  Route,
  ShieldCheck,
  Sun,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import NotificationBell from '@/components/NotificationBell';
// import WardSelector from '@/components/WardSelector';

/** Icon Lucide cho từng mục điều hướng (UI.md — nhóm icon công nghệ cạnh chữ). */
const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  houses: Database,
  cases: FileText,
  surveys: Route,
  installs: Hammer,
  numbering: ListOrdered,
  usage: Home,
  addresses: MapPin,
  users: UserCheck,
  roles: ShieldCheck,
};

function NavIcon({ name, large }: { name: string; large?: boolean }) {
  const Icon = NAV_ICONS[name];
  return <Icon className={`${large ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} strokeWidth={1.9} />;
}

/** Nhãn nhóm trong sidebar dọc. */
function NavGroup({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-subtle first:pt-1">
      {label}
    </p>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={dark ? 'Giao diện sáng' : 'Giao diện tối'}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2/50 hover:bg-surface-2 border border-line text-fg-muted hover:text-accent transition-all duration-300 active:scale-95"
    >
      {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}

function NavLink({
  href,
  icon,
  children,
  block,
  touch,
  onNavigate,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
  /** Hiển thị dạng khối full-width — dùng cho sidebar dọc. */
  block?: boolean;
  /** Cỡ lớn cho cảm ứng (menu thả xuống trên màn hình nhỏ): vùng chạm ≥ 44px, chữ và icon to hơn. */
  touch?: boolean;
  /** Gọi khi bấm vào link — dùng để đóng menu thả xuống. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // So khớp active theo phần đường dẫn, bỏ qua query string (vd href="/houses?view=table").
  const hrefPath = href.split('?')[0];
  const active = hrefPath === '/houses' ? pathname === '/houses' : pathname.startsWith(hrefPath);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative flex items-center rounded-lg font-semibold transition-all duration-300 ${
        touch ? 'gap-3 px-4 py-3 text-sm active:scale-[0.98]' : 'gap-2.5 px-3 py-2 text-[13px]'
      } ${block ? 'w-full' : ''} ${
        active
          ? // Mục đang ở: nền cyan mờ + vạch cyan phát sáng bên trái (inset shadow — không đổi bố cục).
            'bg-accent/10 text-accent shadow-[inset_3px_0_0_0_rgb(var(--accent)),-4px_0_14px_-6px_rgb(var(--accent))]'
          : 'text-fg-muted hover:text-fg hover:bg-surface-2/60'
      }`}
    >
      <NavIcon name={icon} large={touch} />
      {children}
    </Link>
  );
}

/** Nút "Bản đồ số nhà" trên thanh nav — lấy vị trí GPS hiện tại rồi chuyển sang `/houses` ở chế độ bản đồ, bay tới đó. */
function LocateButton({
  block,
  touch,
  onNavigate,
}: {
  block?: boolean;
  /** Cỡ lớn cho cảm ứng — cùng quy ước với `NavLink`. */
  touch?: boolean;
  /** Gọi khi định vị xong (thành công hoặc lỗi) — dùng để đóng menu thả xuống. Không đóng sớm để còn thấy vòng xoay khi đang chờ GPS. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị vị trí.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onNavigate?.();
        router.push(`/houses?myLat=${pos.coords.latitude}&myLng=${pos.coords.longitude}&t=${Date.now()}`);
      },
      () => {
        setLocating(false);
        onNavigate?.();
        alert('Không lấy được vị trí hiện tại — kiểm tra đã cấp quyền truy cập vị trí cho trình duyệt/thiết bị chưa.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={locating}
      className={`flex items-center rounded-lg font-semibold transition-all duration-300 text-fg-muted hover:text-fg hover:bg-surface-2/60 disabled:opacity-50 shrink-0 ${
        touch ? 'gap-3 px-4 py-3 text-sm active:scale-[0.98]' : 'gap-2.5 px-3 py-2 text-[13px]'
      } ${block ? 'w-full' : ''}`}
    >
      {locating ? (
        <span
          className={`${touch ? 'w-4 h-4' : 'w-3.5 h-3.5'} rounded-full border-2 border-line border-t-accent animate-spin shrink-0`}
        />
      ) : (
        <Globe className={`${touch ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`} strokeWidth={1.9} />
      )}
      Bản đồ số nhà
    </button>
  );
}

/** Bề rộng từ đó sidebar dọc thay cho menu thả xuống — trùng breakpoint `md` của Tailwind. */
const DESKTOP_MIN_WIDTH = 768;
/** Thời gian hiệu ứng đóng menu (ms) — phải ≥ `duration-[300ms]` của lớp đóng ở khối menu bên dưới. */
const NAV_CLOSE_ANIM_MS = 320;

/** Bọc 1 mục menu để nó trượt vào lệch nhịp so với mục trước (hiệu ứng "xếp lớp" khi mở). */
function NavItem({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div className="animate-item-in" style={{ animationDelay: `${140 + index * 50}ms` }}>
      {children}
    </div>
  );
}

export default function HousesLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Menu điều hướng thả xuống — chỉ dùng ở màn hình nhỏ (< md); từ md trở lên đã có sidebar dọc.
  // Ba trạng thái để có hiệu ứng CẢ khi mở lẫn khi đóng (transition CSS cần thấy trạng thái đầu rồi
  // mới đổi sang trạng thái cuối, và phần tử phải còn trên trang suốt lúc đang co lại):
  //   navOpen    = ý muốn của người dùng (nút ☰ đang mở hay đóng)
  //   navMounted = menu có nằm trong DOM không
  //   navShown   = menu đang ở trạng thái "mở hết cỡ" (chiều cao 1fr) hay "khép" (0fr)
  // Mở:  mount (khép) → chờ 2 khung hình để trình duyệt vẽ trạng thái khép → shown (transition mở ra).
  // Đóng: shown=false (transition co lại) → chờ NAV_CLOSE_ANIM_MS → gỡ khỏi DOM.
  const [navOpen, setNavOpen] = useState(false);
  const [navMounted, setNavMounted] = useState(false);
  const [navShown, setNavShown] = useState(false);
  const closeNav = () => setNavOpen(false);

  // Dropdown hồ sơ người dùng (Tài khoản / Đăng xuất) — neo ở góc phải header.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navOpen) {
      setNavMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setNavShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setNavShown(false);
    const timer = setTimeout(() => setNavMounted(false), NAV_CLOSE_ANIM_MS);
    return () => clearTimeout(timer);
  }, [navOpen]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  // Đóng menu khi chuyển trang (kể cả điều hướng bằng nút Back của trình duyệt).
  useEffect(() => {
    setNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  // Đóng dropdown hồ sơ người dùng khi bấm ra ngoài hoặc phím Esc.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  // Đóng menu khi bấm Esc, hoặc khi cửa sổ giãn ra tới cỡ desktop (menu thả xuống bị ẩn nhưng
  // state vẫn còn `true` — nếu không đóng thì thu nhỏ lại sẽ thấy menu tự bật).
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_MIN_WIDTH) setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [navOpen]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-fg-muted text-sm gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-line border-t-accent animate-spin" />
        Đang tải…
      </div>
    );
  }

  const initial = user.fullName?.trim()?.[0]?.toUpperCase() ?? '?';
  // Menu Thi công: người quản lý (giao việc) hoặc nghiệm thu mới dùng trang web này; cán bộ thi công làm trên mobile.
  const canSeeInstalls = hasPermission(PERMISSIONS.INSTALL_MANAGE) || hasPermission(PERMISSIONS.INSTALL_REVIEW);

  return (
    <div className="relative h-screen flex flex-col bg-app-shell overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <header className="print:hidden bg-shell/80 backdrop-blur-md border-b border-line text-fg h-16 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-20 sticky top-0">
        <Link
          href="/houses/dashboard"
          aria-label="Tây Ninh — Hệ thống Đánh số & Gắn biển số nhà"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          {/* Logo trắng nền trong suốt nên ăn theo màu thanh nav. Dưới sm chỉ lấy biểu tượng ngôi nhà
              (khung hẹp cắt bớt phần chữ bên phải); từ sm trở lên hiện cả logo — cùng 1 ảnh, chỉ đổi bề rộng khung. */}
          <div className="relative h-14 w-12 sm:w-[226px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Tây Ninh"
              width={1600}
              height={397}
              className="absolute top-0 -left-[3px] sm:left-0 h-14 w-auto max-w-none invert dark:invert-0"
            />
          </div>
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* <WardSelector /> */}
          <ThemeToggle />
          <NotificationBell />
          {/* Hồ sơ người dùng — bấm mở dropdown "Tài khoản" / "Đăng xuất". */}
          <div className="relative pl-3 border-l border-line" ref={accountMenuRef}>
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-surface-2/60 transition-colors"
            >
              <div className="relative w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-glow-accent">
                {initial}
              </div>
              <div className="hidden sm:block text-right text-xs leading-tight">
                <p className="font-semibold text-fg">{user.fullName}</p>
                <p className="text-fg-subtle">
                  {user.roles?.length
                    ? user.roles.map((r) => r.name).join(', ')
                    : USER_ROLE_LABELS[user.role as UserRole]}
                </p>
              </div>
              <ChevronDown
                className={`hidden sm:block w-3.5 h-3.5 text-fg-subtle transition-transform ${
                  accountMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-48 glass !bg-surface/95 py-1.5 text-fg z-30"
              >
                <Link
                  href="/houses/account"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-surface-2/70"
                >
                  Tài khoản
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-left text-danger hover:bg-danger/10"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
          {/* Nút bật/tắt menu điều hướng — chỉ hiện ở màn hình nhỏ (< md), nơi sidebar dọc bị ẩn. */}
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-label="Bật/tắt menu điều hướng"
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2/50 hover:bg-surface-2 border border-line transition-colors active:scale-95"
          >
            {/* 3 thanh biến hình: thanh trên/dưới xoay thành dấu ✕, thanh giữa mờ đi — mượt hơn đổi icon. */}
            <span aria-hidden className="relative block w-5 h-3.5">
              <span
                className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all duration-300 ${
                  navOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'
                }`}
              />
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 block h-0.5 w-5 rounded bg-current transition-all duration-200 ${
                  navOpen ? 'opacity-0 scale-x-0' : ''
                }`}
              />
              <span
                className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all duration-300 ${
                  navOpen ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'top-full -translate-y-full'
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      {/* Menu điều hướng thả xuống cho màn hình nhỏ (< md): bấm nút ☰ ở header để mở. Nằm đè lên nội
          trang (không đẩy nội dung xuống); bấm ra ngoài / Esc / chọn 1 mục / đổi trang đều tự đóng.
          CỐ Ý không dùng `motion-reduce:*` cho menu này và nút ☰: nhiều máy nhân viên (máy ảo, remote
          desktop, hoặc đã tắt "hiệu ứng động" của Windows) báo `prefers-reduced-motion: reduce` khiến
          hiệu ứng biến mất hoàn toàn — yêu cầu là phải thấy rõ hiệu ứng đóng/mở. */}
      {navMounted && (
        <>
          {/* Nền tối: mờ dần vào/ra. Khi đang đóng thì `pointer-events-none` để không nuốt cú bấm. */}
          <div
            aria-hidden
            onClick={closeNav}
            className={`print:hidden md:hidden absolute left-0 right-0 bottom-0 top-16 z-20 bg-canvas/60 backdrop-blur-[2px] transition-opacity ${
              navShown ? 'opacity-100 duration-300' : 'opacity-0 duration-200 pointer-events-none'
            }`}
          />
          {/* Menu "thả xuống": khung ngoài là grid, hàng duy nhất đổi 0fr ↔ 1fr nên chiều cao mở ra/co lại
              từ 0 mà không cần biết trước chiều cao thật (khác `max-height` phải đoán số). Nội dung bên trong
              `min-h-0 overflow-hidden` để bị cắt theo chiều cao đang chạy. Đường cong mở là Material standard
              (0.4,0,0.2,1): khởi động nhẹ rồi rơi rõ và giảm tốc êm — đã đo: 160px ở 150ms, 243px ở 200ms,
              xong ~450ms. (Thử `(0.22,1,0.36,1)` thì đi 175px chỉ trong 50ms đầu → mắt thấy như bật ra, không
              thấy "thả".) Đóng ngắn hơn (300ms) và ease-in cho gọn. */}
          <div
            id="mobile-nav"
            className={`print:hidden md:hidden absolute left-0 right-0 top-16 z-30 grid transition-[grid-template-rows,box-shadow] ${
              navShown
                ? 'grid-rows-[1fr] shadow-2xl duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]'
                : 'grid-rows-[0fr] pointer-events-none duration-[300ms] ease-in'
            }`}
          >
            <nav aria-label="Điều hướng chính" className="min-h-0 overflow-hidden bg-shell text-fg">
              <div
                className={`flex flex-col gap-1 p-2 border-t border-line max-h-[calc(100vh-4rem)] overflow-y-auto transition-opacity ${
                  navShown ? 'opacity-100 duration-300 delay-75' : 'opacity-0 duration-150'
                }`}
              >
                <NavItem index={0}>
                  <NavLink href="/houses/dashboard" icon="dashboard" block touch onNavigate={closeNav}>
                    Tổng quan
                  </NavLink>
                </NavItem>
                <NavItem index={1}>
                  <NavLink href="/houses?view=table" icon="houses" block touch onNavigate={closeNav}>
                    Hồ sơ nhà
                  </NavLink>
                </NavItem>
                <NavItem index={2}>
                  <NavLink href="/houses/cases" icon="cases" block touch onNavigate={closeNav}>
                    Hồ sơ
                  </NavLink>
                </NavItem>
                <NavItem index={3}>
                  <NavLink href="/houses/surveys" icon="surveys" block touch onNavigate={closeNav}>
                    Khảo sát
                  </NavLink>
                </NavItem>
                {canSeeInstalls && (
                  <NavItem index={4}>
                    <NavLink href="/houses/installs" icon="installs" block touch onNavigate={closeNav}>
                      Thi công
                    </NavLink>
                  </NavItem>
                )}
                <NavItem index={4}>
                  <NavLink href="/houses/numbering" icon="numbering" block touch onNavigate={closeNav}>
                    Đánh số
                  </NavLink>
                </NavItem>
                {hasPermission(PERMISSIONS.ADDRESS_WRITE) && (
                  <NavItem index={5}>
                    <NavLink href="/houses/usage-statuses" icon="usage" block touch onNavigate={closeNav}>
                      Hiện trạng nhà
                    </NavLink>
                  </NavItem>
                )}
                {hasPermission(PERMISSIONS.ADDRESS_WRITE) && (
                  <NavItem index={5}>
                    <NavLink href="/houses/addresses" icon="addresses" block touch onNavigate={closeNav}>
                      Quản lý tuyến đường
                    </NavLink>
                  </NavItem>
                )}
                {hasPermission(PERMISSIONS.USER_MANAGE) && (
                  <NavItem index={6}>
                    <NavLink href="/houses/users" icon="users" block touch onNavigate={closeNav}>
                      Người dùng
                    </NavLink>
                  </NavItem>
                )}
                {hasPermission(PERMISSIONS.ROLE_MANAGE) && (
                  <NavItem index={7}>
                    <NavLink href="/houses/roles" icon="roles" block touch onNavigate={closeNav}>
                      Vai trò & phân quyền
                    </NavLink>
                  </NavItem>
                )}
                <NavItem index={8}>
                  <LocateButton block touch onNavigate={closeNav} />
                </NavItem>
              </div>
            </nav>
          </div>
        </>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar dọc — desktop/tablet (≥ md) */}
        <nav className="print:hidden hidden md:flex md:flex-col gap-1 w-60 shrink-0 bg-shell/95 backdrop-blur-md text-fg p-3 overflow-y-auto border-r border-line">
          <NavGroup label="Nghiệp vụ" />
          <NavLink href="/houses/dashboard" icon="dashboard" block>
            Tổng quan
          </NavLink>
          <NavLink href="/houses?view=table" icon="houses" block>
            Hồ sơ nhà
          </NavLink>
          <NavLink href="/houses/cases" icon="cases" block>
            Hồ sơ
          </NavLink>
          <NavLink href="/houses/surveys" icon="surveys" block>
            Khảo sát
          </NavLink>
          {canSeeInstalls && (
            <NavLink href="/houses/installs" icon="installs" block>
              Thi công
            </NavLink>
          )}
          <NavLink href="/houses/numbering" icon="numbering" block>
            Đánh số
          </NavLink>
          {hasPermission(PERMISSIONS.ADDRESS_WRITE) && (
            <NavLink href="/houses/usage-statuses" icon="usage" block>
              Hiện trạng nhà
            </NavLink>
          )}
          <LocateButton block />
          {hasPermission(PERMISSIONS.ADDRESS_WRITE) && (
            <>
              <NavGroup label="Danh mục" />
              <NavLink href="/houses/addresses" icon="addresses" block>
                Quản lý tuyến đường
              </NavLink>
            </>
          )}
          {(hasPermission(PERMISSIONS.USER_MANAGE) || hasPermission(PERMISSIONS.ROLE_MANAGE)) && (
            <NavGroup label="Hệ thống" />
          )}
          {hasPermission(PERMISSIONS.USER_MANAGE) && (
            <NavLink href="/houses/users" icon="users" block>
              Người dùng
            </NavLink>
          )}
          {hasPermission(PERMISSIONS.ROLE_MANAGE) && (
            <NavLink href="/houses/roles" icon="roles" block>
              Vai trò & phân quyền
            </NavLink>
          )}
        </nav>

        <main className="flex-1 overflow-hidden print:overflow-visible print:flex-none">
          {children}
        </main>
      </div>
    </div>
  );
}
