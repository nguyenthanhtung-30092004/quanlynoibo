'use client';

import { useState, type ReactNode } from 'react';
import { Drawer } from 'antd';
import { List } from '@phosphor-icons/react';
import { Brand } from './Brand';
import { NavLinks } from './NavLinks';
import { UserBlock } from './UserBlock';

function RailContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="on-rail flex h-full flex-col bg-gradient-to-b from-rail via-[#14202B] to-[#0f1821] shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]">
      <div className="px-4 py-5 border-b border-rail-line/30">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="border-t border-rail-line/60 p-3 bg-rail/50 backdrop-blur-sm">
        <UserBlock />
      </div>
    </div>
  );
}

/** Khung ứng dụng: menu trái cố định (màn hình lớn) hoặc ngăn kéo (điện thoại) */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block border-r border-rail-line/50 shadow-[4px_0_24px_rgba(0,0,0,0.18)] z-20">
        <RailContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 backdrop-blur-md px-4 py-3 shadow-3d-sm lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Mở menu"
            className="flex size-9 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink shadow-3d-sm hover:bg-surface-2 active:translate-y-0.5"
          >
            <List size={20} />
          </button>
          <span className="font-bold text-ink">Điều hành</span>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={270}
        closable={false}
        styles={{ body: { padding: 0, background: '#14202B' } }}
      >
        <RailContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}
