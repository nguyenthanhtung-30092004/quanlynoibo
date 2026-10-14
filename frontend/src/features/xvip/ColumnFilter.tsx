'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Funnel, X, ArrowCounterClockwise } from '@phosphor-icons/react';
import { MoneyInput } from '@/features/payroll/MoneyInput';

export interface ColumnFilterProps {
  title: string;
  isActive: boolean;
  align?: 'left' | 'right';
  onClear: () => void;
  children: (helpers: { close: () => void }) => ReactNode;
}

export function ColumnFilterPopover({
  title,
  isActive,
  align = 'left',
  onClear,
  children,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={`Lọc theo ${title}`}
        aria-label={`Lọc theo ${title}`}
        aria-expanded={open}
        className={`ml-1.5 inline-flex items-center justify-center rounded p-1 transition-colors ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 dark:ring-blue-500'
            : 'text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <Funnel size={13} weight={isActive ? 'fill' : 'bold'} />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-1 ring-white" />
        )}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-50 mt-2 min-w-[260px] max-w-sm rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Lọc {title}
            </span>
            <div className="flex items-center gap-1">
              {isActive && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  title="Xóa lọc cột này"
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <ArrowCounterClockwise size={12} weight="bold" /> Xóa lọc
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X size={13} weight="bold" />
              </button>
            </div>
          </div>

          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

/** Khung tick chọn danh sách có debounce tìm kiếm và nút áp dụng */
export function CheckListFilter<T extends string | number>({
  items,
  selected,
  onApply,
  onClear,
  searchPlaceholder = 'Tìm giá trị...',
  searchQuery,
  onSearchChange,
  isLoading,
  close,
}: {
  items: Array<{ value: T; label: string; count?: number }>;
  selected: T[];
  onApply: (selected: T[]) => void;
  onClear: () => void;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  isLoading?: boolean;
  close: () => void;
}) {
  const [localSelected, setLocalSelected] = useState<T[]>(selected);

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  const toggle = (val: T) => {
    setLocalSelected((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val],
    );
  };

  const handleSelectAll = () => {
    const allVals = items.map((i) => i.value);
    setLocalSelected(Array.from(new Set([...localSelected, ...allVals])));
  };

  const handleDeselectAll = () => {
    const itemVals = new Set(items.map((i) => i.value));
    setLocalSelected((prev) => prev.filter((v) => !itemVals.has(v)));
  };

  return (
    <div className="space-y-2.5">
      {onSearchChange !== undefined && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-3d !py-1 !px-2 text-xs w-full"
        />
      )}

      <div className="flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400">
        <button
          type="button"
          onClick={handleSelectAll}
          className="hover:underline"
        >
          Chọn tất cả
        </button>
        <button
          type="button"
          onClick={handleDeselectAll}
          className="hover:underline text-slate-500 dark:text-slate-400"
        >
          Bỏ chọn tất cả
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1 rounded border border-slate-100 p-1 dark:border-slate-800">
        {isLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">
            Đang tải dữ liệu...
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            Không có dữ liệu phù hợp
          </div>
        ) : (
          items.map((item) => {
            const checked = localSelected.includes(item.value);
            return (
              <label
                key={String(item.value)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.value)}
                    className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate text-slate-800 dark:text-slate-200">
                    {item.label}
                  </span>
                </div>
                {item.count !== undefined && (
                  <span className="shrink-0 text-[11px] text-slate-400">
                    ({item.count})
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onClear();
            close();
          }}
          className="btn-3d btn-3d-white !px-2.5 !py-1 text-xs"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(localSelected);
            close();
          }}
          className="btn-3d btn-3d-blue !px-3 !py-1 text-xs"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}

/** Khung lọc khoảng số (Giá bán, Hoa hồng) */
export function NumberRangeFilter({
  min,
  max,
  onApply,
  onClear,
  close,
}: {
  min?: number;
  max?: number;
  onApply: (range: { min?: number; max?: number }) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [localMin, setLocalMin] = useState<number>(min ?? 0);
  const [localMax, setLocalMax] = useState<number>(max ?? 0);

  useEffect(() => {
    setLocalMin(min ?? 0);
    setLocalMax(max ?? 0);
  }, [min, max]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Từ
          </span>
          <MoneyInput
            value={localMin}
            onChange={setLocalMin}
            placeholder="0"
            className="!py-1 !px-2 text-xs w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Đến
          </span>
          <MoneyInput
            value={localMax}
            onChange={setLocalMax}
            placeholder="Không giới hạn"
            className="!py-1 !px-2 text-xs w-full"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onClear();
            close();
          }}
          className="btn-3d btn-3d-white !px-2.5 !py-1 text-xs"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={() => {
            onApply({
              min: localMin > 0 ? localMin : undefined,
              max: localMax > 0 ? localMax : undefined,
            });
            close();
          }}
          className="btn-3d btn-3d-blue !px-3 !py-1 text-xs"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}

/** Khung lọc ô gõ văn bản (Mã đơn) */
export function TextInputFilter({
  value,
  placeholder,
  onApply,
  onClear,
  close,
}: {
  value?: string;
  placeholder: string;
  onApply: (v: string | undefined) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [text, setText] = useState(value ?? '');

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onApply(text.trim() || undefined);
            close();
          }
        }}
        className="input-3d !py-1 !px-2 text-xs w-full font-mono"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onClear();
            close();
          }}
          className="btn-3d btn-3d-white !px-2.5 !py-1 text-xs"
        >
          Xóa
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(text.trim() || undefined);
            close();
          }}
          className="btn-3d btn-3d-blue !px-3 !py-1 text-xs"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}
