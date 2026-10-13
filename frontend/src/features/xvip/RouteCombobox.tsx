'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { fold, rankMatches } from './search-rank';

interface RouteOption {
  id: number;
  name: string;
  defaultPrice?: number;
}

const money = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Ô chọn tuyến đường kiểu gõ-để-gợi ý: chỉ cho chọn từ danh sách tuyến hoạt động.
 * Gõ để lọc danh sách, bấm chuột hoặc Enter để chọn (mũi tên lên/xuống để di chuyển).
 * Khi rời ô mà chưa chọn, chữ trong ô quay về đúng tên tuyến đang chọn.
 */
export function RouteCombobox({
  routes,
  value,
  onChange,
  placeholder = '',
  invalid = false,
  fallbackName,
}: {
  routes: RouteOption[];
  /** id tuyến đang chọn, 0 nếu chưa chọn */
  value: number;
  onChange: (id: number) => void;
  placeholder?: string;
  invalid?: boolean;
  fallbackName?: string;
}) {
  const selected = routes.find((r) => r.id === value);
  const currentName = selected?.name ?? fallbackName ?? '';
  const [text, setText] = useState(currentName);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Đồng bộ chữ hiển thị khi giá trị đổi từ bên ngoài (mở vé khác, danh sách vừa tải xong)
  useEffect(() => {
    setText(selected?.name ?? fallbackName ?? '');
  }, [selected?.id, selected?.name, fallbackName]);

  const filtered = useMemo(() => {
    const q = fold(text);
    // Đang hiện đúng tên tuyến đã chọn thì cho xem lại toàn bộ danh sách
    if (!q || (currentName && text === currentName)) return routes;
    return rankMatches(routes, q, (r) => r.name);
  }, [routes, text, currentName]);

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
        setText(selected?.name ?? fallbackName ?? '');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, selected?.name, fallbackName]);

  const pick = (r: RouteOption) => {
    onChange(r.id);
    setText(r.name);
    setOpen(false);
  };

  const isNotInList = Boolean(routes.length > 0 && value > 0 && !selected);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          className={`input-3d pl-9 ${
            invalid
              ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
              : isNotInList
                ? '!border-amber-500 !shadow-[0_0_0_3px_rgba(245,158,11,0.2)]'
                : ''
          }`}
          aria-invalid={invalid}
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
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node)) {
              setOpen(false);
              setText(selected?.name ?? fallbackName ?? '');
            }
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              // Chặn gửi form khi Enter dùng để chọn gợi ý
              if (open) {
                e.preventDefault();
                if (filtered[active]) {
                  pick(filtered[active]);
                }
              }
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
              setText(selected?.name ?? fallbackName ?? '');
            }
          }}
        />
      </div>

      {isNotInList && !invalid && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Tuyến đường này không còn hoạt động, hãy chọn lại
        </p>
      )}

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
