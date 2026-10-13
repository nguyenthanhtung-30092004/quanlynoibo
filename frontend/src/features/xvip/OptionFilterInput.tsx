'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { fold, rankMatches } from './search-rank';

interface Option {
  value: string;
  label: string;
}

/**
 * Ô lọc kiểu gõ-để-gợi ý cho bộ lọc có sẵn một "tất cả": gõ vài chữ là lọc danh sách,
 * bấm hoặc Enter để chọn. Xóa hết chữ (hoặc chọn dòng "tất cả") để bỏ lọc, value rỗng = tất cả.
 */
export function OptionFilterInput({
  options,
  value,
  onChange,
  allLabel,
  placeholder,
}: {
  options: Option[];
  /** value của mục đang chọn, '' nếu là tất cả */
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  placeholder?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const selectedLabel = selected?.label ?? '';
  const [text, setText] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setText(selectedLabel), [selectedLabel]);

  const filtered = useMemo(() => {
    const q = fold(text);
    // Đang hiện đúng mục đã chọn thì cho xem lại toàn bộ danh sách
    if (!q || text === selectedLabel) return options;
    return rankMatches(options, q, (o) => o.label);
  }, [options, text, selectedLabel]);

  // Dòng đầu luôn là "tất cả" khi chưa gõ gì để lọc
  const showAll = !fold(text) || text === selectedLabel;
  const rows: Option[] = showAll ? [{ value: '', label: allLabel }, ...filtered] : filtered;

  useEffect(() => setActive(0), [text, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setText(selectedLabel);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, selectedLabel]);

  const pick = (o: Option) => {
    onChange(o.value);
    setText(o.label === allLabel && o.value === '' ? '' : o.label);
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
        placeholder={placeholder ?? allLabel}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (!e.target.value.trim() && value !== '') onChange('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, rows.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && rows[active]) {
              e.preventDefault();
              pick(rows[active]);
            }
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
            setText(selectedLabel);
          }
        }}
      />

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-[#0d1629]"
        >
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">Không có kết quả khớp</li>
          ) : (
            rows.map((o, i) => (
              <li
                key={o.value || '__all'}
                role="option"
                aria-selected={o.value === value}
                // mousedown để chọn trước khi ô nhập mất focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer truncate px-3 py-2 ${
                  i === active ? 'bg-blue-50 dark:bg-blue-950/50' : ''
                } ${o.value === value ? 'font-bold text-blue-700 dark:text-blue-400' : ''}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
