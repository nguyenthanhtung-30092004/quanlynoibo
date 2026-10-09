'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarBlank, CaretDown, Check } from '@phosphor-icons/react';
import { formatDateVN } from '@/lib/format';
import { getVnToday } from '@/lib/time';
import { DateInput, PICKER_POPOVER_ATTR } from './PickerInput';

/** Khoảng ngày khởi hành dùng chung cho các trang (hiện áp dụng cho Tổng quan) */
export interface DateRange {
  from: string;
  to: string;
}

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

interface DateFilterValue {
  range: DateRange;
  preset: PresetKey;
  label: string;
  setPreset: (key: Exclude<PresetKey, 'custom'>) => void;
  setCustom: (range: DateRange) => void;
}

const DateFilterContext = createContext<DateFilterValue | null>(null);

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (tính theo UTC nên không lệch múi giờ) */
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function presetRange(key: Exclude<PresetKey, 'custom'>): DateRange {
  const today = getVnToday();
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = shiftDay(today, -1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: shiftDay(today, -6), to: today };
    case '30d':
      return { from: shiftDay(today, -29), to: today };
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

const PRESETS: Array<{ key: Exclude<PresetKey, 'custom'>; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'month', label: 'Tháng này' },
];

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetKey] = useState<PresetKey>('today');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));

  const value = useMemo<DateFilterValue>(() => {
    const text =
      range.from === range.to
        ? formatDateVN(range.from)
        : `${formatDateVN(range.from)} – ${formatDateVN(range.to)}`;
    const named = PRESETS.find((p) => p.key === preset)?.label;
    return {
      range,
      preset,
      label: named ? `${named} (${text})` : text,
      setPreset: (key) => {
        setPresetKey(key);
        setRange(presetRange(key));
      },
      setCustom: (r) => {
        setPresetKey('custom');
        setRange(r);
      },
    };
  }, [range, preset]);

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter(): DateFilterValue {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error('useDateFilter phải nằm trong DateFilterProvider');
  return ctx;
}

/** Nút lọc theo ngày đi đặt ở Header: chọn nhanh hoặc tự chọn khoảng ngày */
export function DateRangeFilter({ mobile = false }: { mobile?: boolean }) {
  const { range, preset, label, setPreset, setCustom } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFrom(range.from);
    setTo(range.to);
  }, [range]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Bấm vào lịch thả xuống của ô chọn ngày (nằm ngoài khung này) thì không đóng
      if (target.closest(`[${PICKER_POPOVER_ATTR}]`)) return;
      if (!boxRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const customValid = !!from && !!to && from <= to;

  return (
    <div ref={boxRef} className={mobile ? 'relative w-full sm:hidden' : 'relative hidden sm:block'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Lọc theo ngày đi"
        className={`flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-[inset_0_1px_0_#fff,0_2px_0_#cbd5e1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_0_#0f172a] border border-slate-200 dark:border-slate-700 active:translate-y-0.5 ${mobile ? 'w-full py-2' : ''}`}
      >
        <CalendarBlank size={16} weight="bold" className="text-blue-600 dark:text-blue-400" aria-hidden />
        <span className="font-semibold text-slate-500 dark:text-slate-400">Ngày đi:</span>
        <span className={mobile ? 'truncate' : undefined}>{label}</span>
        <CaretDown size={12} aria-hidden className={mobile ? 'ml-auto shrink-0' : undefined} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Lọc theo ngày đi"
          className={`absolute top-full z-40 mt-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${mobile ? 'inset-x-0' : 'right-0 w-72'}`}
        >
          <ul className="space-y-0.5">
            {PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => {
                    setPreset(p.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    preset === p.key ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {p.label}
                  {preset === p.key && <Check size={14} weight="bold" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
            <div className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tự chọn khoảng ngày
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Từ ngày
                <div className="mt-1">
                  <DateInput value={from} onChange={setFrom} />
                </div>
              </label>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Đến ngày
                <div className="mt-1">
                  <DateInput value={to} onChange={setTo} min={from} />
                </div>
              </label>
            </div>
            <button
              type="button"
              disabled={!customValid}
              onClick={() => {
                setCustom({ from, to });
                setOpen(false);
              }}
              className="btn-3d btn-3d-blue mt-2.5 w-full py-1.5 text-xs disabled:opacity-50"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
