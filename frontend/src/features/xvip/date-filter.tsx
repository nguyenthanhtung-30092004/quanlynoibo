'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarBlank, CaretDown, Check } from '@phosphor-icons/react';
import { formatDateVN } from '@/lib/format';
import { getVnToday } from '@/lib/time';
import { DateInput, PICKER_POPOVER_ATTR } from './PickerInput';

/** Khoảng ngày dùng chung cho các trang: tính theo ngày xe khởi hành hoặc ngày tạo vé */
export interface DateRange {
  from: string;
  to: string;
}

/** Khoảng ngày được hiểu là ngày xe khởi hành hay ngày tạo vé */
export type DateBasis = 'departure' | 'created';

export const BASIS_LABEL: Record<DateBasis, string> = {
  created: 'Ngày tạo vé',
  departure: 'Ngày đi',
};

/** Tham số ngày gửi lên API (đơn và KPI dùng chung tên) theo cơ sở đang chọn */
export function rangeParams(range: DateRange, basis: DateBasis) {
  return basis === 'departure'
    ? { departureFrom: range.from, departureTo: range.to }
    : { dateFrom: range.from, dateTo: range.to };
}

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'year' | 'custom';

interface DateFilterValue {
  range: DateRange;
  preset: PresetKey;
  label: string;
  basis: DateBasis;
  setBasis: (basis: DateBasis) => void;
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
    case 'year':
      // Cả năm (đến 31/12) để vé đặt trước cho các tháng sau vẫn hiện
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
}

const PRESETS: Array<{ key: Exclude<PresetKey, 'custom'>; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: '7d', label: '7 ngày qua' },
  { key: '30d', label: '30 ngày qua' },
  { key: 'month', label: 'Tháng này' },
  { key: 'year', label: 'Năm nay' },
];

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetKey] = useState<PresetKey>('today');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [basis, setBasis] = useState<DateBasis>('departure');

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
      basis,
      setBasis,
      setPreset: (key) => {
        setPresetKey(key);
        setRange(presetRange(key));
      },
      setCustom: (r) => {
        setPresetKey('custom');
        setRange(r);
      },
    };
  }, [range, preset, basis]);

  return <DateFilterContext.Provider value={value}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter(): DateFilterValue {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error('useDateFilter phải nằm trong DateFilterProvider');
  return ctx;
}

/** Nút lọc theo khoảng ngày / tiêu chí ngày (dùng trong thanh lọc) */
export function DateRangeFilter({
  mobile = false,
  className = '',
  align = 'left',
}: {
  mobile?: boolean;
  className?: string;
  align?: 'left' | 'right';
} = {}) {
  const { range, preset, label, basis, setBasis, setPreset, setCustom } = useDateFilter();
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
    <div
      ref={boxRef}
      className={`relative w-full ${className} ${mobile ? 'sm:hidden' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Lọc theo ${BASIS_LABEL[basis].toLowerCase()}`}
        className="input-3d flex h-[42px] w-full items-center justify-between gap-2 text-left font-normal cursor-pointer select-none"
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          <CalendarBlank size={17} weight="bold" className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">{BASIS_LABEL[basis]}:</span>
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        </span>
        <CaretDown
          size={14}
          weight="bold"
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Lọc theo ngày"
          className={`absolute top-full z-40 mt-1.5 w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-2">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Lọc theo tiêu chí
            </span>
            <BasisSwitch basis={basis} onChange={setBasis} />
          </div>

          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Chọn nhanh khoảng ngày
          </span>
          <ul className="grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => {
                    setPreset(p.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    preset === p.key
                      ? 'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span>{p.label}</span>
                  {preset === p.key && <Check size={14} weight="bold" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
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
              className="btn-3d btn-3d-blue mt-2.5 w-full py-2 text-xs font-bold disabled:opacity-50"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Chọn lọc theo ngày xe khởi hành hay ngày tạo vé */
export function BasisSwitch({ basis, onChange }: { basis: DateBasis; onChange: (b: DateBasis) => void }) {
  return (
    <div role="radiogroup" aria-label="Lọc theo" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {(Object.keys(BASIS_LABEL) as DateBasis[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={basis === key}
          onClick={() => onChange(key)}
          className={`rounded-lg px-2 py-1.5 text-xs font-bold ${
            basis === key
              ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {BASIS_LABEL[key]}
        </button>
      ))}
    </div>
  );
}
