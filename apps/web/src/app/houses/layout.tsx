'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import NotificationBell from '@/components/NotificationBell';
// import WardSelector from '@/components/WardSelector';

const NAV_ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <path d="M3 13h4v-2H3v2zm0 6h4v-6H3v6zm6 0h4V9H9v10zm6 0h4V3h-4v16z" />
  ),
  houses: <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />,
  cases: (
    <path d="M4 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2H4zm0 2h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
  ),
  surveys: (
    <path d="M9 3v2H4v16h16V5h-5V3H9zm3 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 9c1-2 3.5-3 6-3s5 1 6 3H6z" />
  ),
  numbering: (
    <path d="M4 4h4v4H4V4zm6 1h10v2H10V5zM4 10h4v4H4v-4zm6 1h10v2H10v-2zM4 16h4v4H4v-4zm6 1h10v2H10v-2z" />
  ),
  addresses: (
    <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  ),
  users: (
    <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05A4.2 4.2 0 0 1 17 16.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  ),
};

function NavIcon({ name, large }: { name: string; large?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${large ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`}>
      {NAV_ICONS[name]}
    </svg>
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
      className={`flex items-center rounded-lg font-semibold transition-all duration-150 ${
        touch ? 'gap-3 px-4 py-3 text-sm active:scale-[0.98]' : 'gap-1.5 px-3 py-1.5 text-xs'
      } ${block ? 'w-full' : ''} ${
        active
          ? // Menu cảm ứng: thêm vạch nhấn xanh bên trái cho mục đang ở (inset shadow — không đổi bố cục).
            `bg-white/10 text-white ${touch ? 'shadow-[inset_3px_0_0_0_#3b82f6]' : ''}`
          : 'text-slate-400 hover:text-white hover:bg-white/5'
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
      className={`flex items-center rounded-lg font-semibold transition-all duration-150 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-50 shrink-0 ${
        touch ? 'gap-3 px-4 py-3 text-sm active:scale-[0.98]' : 'gap-1.5 px-3 py-1.5 text-xs'
      } ${block ? 'w-full' : ''}`}
    >
      {locating ? (
        <span
          className={`${touch ? 'w-4 h-4' : 'w-3.5 h-3.5'} rounded-full border-2 border-slate-400 border-t-white animate-spin shrink-0`}
        />
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${touch ? 'w-5 h-5' : 'w-4 h-4'} shrink-0`}>
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
        </svg>
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
  const { user, isLoading, logout } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
        Đang tải…
      </div>
    );
  }

  const initial = user.fullName?.trim()?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative h-screen flex flex-col bg-app-shell overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <header className="print:hidden bg-slate-900/95 backdrop-blur text-white h-16 px-4 sm:px-6 flex items-center justify-between gap-2 shrink-0 shadow-lg z-20 sticky top-0">
        <Link
          href="/houses/dashboard"
          aria-label="Tây Ninh GIS — Hệ thống Đánh số & Gắn biển số nhà"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          {/* Logo trắng nền trong suốt nên ăn theo màu thanh nav. Dưới sm chỉ lấy biểu tượng ngôi nhà
              (khung hẹp cắt bớt phần chữ bên phải); từ sm trở lên hiện cả logo — cùng 1 ảnh, chỉ đổi bề rộng khung. */}
          <div className="relative h-14 w-12 sm:w-[226px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Tây Ninh GIS"
              width={1600}
              height={397}
              className="absolute top-0 -left-[3px] sm:left-0 h-14 w-auto max-w-none"
            />
          </div>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          {/* <WardSelector /> */}
          <NotificationBell />
          {/* Hồ sơ người dùng — bấm mở dropdown "Tài khoản" / "Đăng xuất". */}
          <div className="relative pl-3 border-l border-white/10" ref={accountMenuRef}>
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                {initial}
              </div>
              <div className="hidden sm:block text-right text-xs leading-tight">
                <p className="font-semibold text-slate-100">{user.fullName}</p>
                <p className="text-slate-400">{USER_ROLE_LABELS[user.role as UserRole]}</p>
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${
                  accountMenuOpen ? 'rotate-180' : ''
                }`}
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-soft border border-slate-200 py-1.5 text-slate-700 z-30"
              >
                <Link
                  href="/houses/account"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Tài khoản
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-left text-rose-600 hover:bg-rose-50"
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
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors active:scale-95"
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
            className={`print:hidden md:hidden absolute left-0 right-0 bottom-0 top-16 z-20 bg-slate-950/50 backdrop-blur-[2px] transition-opacity ${
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
            <nav aria-label="Điều hướng chính" className="min-h-0 overflow-hidden bg-slate-900 text-white">
              <div
                className={`flex flex-col gap-1 p-2 border-t border-white/10 max-h-[calc(100vh-4rem)] overflow-y-auto transition-opacity ${
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
                <NavItem index={4}>
                  <NavLink href="/houses/numbering" icon="numbering" block touch onNavigate={closeNav}>
                    Đánh số
                  </NavLink>
                </NavItem>
                {user.role === UserRole.ADMIN && (
                  <NavItem index={5}>
                    <NavLink href="/houses/addresses" icon="addresses" block touch onNavigate={closeNav}>
                      Quản lý tuyến đường
                    </NavLink>
                  </NavItem>
                )}
                {user.role === UserRole.ADMIN && (
                  <NavItem index={6}>
                    <NavLink href="/houses/users" icon="users" block touch onNavigate={closeNav}>
                      Người dùng
                    </NavLink>
                  </NavItem>
                )}
                <NavItem index={user.role === UserRole.ADMIN ? 7 : 5}>
                  <LocateButton block touch onNavigate={closeNav} />
                </NavItem>
              </div>
            </nav>
          </div>
        </>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar dọc — desktop/tablet (≥ md) */}
        <nav className="print:hidden hidden md:flex md:flex-col gap-1 w-56 shrink-0 bg-slate-900/95 text-white p-3 overflow-y-auto border-r border-white/5">
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
          <NavLink href="/houses/numbering" icon="numbering" block>
            Đánh số
          </NavLink>
          {user.role === UserRole.ADMIN && (
            <NavLink href="/houses/addresses" icon="addresses" block>
              Quản lý tuyến đường
            </NavLink>
          )}
          {user.role === UserRole.ADMIN && (
            <NavLink href="/houses/users" icon="users" block>
              Người dùng
            </NavLink>
          )}
          <LocateButton block />
        </nav>

        <main className="flex-1 overflow-hidden print:overflow-visible print:flex-none">
          {children}
        </main>
      </div>
    </div>
  );
}
