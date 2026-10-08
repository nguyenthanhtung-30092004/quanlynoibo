'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

/** Bỏ dấu và chữ hoa để gõ "ha hai" vẫn ra "Hà Hải" */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

/**
 * Ô nhập có gợi ý: gõ để lọc danh sách (không phân biệt dấu), bấm hoặc Enter
 * để chọn (mũi tên lên/xuống để di chuyển). Khác ô chọn thường ở chỗ vẫn cho
 * gõ giá trị tự do ngoài danh sách.
 */
export function SuggestInput({
  options,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = fold(value);
    // Đang hiện đúng một giá trị trong danh sách thì cho xem lại toàn bộ
    if (!q || options.includes(value)) return options;
    const words = q.split(/\s+/);
    return options.filter((o) => {
      const n = fold(o);
      return words.every((w) => n.includes(w));
    });
  }, [options, value]);

  useEffect(() => setActive(0), [value, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
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
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onChange={(e) => {
          onChange(e.target.value);
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
            // Enter chọn gợi ý đang tô sáng (chặn gửi form); không có gợi ý thì giữ chữ đã gõ
            if (open && filtered[active]) {
              e.preventDefault();
              pick(filtered[active]);
            }
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-[#0d1629]"
        >
          {filtered.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              // mousedown để chọn trước khi ô nhập mất focus
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer truncate px-3 py-2 ${
                i === active ? 'bg-blue-50 dark:bg-blue-950/50' : ''
              } ${o === value ? 'font-bold text-blue-700 dark:text-blue-400' : ''}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
