'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

type ShowToast = (message: string, type?: ToastType) => void;

const ToastContext = createContext<ShowToast>(() => {});

/** Không truyền loại thì tự đoán từ nội dung: lời báo lỗi / nhắc nhập thiếu -> đỏ */
const ERROR_PATTERN = /^(lỗi|có lỗi)|vui lòng|không hợp lệ|không thể|thất bại|phải bằng|không được/i;

const STYLES: Record<ToastType, { box: string; icon: string; bar: string }> = {
  success: {
    box: 'from-emerald-500 to-emerald-700 border-emerald-300/50 shadow-[0_5px_0_#065f46,0_16px_32px_-6px_rgba(5,150,105,0.55)]',
    icon: 'text-emerald-600',
    bar: 'bg-emerald-200',
  },
  error: {
    box: 'from-rose-500 to-rose-700 border-rose-300/50 shadow-[0_5px_0_#9f1239,0_16px_32px_-6px_rgba(225,29,72,0.55)]',
    icon: 'text-rose-600',
    bar: 'bg-rose-200',
  },
  info: {
    box: 'from-blue-500 to-blue-700 border-blue-300/50 shadow-[0_5px_0_#1e3a8a,0_16px_32px_-6px_rgba(37,99,235,0.55)]',
    icon: 'text-blue-600',
    bar: 'bg-blue-200',
  },
};

const TITLES: Record<ToastType, string> = {
  success: 'Thành công',
  error: 'Có lỗi',
  info: 'Thông báo',
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const style = STYLES[item.type];
  const Icon = item.type === 'success' ? CheckCircle : item.type === 'error' ? WarningCircle : Info;

  useEffect(() => {
    const t = setTimeout(() => onClose(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item.id, item.duration, onClose]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      className={`xv-toast pointer-events-auto relative overflow-hidden rounded-2xl border bg-gradient-to-b p-3.5 pr-10 text-white ${style.box}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.12),0_2px_0_rgba(0,0,0,0.25)] ${style.icon}`}
        >
          <Icon size={22} weight="fill" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/80">{TITLES[item.type]}</div>
          <div className="text-sm font-bold leading-snug drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">{item.message}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        aria-label="Đóng thông báo"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X size={15} weight="bold" />
      </button>
      <span
        className={`xv-toast-bar absolute bottom-0 left-0 h-1 w-full origin-left ${style.bar}`}
        style={{ animationDuration: `${item.duration}ms` }}
      />
    </div>
  );
}

/**
 * Thông báo nổi dùng chung cho cả khu quản trị. Vẽ qua portal ở <body> với z-index
 * cao hơn mọi hộp thoại, nên báo lỗi khi đang mở form vẫn thấy ngay.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);

  useEffect(() => setMounted(true), []);

  const close = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>((message, type) => {
    const resolved: ToastType = type ?? (ERROR_PATTERN.test(message) ? 'error' : 'success');
    const id = nextId.current++;
    setItems((list) => [...list.slice(-3), { id, type: resolved, message, duration: resolved === 'error' ? 5500 : 4000 }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed right-3 top-3 z-[300] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 sm:right-5 sm:top-5">
            {items.map((item) => (
              <ToastCard key={item.id} item={item} onClose={close} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/** Trả về hàm showToast(message, type?) */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}
