import type { ReactNode } from 'react';
import { XvipShell } from '@/features/xvip/XvipShell';
import { ToastProvider } from '@/features/xvip/toast';

export const metadata = { title: 'XVIP - Quản lý đại lý vé xe' };

export default function XvipLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <XvipShell>{children}</XvipShell>
    </ToastProvider>
  );
}
