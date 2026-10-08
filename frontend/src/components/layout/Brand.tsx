import { Van } from '@phosphor-icons/react';

/** Logo + tên hệ thống phong cách 3D */
export function Brand({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#ffd766] via-[#f2a900] to-[#c78b00] text-accent-ink shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_3px_0_#9e6f00,0_6px_14px_rgba(242,169,0,0.35)] transition-transform hover:scale-105 active:scale-95">
        <Van size={24} weight="fill" aria-hidden className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className={tone === 'light' ? 'font-bold tracking-tight text-white' : 'font-bold tracking-tight text-ink'}>
          Điều hành
        </div>
        <div className={tone === 'light' ? 'text-xs font-medium text-rail-text' : 'text-xs font-medium text-ink-3'}>
          Đặt xe nội bộ
        </div>
      </div>
    </div>
  );
}
