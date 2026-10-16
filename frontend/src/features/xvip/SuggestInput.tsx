'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { fold, rankMatches } from './search-rank';

/**
 * Ô chọn có gợi ý: chỉ cho chọn từ danh sách có sẵn. Gõ chữ chỉ để lọc nhanh
 * (không phân biệt dấu), bấm chuột hoặc Enter vào mục được tô sáng để chọn
 * (mũi tên lên/xuống để di chuyển). Rời ô khi chưa chọn thì chữ quay về giá trị
 * đã chọn trước đó, không lưu chữ gõ tự do.
 */
export function SuggestInput({
  options,
  value,
  onChange,
  placeholder,
  maxLength,
  invalid = false,
  clearable = false,
  allowFree = false,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  invalid?: boolean;
  clearable?: boolean;
  /** Cho nhập tên ngoài danh sách (vẫn lưu theo tên đã gõ) */
  allowFree?: boolean;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = fold(text);
    // Đang hiện đúng một giá trị trong danh sách thì cho xem lại toàn bộ
    if (!q || (value && text === value && options.includes(value))) return options;
    return rankMatches(options, q, (o) => o);
  }, [options, text, value]);

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
        setText(value);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, value]);

  const pick = (v: string) => {
    onChange(v);
    setText(v);
    setOpen(false);
  };

  const isNotInList = Boolean(
    options.length > 0 && value.trim() && !options.includes(value),
  );

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          className={`input-3d pl-9 ${clearable && value ? 'pr-9' : ''} ${
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
          maxLength={maxLength}
          placeholder={placeholder}
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
          onBlur={(e) => {
            if (!rootRef.current?.contains(e.relatedTarget as Node)) {
              setOpen(false);
              setText(value);
            }
          }}
          onChange={(e) => {
            setText(e.target.value);
            if (allowFree) onChange(e.target.value);
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
              // Enter chọn gợi ý đang tô sáng (chặn gửi form); không có gợi ý thì không làm gì
              if (open) {
                e.preventDefault();
                if (filtered[active]) {
                  pick(filtered[active]);
                }
              }
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              setOpen(false);
              setText(value);
            }
          }}
        />

        {clearable && value && (
          <button
            type="button"
            aria-label="Xóa lựa chọn"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setText('');
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isNotInList && !invalid && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          {allowFree
            ? 'Đối tác ngoài danh sách: đơn vẫn lưu theo tên này, hoa hồng bạn nhập tay'
            : 'Đối tác này không còn trong danh sách, hãy chọn lại'}
        </p>
      )}

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-[#0d1629]"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">
              {allowFree ? 'Không khớp đối tác nào, sẽ lưu theo tên bạn gõ' : 'Không có đối tác nào khớp'}
            </li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
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
            ))
          )}
        </ul>
      )}
    </div>
  );
}
