import type { ReactNode } from 'react';
import { AdminOnly } from '@/features/xvip/AdminOnly';

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
