'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface RouteOption {
  id: number;
  name: string;
  defaultPrice?: number;
}

/** Bỏ dấu và chữ hoa để gõ "ha noi" vẫn ra "Hà Nội" */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

const money = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Ô chọn tuyến đường kiểu gõ-để-gợi ý: gõ vài chữ là lọc ngay danh sách, bấm
 * hoặc Enter để chọn (mũi tên lên/xuống để di chuyển). Không phải cuộn dài như
 * ô chọn thường.
 */
export function RouteCombobox({
  routes,
  value,
  onChange,
  placeholder = '',
}: {
  routes: RouteOption[];
  /** id tuyến đang chọn, 0 nếu chưa chọn */
  value: number;
  onChange: (id: number) => void;
  placeholder?: string;
}) {
  const selected = routes.find((r) => r.id === value);
  const [text, setText] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Đồng bộ chữ hiển thị khi giá trị đổi từ bên ngoài (mở vé khác, danh sách vừa tải xong)
  useEffect(() => {
    setText(selected?.name ?? '');
  }, [selected?.id, selected?.name]);

  const filtered = useMemo(() => {
    const q = fold(text);
    // Đang hiện đúng tên tuyến đã chọn thì cho xem lại toàn bộ danh sách
    if (!q || (selected && text === selected.name)) return routes;
    const words = q.split(/\s+/);
    return routes.filter((r) => {
      const n = fold(r.name);
      return words.every((w) => n.includes(w));
    });
  }, [routes, text, selected]);

  useEffect(() => setActive(0), [text, open]);

  // Giữ mục đang tô sáng trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Bấm ra ngoài: đóng danh sách và trả ô về tên tuyến đang chọn
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setText(selected?.name ?? '');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, selected?.name]);

  const pick = (r: RouteOption) => {
    onChange(r.id);
    setText(r.name);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        className="input-3d pl-9"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            // Chặn gửi form khi Enter dùng để chọn gợi ý
            if (open && filtered[active]) {
              e.preventDefault();
              pick(filtered[active]);
            }
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
            setText(selected?.name ?? '');
          }
        }}
      />

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-[#0d1629]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">Không có tuyến nào khớp</li>
          ) : (
            filtered.map((r, i) => (
              <li
                key={r.id}
                role="option"
                aria-selected={r.id === value}
                // mousedown để chọn trước khi ô nhập mất focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                  i === active ? 'bg-blue-50 dark:bg-blue-950/50' : ''
                } ${r.id === value ? 'font-bold text-blue-700 dark:text-blue-400' : ''}`}
              >
                <span className="truncate">{r.name}</span>
                {r.defaultPrice ? (
                  <span className="tnum shrink-0 text-xs text-slate-500">{money(r.defaultPrice)}đ</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
