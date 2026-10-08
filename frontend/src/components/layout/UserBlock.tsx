'use client';

import { Dropdown } from 'antd';
import { CaretUp, Key, SignOut } from '@phosphor-icons/react';
import { useCurrentUser, useLogout } from '@/features/auth/hooks';
import { useUiStore } from '@/stores/ui-store';

const ROLE_LABEL = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' } as const;

/** Tài khoản đang đăng nhập, ở đáy sidebar: đổi mật khẩu và đăng xuất */
export function UserBlock() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const setChangePasswordOpen = useUiStore((s) => s.setChangePasswordOpen);

  if (!user) return null;

  const initial = user.fullName.trim().charAt(0).toUpperCase() || '?';

  return (
    <Dropdown
      trigger={['click']}
      placement="topLeft"
      menu={{
        items: [
          { key: 'password', icon: <Key size={16} />, label: 'Đổi mật khẩu' },
          { key: 'logout', icon: <SignOut size={16} />, label: 'Đăng xuất', danger: true },
        ],
        onClick: ({ key }) => {
          if (key === 'password') setChangePasswordOpen(true);
          if (key === 'logout') logout.mutate();
        },
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl border border-rail-line/40 bg-rail-2/60 p-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_6px_rgba(0,0,0,0.2)] transition-all hover:bg-rail-2 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_10px_rgba(0,0,0,0.3)] active:translate-y-0.5"
        aria-label="Tài khoản"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rail to-[#0d161f] text-sm font-bold text-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)] border border-rail-line/60">
          {initial}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">{user.fullName}</span>
          <span className="block truncate text-xs text-rail-text font-medium">{ROLE_LABEL[user.role]}</span>
        </span>
        <CaretUp size={14} className="shrink-0 text-rail-text" aria-hidden />
      </button>
    </Dropdown>
  );
}
