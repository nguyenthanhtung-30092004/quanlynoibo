'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';

/**
 * Hộp thoại dùng chung. Luôn vừa màn hình: khung không bao giờ cao hơn khung
 * nhìn, phần nội dung tự cuộn bên trong (tiêu đề luôn thấy), nên không phải
 * zoom nhỏ lại. Hiển thị qua portal ở <body> để không bị ảnh hưởng bởi bố cục
 * hay hiệu ứng của trang bên dưới. Nhấn Esc để đóng.
 */
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** md: hộp nhỏ (xác nhận...); xl: form rộng cho màn hình máy tính */
  size?: 'md' | 'xl';
}) {
  const [mounted, setMounted] = useState(false);
  // onClose thường là hàm tạo mới mỗi lần render; giữ qua ref để không gắn lại sự kiện liên tục
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    // Khóa cuộn trang nền khi hộp thoại đang mở
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${size === 'xl' ? 'max-w-4xl' : 'max-w-lg'} flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-[inset_0_1px_1px_rgba(255,255,255,1),0_10px_0_#cbd5e1,0_25px_50px_-12px_rgba(0,0,0,0.3)] dark:border-slate-700 dark:bg-[#111d35] dark:text-white dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_10px_0_#09101f,0_25px_50px_-12px_rgba(0,0,0,0.6)] sm:max-h-[calc(100dvh-2rem)]`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="size-2 shrink-0 rounded-full bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.8)]" />
            <h2 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="btn-3d-mini shrink-0">
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
