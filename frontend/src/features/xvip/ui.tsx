import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { TicketStatus } from './data';

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const flush = className?.includes('!p-0') ?? false;
  return (
    <section className={cn('card-3d-xvip p-5 transition-colors duration-200', className)}>
      {title && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800/80',
            // Thẻ bỏ lề (!p-0) để bảng tràn viền: tiêu đề vẫn phải có lề riêng
            flush ? 'px-5 pt-5' : 'mb-4',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.8)]" />
            <h2 className="font-bold text-slate-800 dark:text-white text-base">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-7 w-1.5 rounded-full bg-xv-blue shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] dark:drop-shadow-none transition-colors">
          {children}
        </h1>
      </div>
      {actions}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initial = name.trim().split(' ').pop()?.charAt(0) ?? '?';
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 shadow-[inset_0_1px_0_#fff,0_2px_0_#cbd5e1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_#0f172a] border border-slate-300 dark:border-slate-600">
      {initial}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus | string }) {
  const isDone = status === 'Đã bán' || status === 'completed' || status === 'Hoàn thành';
  const isRunning = status === 'running' || status === 'Đang chạy';
  const isPending = status === 'pending' || status === 'Chờ điều xe';

  let colorCls = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 shadow-[0_2px_0_#cbd5e1] dark:shadow-[0_2px_0_#0f172a]';
  let dotCls = 'bg-slate-500';

  if (isDone) {
    colorCls = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 shadow-[0_2px_0_#a7f3d0] dark:shadow-[0_2px_0_#064e3b]';
    dotCls = 'bg-emerald-600 shadow-[0_0_6px_rgba(16,185,129,0.9)]';
  } else if (isRunning) {
    colorCls = 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-[0_2px_0_#bfdbfe] dark:shadow-[0_2px_0_#1e3a8a]';
    dotCls = 'bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.9)]';
  } else if (isPending) {
    colorCls = 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-[0_2px_0_#fde68a] dark:shadow-[0_2px_0_#78350f]';
    dotCls = 'bg-amber-600 shadow-[0_0_6px_rgba(217,119,6,0.9)]';
  } else if (status === 'Hủy' || status === 'cancelled') {
    colorCls = 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-[0_2px_0_#fecdd3] dark:shadow-[0_2px_0_#881337]';
    dotCls = 'bg-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.9)]';
  }

  return (
    <span className={cn('pill-3d', colorCls)}>
      <span className={cn('size-1.5 rounded-full', dotCls)} />
      {status}
    </span>
  );
}

export const TH = 'whitespace-nowrap bg-slate-100/80 dark:bg-slate-800/80 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700';
export const TD = 'whitespace-nowrap border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-200';
export const NUM = 'tnum text-right font-semibold';
