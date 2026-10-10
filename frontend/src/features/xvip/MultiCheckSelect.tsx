'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();

export interface MultiOption {
  value: number;
  label: string;
}

/**
 * Ô chọn nhiều giá trị bằng cách tích chọn. Danh sách mở ra khi bấm, có ô tìm
 * (không phân biệt dấu) và nút chọn hết / bỏ chọn. Không chọn gì = tất cả.
 */
export function MultiCheckSelect({
  options,
  value,
  onChange,
  allLabel,
  searchPlaceholder = 'Tìm...',
}: {
  options: MultiOption[];
  value: number[];
  onChange: (value: number[]) => void;
  allLabel: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((o) => {
      const n = fold(o.label);
      return words.every((w) => n.includes(w));
    });
  }, [options, query]);

  const selected = new Set(value);
  const toggle = (v: number) =>
    onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? '1 đã chọn')
        : `${value.length} đã chọn`;

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        className="input-3d flex h-[42px] w-full items-center justify-between gap-2 text-left cursor-pointer select-none"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`truncate text-sm ${value.length > 0 ? 'font-bold text-blue-700 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}
        >
          {summary}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-72 max-w-[85vw] rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-700 dark:bg-[#0d1629]">
          <div className="relative border-b border-slate-200 p-2 dark:border-slate-700">
            <MagnifyingGlass
              size={15}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="input-3d pl-8"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-xs font-bold">
            <button
              type="button"
              className="text-blue-700 hover:underline dark:text-blue-400"
              onClick={() =>
                onChange(Array.from(new Set([...value, ...filtered.map((o) => o.value)])))
              }
            >
              Chọn hết{query ? ' kết quả' : ''}
            </button>
            <button
              type="button"
              className="text-slate-500 hover:underline dark:text-slate-400"
              onClick={() => onChange([])}
              disabled={value.length === 0}
            >
              Bỏ chọn
            </button>
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto pb-1 text-sm">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-500">Không có kết quả</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/50">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 cursor-pointer rounded accent-blue-600"
                      checked={selected.has(o.value)}
                      onChange={() => toggle(o.value)}
                    />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
