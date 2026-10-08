import type { ReactNode } from 'react';
import { XvipShell } from '@/features/xvip/XvipShell';

export const metadata = { title: 'XVIP - Quản lý đại lý vé xe' };

export default function XvipLayout({ children }: { children: ReactNode }) {
  return <XvipShell>{children}</XvipShell>;
}
