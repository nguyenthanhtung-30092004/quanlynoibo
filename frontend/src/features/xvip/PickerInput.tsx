'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarBlank, CaretLeft, CaretRight, Clock } from '@phosphor-icons/react';
import { getVnToday } from '@/lib/time';

/** Thuộc tính đánh dấu khung chọn, để các popover cha không đóng khi bấm vào đây */
export const PICKER_POPOVER_ATTR = 'data-picker-popover';

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
const formatDate = (v: string) => {
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

/**
 * Khung hiển thị + khung chọn thả xuống tự vẽ (không dùng bộ chọn gốc của trình
 * duyệt). Khung chọn render qua portal ở <body>, định vị theo ô nên không bị
 * hộp thoại cuộn cắt mất; tự lật lên trên nếu bên dưới hết chỗ.
 */
function PickerShell({
  value,
  display,
  placeholder,
  icon,
  children,
}: {
  value: string;
  display: string;
  placeholder: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = popRef.current?.getBoundingClientRect();
      if (!a || !p) return;
      const margin = 8;
      const below = window.innerHeight - a.bottom;
      const top = below >= p.height + margin || a.top < p.height + margin ? a.bottom + 6 : a.top - p.height - 6;
      const left = Math.min(Math.max(margin, a.left), window.innerWidth - p.width - margin);
      setPos({ top: Math.max(margin, top), left });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Cuộn trang/hộp thoại bên dưới thì đóng; cuộn bên trong khung chọn thì giữ nguyên
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`input-3d flex min-h-[46px] items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] ${
          open ? '!border-blue-600 !shadow-[0_0_0_3px_rgba(37,99,235,0.2)]' : ''
        } ${display ? '' : 'text-slate-400'}`}
      >
        <span className="truncate font-medium">{display || placeholder}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
          {icon}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            {...{ [PICKER_POPOVER_ATTR]: '' }}
            role="dialog"
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="z-[100] rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-[0_6px_0_#cbd5e1,0_24px_48px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_6px_0_#0b1220,0_24px_48px_rgba(0,0,0,0.6)]"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function Calendar({
  value,
  min,
  onPick,
}: {
  value: string;
  min?: string;
  onPick: (iso: string) => void;
}) {
  const today = getVnToday();
  const base = value || today;
  const [year, setYear] = useState(Number(base.slice(0, 4)));
  const [month, setMonth] = useState(Number(base.slice(5, 7)) - 1);

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  // Lưới 6 tuần, bắt đầu từ Thứ 2
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));

  const navBtn =
    'flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-[0_2px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div className="w-[21rem] max-w-[calc(100vw-4rem)]">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className={navBtn} onClick={() => go(-1)} aria-label="Tháng trước">
          <CaretLeft size={16} weight="bold" />
        </button>
        <div className="text-base font-extrabold text-slate-900 dark:text-white">
          Tháng {month + 1}, {year}
        </div>
        <button type="button" className={navBtn} onClick={() => go(1)} aria-label="Tháng sau">
          <CaretRight size={16} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-2 text-xs font-bold uppercase text-slate-400">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate());
          const inMonth = d.getMonth() === month;
          const selected = iso === value;
          const isToday = iso === today;
          const disabled = !!min && iso < min;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              className={`mx-auto my-0.5 flex size-10 items-center justify-center rounded-xl text-[15px] tnum transition-colors ${
                selected
                  ? 'bg-gradient-to-b from-blue-500 to-blue-700 font-extrabold text-white shadow-[0_2px_0_#1d4ed8]'
                  : disabled
                    ? 'cursor-not-allowed text-slate-300 dark:text-slate-700'
                    : `font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 ${
                        inMonth ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'
                      } ${isToday ? 'ring-2 ring-inset ring-amber-400' : ''}`
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onPick(today)}
          disabled={!!min && today < min}
          className="rounded-xl px-3.5 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-slate-800"
        >
          Hôm nay
        </button>
        <span className="text-[11px] font-medium text-slate-400">Viền vàng = hôm nay</span>
      </div>
    </div>
  );
}

export function DateInput({
  placeholder = '',
  value,
  onChange,
  min,
}: BaseProps & { min?: string }) {
  return (
    <PickerShell
      value={value}
      placeholder={placeholder}
      display={formatDate(value)}
      icon={<CalendarBlank size={18} weight="duotone" />}
    >
      {(close) => (
        <Calendar
          value={value}
          min={min}
          onPick={(iso) => {
            onChange(iso);
            close();
          }}
        />
      )}
    </PickerShell>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

function TimeColumns({ value, onChange, close }: { value: string; onChange: (v: string) => void; close: () => void }) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  // Giờ cũ có phút lẻ (không chia hết cho 5) vẫn hiển thị và chọn được
  if (m && !minutes.includes(m)) {
    minutes.push(m);
    minutes.sort();
  }

  const colRef = useRef<HTMLDivElement>(null);
  // Cuộn từng cột tới giá trị đang chọn (không dùng scrollIntoView để khỏi cuộn cả trang)
  useEffect(() => {
    colRef.current?.querySelectorAll<HTMLElement>('[data-selected="true"]').forEach((el) => {
      const box = el.parentElement;
      if (box) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    });
  }, []);
  const cell = (selected: boolean) =>
    `flex h-10 w-full items-center justify-center rounded-xl text-[15px] tnum transition-colors ${
      selected
        ? 'bg-gradient-to-b from-blue-500 to-blue-700 font-extrabold text-white shadow-[0_2px_0_#1d4ed8]'
        : 'font-semibold text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;

  return (
    <div ref={colRef} className="w-56">
      <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px] font-bold uppercase text-slate-400">
        <span>Giờ</span>
        <span>Phút</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative max-h-64 space-y-1 overflow-y-auto pr-1.5">
          {HOURS.map((hh) => (
            <button
              key={hh}
              type="button"
              data-selected={hh === h}
              className={cell(hh === h)}
              onClick={() => onChange(`${hh}:${m || '00'}`)}
            >
              {hh}
            </button>
          ))}
        </div>
        <div className="relative max-h-64 space-y-1 overflow-y-auto pr-1.5">
          {minutes.map((mm) => (
            <button
              key={mm}
              type="button"
              data-selected={mm === m}
              className={cell(mm === m)}
              onClick={() => {
                onChange(`${h || '08'}:${mm}`);
                close();
              }}
            >
              {mm}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimeInput({ placeholder = '', value, onChange }: BaseProps) {
  return (
    <PickerShell
      value={value}
      placeholder={placeholder}
      display={value}
      icon={<Clock size={18} weight="duotone" />}
    >
      {(close) => <TimeColumns value={value} onChange={onChange} close={close} />}
    </PickerShell>
  );
}
