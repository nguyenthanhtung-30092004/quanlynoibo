'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Buildings, ClipboardText, MapTrifold, UsersThree, type Icon } from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import type { UserRole } from '@/features/auth/types';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Vai trò được thấy mục này */
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Đơn hàng', icon: ClipboardText, roles: ['ADMIN', 'STAFF'] },
  { href: '/routes', label: 'Tuyến đường', icon: MapTrifold, roles: ['ADMIN'] },
  { href: '/carriers', label: 'Nhà xe', icon: Buildings, roles: ['ADMIN'] },
  { href: '/staff', label: 'Nhân viên', icon: UsersThree, roles: ['ADMIN'] },
];

/** Gọi sau khi bấm một mục (ví dụ đóng ngăn kéo trên điện thoại) */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <nav aria-label="Menu chính">
      <ul className="flex flex-col gap-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-150',
                  active
                    ? 'border-l-[3.5px] border-accent bg-gradient-to-r from-rail-2 to-[#192735] pl-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_12px_rgba(0,0,0,0.25)]'
                    : 'text-rail-text hover:bg-white/5 hover:text-white',
                )}
              >
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-md transition-all',
                    active
                      ? 'bg-accent/20 text-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                      : 'text-rail-text',
                  )}
                >
                  <Icon
                    size={19}
                    weight={active ? 'fill' : 'regular'}
                    className={active ? 'text-accent' : undefined}
                    aria-hidden
                  />
                </div>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
