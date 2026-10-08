import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Khung chứa nội dung: viền 1px, không đổ bóng (một lớp nâng duy nhất) */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface', className)}>
      {children}
    </section>
  );
}
