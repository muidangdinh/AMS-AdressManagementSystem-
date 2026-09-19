'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import WardSelector from '@/components/WardSelector';

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
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
      {NAV_ICONS[name]}
    </svg>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/houses' ? pathname === '/houses' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? 'bg-white/10 text-white'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <NavIcon name={icon} />
      {children}
    </Link>
  );
}

export default function HousesLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

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
    <div className="h-screen flex flex-col bg-app-shell overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <header className="print:hidden bg-slate-900/95 backdrop-blur text-white h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-lg z-20 sticky top-0">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/houses" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" fill="currentColor" />
              </svg>
            </div>
            <div className="hidden sm:block leading-tight">
              <h1 className="text-sm font-bold tracking-wide">CSDL SỐ NHÀ</h1>
              <p className="text-[10px] text-slate-400 font-medium">Tây Ninh GIS</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/houses/dashboard" icon="dashboard">
              Tổng quan
            </NavLink>
            <NavLink href="/houses" icon="houses">
              Hồ sơ nhà
            </NavLink>
            <NavLink href="/houses/cases" icon="cases">
              Hồ sơ
            </NavLink>
            <NavLink href="/houses/surveys" icon="surveys">
              Khảo sát
            </NavLink>
            <NavLink href="/houses/numbering" icon="numbering">
              Đánh số
            </NavLink>
            {user.role === UserRole.ADMIN && (
              <NavLink href="/houses/addresses" icon="addresses">
                Địa chỉ
              </NavLink>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <WardSelector />
          <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-white/10">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {initial}
            </div>
            <div className="text-right text-xs leading-tight">
              <p className="font-semibold text-slate-100">{user.fullName}</p>
              <p className="text-slate-400">{USER_ROLE_LABELS[user.role as UserRole]}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Thanh nav phụ cho màn hình nhỏ (nav chính ẩn ở md:hidden) */}
      <nav className="print:hidden md:hidden flex items-center gap-1 overflow-x-auto bg-slate-900/95 text-white px-3 py-2 shrink-0 border-t border-white/5">
        <NavLink href="/houses/dashboard" icon="dashboard">
          Tổng quan
        </NavLink>
        <NavLink href="/houses" icon="houses">
          Hồ sơ nhà
        </NavLink>
        <NavLink href="/houses/cases" icon="cases">
          Hồ sơ
        </NavLink>
        <NavLink href="/houses/surveys" icon="surveys">
          Khảo sát
        </NavLink>
        <NavLink href="/houses/numbering" icon="numbering">
          Đánh số
        </NavLink>
        {user.role === UserRole.ADMIN && (
          <NavLink href="/houses/addresses" icon="addresses">
            Địa chỉ
          </NavLink>
        )}
      </nav>

      <main className="flex-1 overflow-hidden print:overflow-visible print:flex-none">
        {children}
      </main>
    </div>
  );
}
