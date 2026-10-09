'use client';

import type { ReactNode } from 'react';
import { useCurrentUser } from '@/features/auth/hooks';

/** Chỉ Admin được xem; nhân viên gõ thẳng địa chỉ cũng không vào được */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useCurrentUser();
  if (isLoading) return null;
  if (me?.role !== 'ADMIN') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-lg font-bold text-slate-800 dark:text-white">Bạn không có quyền xem trang này</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Chỉ quản trị viên được truy cập mục này.</p>
      </div>
    );
  }
  return <>{children}</>;
}
