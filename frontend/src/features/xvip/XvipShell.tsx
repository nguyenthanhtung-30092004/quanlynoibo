'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CaretDown,
  ChartBar,
  Gear,
  Handshake,
  List,
  MapPin,
  SignOut,
  SquaresFour,
  Ticket,
  UserCircle,
  Wallet,
  type Icon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { ThemeProvider, ThemeToggle } from './theme';
import { DateFilterProvider, DateRangeFilter } from './date-filter';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Chỉ Admin thấy mục này */
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/xvip', label: 'Tổng quan', icon: SquaresFour, adminOnly: true },
  { href: '/xvip/quan-ly-ve', label: 'Quản lý vé / Đơn', icon: Ticket },
  { href: '/xvip/doi-tac', label: 'Đối tác', icon: Handshake, adminOnly: true },
  { href: '/xvip/tuyen-duong', label: 'Tuyến đường', icon: MapPin, adminOnly: true },
  { href: '/xvip/nhan-vien', label: 'Nhân viên', icon: UserCircle, adminOnly: true },
  { href: '/xvip/cong-no', label: 'Công nợ', icon: Wallet, adminOnly: true },
  { href: '/xvip/bao-cao', label: 'Báo cáo', icon: ChartBar },
  { href: '/xvip/cai-dat', label: 'Cài đặt', icon: Gear, adminOnly: true },
];

const ROLE_LABEL = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' } as const;

/** "Nguyễn Văn A" -> "NA" (chữ đầu của họ và của tên) */
function initialsOf(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toLocaleUpperCase('vi');
}

/** Khối người dùng ở header: bấm để mở menu có nút Đăng xuất */
function UserMenu() {
  const { data: me } = useCurrentUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-1.5 pr-3 shadow-[inset_0_1px_0_#fff,0_2px_0_#cbd5e1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_0_#0f172a] border border-slate-200 dark:border-slate-700 active:translate-y-0.5"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-blue-700 text-xs font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_0_#1d4ed8]">
          {me ? initialsOf(me.fullName) : '…'}
        </span>
        <div className="hidden leading-tight sm:block text-left">
          <span className="block max-w-40 truncate text-xs font-bold text-slate-800 dark:text-white">
            {me?.fullName ?? 'Đang tải...'}
          </span>
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {me ? ROLE_LABEL[me.role] : ''}
          </span>
        </div>
        <CaretDown size={12} aria-hidden className={cn('text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <SignOut size={18} weight="bold" aria-hidden />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me } = useCurrentUser();
  const logout = useLogout();
  const isAdmin = me?.role === 'ADMIN';

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gradient-to-b dark:from-[#091528] dark:via-xv-navy dark:to-[#060e1a] text-slate-800 dark:text-xv-text shadow-[2px_0_16px_rgba(0,0,0,0.04)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)] border-r border-slate-200 dark:border-[#1a2d4f] transition-colors duration-200">
      {/* 3D Gold Logo XVIP - Sáng rõ, nổi bật và sang trọng */}
      <div className="px-5 pb-5 pt-6 text-center border-b border-slate-200/80 dark:border-[#14284B]/60">
        <Link href="/xvip" className="group inline-block">
          <div className="inline-block rounded-2xl bg-gradient-to-b from-slate-900 to-[#102347] dark:from-[#14284B] dark:to-[#0b172d] px-5 py-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_0_#07101f,0_8px_16px_rgba(0,0,0,0.25)] border border-[#223d70]/50 transition-transform group-hover:scale-105 active:scale-95">
            <div className="text-3xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 drop-shadow-[0_2px_0_#78350f]">
              XVIP
            </div>
          </div>
          <div className="mt-2.5 text-[11px] font-black uppercase leading-tight tracking-widest text-slate-700 dark:text-slate-300 drop-shadow-sm">
            Điều hành &amp; Quản lý vé
          </div>
        </Link>
      </div>

      {/* Nav List with Bright, Crisp Text in Light Mode & Glowing Depth in Dark Mode */}
      <nav aria-label="Menu chính" className="flex-1 overflow-y-auto px-3.5 py-4">
        <ul className="flex flex-col gap-2">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
            const active = href === '/xvip' ? pathname === '/xvip' : pathname.startsWith(href);
            return (
              <li key={label}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all duration-100',
                    active
                      ? 'border-l-4 border-amber-400 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_0_#1d4ed8,0_8px_16px_rgba(37,99,235,0.3)] -translate-y-0.5'
                      : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/80 hover:-translate-y-0.5 hover:shadow-[0_3px_0_#cbd5e1] active:translate-y-1 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white dark:hover:shadow-[0_3px_0_rgba(0,0,0,0.2)]',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-lg transition-transform duration-100 group-hover:scale-110',
                      active
                        ? 'bg-white/20 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
                        : 'text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-amber-400',
                    )}
                  >
                    <Icon size={19} weight={active ? 'fill' : 'bold'} aria-hidden />
                  </div>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Status Tag & Mobile Theme Indicator */}
      <div className="p-3 border-t border-slate-200/80 dark:border-[#14284B]/60 text-center">
        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-black/30 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          <span>Hệ thống trực tuyến</span>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
        >
          <SignOut size={16} weight="bold" aria-hidden />
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

export function XvipShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ThemeProvider>
      <DateFilterProvider>
        <div className="flex min-h-dvh bg-slate-100/70 dark:bg-[#0b1326] text-slate-800 dark:text-slate-100 transition-colors duration-200">
          {/* Sidebar Desktop */}
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block z-30">
            <Sidebar />
          </aside>

          {/* Drawer Mobile */}
          {open && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                aria-label="Đóng menu"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 w-64">
                <Sidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header with 3D Depth & Theme/Sound Toggles */}
            <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 sm:px-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-colors duration-200">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Mở menu"
                className="btn-3d-mini flex size-9 items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 lg:hidden"
              >
                <List size={22} weight="bold" />
              </button>

              <div className="hidden items-center gap-2 sm:flex">
                <div className="size-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                <span className="font-extrabold tracking-tight text-slate-800 dark:text-white text-sm">
                  CÔNG TY TNHH TM &amp; DV XVIP
                </span>
              </div>

              <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
                {/* Nút Chuyển Đổi Sáng / Tối 3D */}
                <ThemeToggle />

              <DateRangeFilter />

              <button
                type="button"
                aria-label="Thông báo"
                className="btn-3d-mini relative size-9 rounded-xl"
              >
                <Bell size={20} weight="bold" />
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-[0_2px_4px_rgba(225,29,72,0.5)]">
                  3
                </span>
              </button>

              <UserMenu />
            </div>

              {/* Thanh lọc ngày đi trên điện thoại */}
              <DateRangeFilter mobile />
          </header>

          <main className="w-full flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </DateFilterProvider>
  </ThemeProvider>
);
}
