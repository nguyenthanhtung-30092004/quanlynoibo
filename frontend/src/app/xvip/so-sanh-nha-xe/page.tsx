'use client';

import { useId, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsLeftRight,
  CalendarBlank,
  Coins,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Export,
  FileArrowUp,
  FileXls,
  Info,
  MagnifyingGlass,
  MapPin,
  MinusCircle,
  Phone,
  Ticket,
  User,
  Warning,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { ticketCompareApi } from '@/features/ticket-compare/api';
import type { DaySummary, TicketCompareResult, TicketDetail } from '@/features/ticket-compare/types';
import { useToast } from '@/features/xvip/toast';
import { PageTitle } from '@/features/xvip/ui';

type TabKey = 'all' | 'onlyA' | 'onlyB' | 'mismatched';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

/** 170000 -> "170.000đ" */
function formatMoney(n: number): string {
  return `${formatNumber(n)}đ`;
}

/** Số có dấu: +2, -1, 0 */
function signed(n: number, unit = ''): string {
  return `${n > 0 ? '+' : ''}${formatNumber(n)}${unit}`;
}

/** "2026-10-01" -> "01/10/2026" */
function vnDay(day: string | undefined): string {
  return day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : 'Không rõ ngày';
}

function formatPhoneDisplay(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  return phone;
}

function FileDropCard({
  file,
  label,
  sublabel,
  badgeColor,
  onChange,
}: {
  file: File | null;
  label: string;
  sublabel: string;
  badgeColor: 'blue' | 'indigo';
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const [isDragOver, setIsDragOver] = useState(false);

  const badgeStyles =
    badgeColor === 'blue'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) onChange(droppedFile);
      }}
      className={`group relative flex flex-1 flex-col justify-between rounded-2xl border-2 border-dashed p-4 sm:p-5 transition-all duration-200 ${
        isDragOver
          ? 'border-blue-600 bg-blue-50/60 shadow-lg dark:border-blue-400 dark:bg-blue-950/20'
          : file
          ? 'border-emerald-400/80 bg-emerald-50/30 shadow-sm dark:border-emerald-600/60 dark:bg-emerald-950/10'
          : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-lg border px-2.5 py-1 text-xs font-black uppercase tracking-wider ${badgeStyles}`}>
            {label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{sublabel}</span>
        </div>
        {file && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            title="Gỡ file"
          >
            <X className="size-4" weight="bold" />
          </button>
        )}
      </div>

      <label htmlFor={inputId} className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2.5 py-3 text-center">
        <div
          className={`flex size-12 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${
            file
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {file ? <FileXls className="size-6" weight="fill" /> : <FileArrowUp className="size-6" weight="duotone" />}
        </div>

        <div className="max-w-full px-2">
          {file ? (
            <div>
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(file.size / 1024).toFixed(1)} KB · Sẵn sàng đối chiếu
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Kéo thả hoặc <span className="text-blue-600 underline underline-offset-2">chọn file Excel</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Định dạng .xlsx hoặc .xls</p>
            </div>
          )}
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0] ?? null;
          onChange(selected);
        }}
      />
    </div>
  );
}

function StatBox({
  title,
  value,
  subtext,
  tone,
  icon: Icon,
}: {
  title: string;
  value: number;
  subtext?: string;
  tone: 'emerald' | 'rose' | 'amber' | 'slate' | 'blue';
  icon: React.ElementType;
}) {
  const toneClasses = {
    emerald: {
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-900/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    rose: {
      bg: 'bg-rose-50/70 dark:bg-rose-950/20',
      border: 'border-rose-200 dark:border-rose-900/50',
      iconBg: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300',
      text: 'text-rose-700 dark:text-rose-300',
    },
    amber: {
      bg: 'bg-amber-50/70 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-900/50',
      iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300',
      text: 'text-amber-700 dark:text-amber-300',
    },
    slate: {
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      border: 'border-slate-200 dark:border-slate-700',
      iconBg: 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
      text: 'text-slate-800 dark:text-slate-200',
    },
    blue: {
      bg: 'bg-blue-50/70 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-900/50',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300',
      text: 'text-blue-700 dark:text-blue-300',
    },
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${toneClasses.bg} ${toneClasses.border}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        <div className={`flex size-7 items-center justify-center rounded-lg ${toneClasses.iconBg}`}>
          <Icon className="size-4" weight="bold" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{formatNumber(value)}</div>
      {subtext && <div className={`mt-0.5 text-xs font-medium ${toneClasses.text}`}>{subtext}</div>}
    </div>
  );
}

function TicketDetailCard({ ticket, origin }: { ticket: TicketDetail; origin: 'A' | 'B' }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-slate-700/80 dark:bg-slate-900/80">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">
          <MapPin className="size-3.5 text-slate-400 shrink-0" weight="fill" />
          <span className="truncate">{ticket.route ?? 'Không rõ tuyến đường'}</span>
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-black ${
            origin === 'A'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
          }`}
        >
          {ticket.quantity} vé
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {ticket.departure && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3 text-slate-400 shrink-0" />
            <span>{ticket.departure}</span>
          </span>
        )}
        {ticket.ticketId && (
          <span className="inline-flex items-center gap-1 font-mono text-slate-400 dark:text-slate-500">
            <Ticket className="size-3 shrink-0" />
            <span>#{ticket.ticketId}</span>
          </span>
        )}
        {!!ticket.deposit && (
          <span className="inline-flex items-center gap-1 font-bold text-violet-600 dark:text-violet-300">
            <Coins className="size-3 shrink-0" weight="fill" />
            <span>Cọc {formatMoney(ticket.deposit)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

interface UnifiedDiffItem {
  key: string;
  phone: string;
  customerName?: string;
  countA: number;
  countB: number;
  delta: number;
  day?: string;
  depositA: number;
  depositB: number;
  depositDelta: number;
  ticketsA: TicketDetail[];
  ticketsB: TicketDetail[];
  category: 'onlyA' | 'onlyB' | 'mismatched';
}

function DiffItemRow({
  item,
  isExpanded,
  onToggle,
  nameA,
  nameB,
}: {
  item: UnifiedDiffItem;
  isExpanded: boolean;
  onToggle: () => void;
  nameA: string;
  nameB: string;
}) {
  const hasDetail = item.ticketsA.length > 0 || item.ticketsB.length > 0;

  const categoryBadge = {
    onlyA: {
      text: `Chỉ có ở ${nameA}`,
      class: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    },
    onlyB: {
      text: `Chỉ có ở ${nameB}`,
      class: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    },
    mismatched: {
      text: item.delta !== 0 && item.depositDelta !== 0 ? 'Lệch vé và cọc' : item.delta !== 0 ? 'Lệch số vé' : 'Lệch tiền cọc',
      class: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    },
  }[item.category];

  return (
    <>
      <tr
        onClick={() => hasDetail && onToggle()}
        className={`group border-b border-slate-100 transition-colors dark:border-slate-800/80 ${
          hasDetail ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40' : ''
        } ${isExpanded ? 'bg-slate-50/70 dark:bg-slate-800/50' : ''}`}
      >
        <td className="px-4 py-3.5 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {hasDetail ? (
              <span className="flex size-5 items-center justify-center rounded text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">
                {isExpanded ? <CaretDown className="size-3.5" weight="bold" /> : <CaretRight className="size-3.5" weight="bold" />}
              </span>
            ) : (
              <span className="size-5" />
            )}
            <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
              <Phone className="size-3.5 text-slate-400" />
              {formatPhoneDisplay(item.phone)}
            </span>
          </div>
          {item.day !== undefined && (
            <div className="ml-7 mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
              <CalendarBlank className="size-3" weight="bold" />
              {vnDay(item.day)}
            </div>
          )}
        </td>

        <td className="px-4 py-3.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
            {item.customerName ? (
              <>
                <User className="size-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-[240px]">{item.customerName}</span>
              </>
            ) : (
              <span className="text-slate-400 italic">Chưa có tên</span>
            )}
          </span>
        </td>

        <td className="px-4 py-3.5">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${categoryBadge.class}`}>
            {categoryBadge.text}
          </span>
        </td>

        <td className="px-4 py-3.5 text-center">
          <span
            className={`inline-block min-w-8 rounded-md px-2 py-0.5 text-sm font-bold ${
              item.countA > 0
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-slate-300 dark:text-slate-600'
            }`}
          >
            {item.countA}
          </span>
        </td>

        <td className="px-4 py-3.5 text-center">
          <span
            className={`inline-block min-w-8 rounded-md px-2 py-0.5 text-sm font-bold ${
              item.countB > 0
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'text-slate-300 dark:text-slate-600'
            }`}
          >
            {item.countB}
          </span>
        </td>

        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          {item.delta !== 0 ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-black ${
                item.delta > 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
              }`}
            >
              {signed(item.delta)} vé
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400">0 vé</span>
          )}
        </td>

        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {formatNumber(item.depositA)} / {formatNumber(item.depositB)}
          </div>
          {item.depositDelta !== 0 && (
            <div
              className={`mt-0.5 text-xs font-black ${
                item.depositDelta > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {signed(item.depositDelta, 'đ')}
            </div>
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/50">
          <td colSpan={7} className="px-4 py-3.5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    <span className="size-2 rounded-full bg-blue-500" />
                    Vé trong {nameA}
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-extrabold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    {item.ticketsA.length} lượt vé
                  </span>
                </div>
                {item.ticketsA.length === 0 ? (
                  <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">
                    Không ghi nhận vé nào ở {nameA}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {item.ticketsA.map((t, idx) => (
                      <TicketDetailCard key={`a-${idx}`} ticket={t} origin="A" />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/30 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    <span className="size-2 rounded-full bg-indigo-500" />
                    Vé trong {nameB}
                  </div>
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-extrabold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                    {item.ticketsB.length} lượt vé
                  </span>
                </div>
                {item.ticketsB.length === 0 ? (
                  <p className="py-2 text-center text-xs italic text-slate-400 dark:text-slate-500">
                    Không ghi nhận vé nào ở {nameB}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {item.ticketsB.map((t, idx) => (
                      <TicketDetailCard key={`b-${idx}`} ticket={t} origin="B" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Bảng so sánh theo ngày khởi hành: số vé, tiền cọc hai bên; bấm một ngày để lọc danh sách chênh lệch */
function DaySummaryTable({
  days,
  nameA,
  nameB,
  selectedDay,
  onSelect,
}: {
  days: DaySummary[];
  nameA: string;
  nameB: string;
  selectedDay: string | null;
  onSelect: (day: string | null) => void;
}) {
  const sum = (f: (d: DaySummary) => number) => days.reduce((n, d) => n + f(d), 0);
  const total = {
    ticketsA: sum((d) => d.ticketsA),
    ticketsB: sum((d) => d.ticketsB),
    depositA: sum((d) => d.depositA),
    depositB: sum((d) => d.depositB),
    diffPhones: sum((d) => d.diffPhones),
  };
  const Delta = ({ n, unit }: { n: number; unit: string }) =>
    n === 0 ? (
      <span className="text-slate-300 dark:text-slate-600">0</span>
    ) : (
      <span className={`font-black ${n > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
        {signed(n, unit)}
      </span>
    );
  const TH = 'px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700';

  return (
    <div className="card-3d-xvip overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-violet-50/60 px-4 py-3 dark:border-slate-800 dark:bg-violet-950/20">
        <div className="flex items-center gap-2">
          <CalendarBlank className="size-5 text-violet-600 dark:text-violet-300" weight="bold" />
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">So sánh theo ngày khởi hành</h3>
        </div>
        {selectedDay !== null ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white"
          >
            Đang lọc ngày {vnDay(selectedDay)}
            <X className="size-3.5" weight="bold" />
          </button>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">Bấm vào một ngày để xem các SĐT lệch của ngày đó</span>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs dark:bg-slate-800/95">
            <tr>
              <th className={`${TH} text-left`}>Ngày</th>
              <th className={`${TH} text-center`} title={nameA}>Vé A</th>
              <th className={`${TH} text-center`} title={nameB}>Vé B</th>
              <th className={`${TH} text-center`}>Chênh vé</th>
              <th className={`${TH} text-right`} title={nameA}>Cọc A</th>
              <th className={`${TH} text-right`} title={nameB}>Cọc B</th>
              <th className={`${TH} text-right`}>Chênh cọc</th>
              <th className={`${TH} text-center`}>SĐT lệch</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const active = selectedDay === d.day;
              return (
                <tr
                  key={d.day || 'none'}
                  onClick={() => onSelect(active ? null : d.day)}
                  className={`cursor-pointer border-b border-slate-100 transition-colors dark:border-slate-800/80 ${
                    active ? 'bg-violet-100/70 dark:bg-violet-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{vnDay(d.day)}</td>
                  <td className="px-3 py-2 text-center tnum">{formatNumber(d.ticketsA)}</td>
                  <td className="px-3 py-2 text-center tnum">{formatNumber(d.ticketsB)}</td>
                  <td className="px-3 py-2 text-center tnum">
                    <Delta n={d.ticketsA - d.ticketsB} unit="" />
                  </td>
                  <td className="px-3 py-2 text-right tnum">{formatNumber(d.depositA)}</td>
                  <td className="px-3 py-2 text-right tnum">{formatNumber(d.depositB)}</td>
                  <td className="px-3 py-2 text-right tnum">
                    <Delta n={d.depositA - d.depositB} unit="đ" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {d.diffPhones > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                        {d.diffPhones}
                      </span>
                    ) : (
                      <CheckCircle className="mx-auto size-4 text-emerald-500" weight="fill" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-amber-50 font-black dark:bg-amber-950/40">
            <tr>
              <td className="px-3 py-2.5 text-slate-900 dark:text-white">TỔNG</td>
              <td className="px-3 py-2.5 text-center tnum">{formatNumber(total.ticketsA)}</td>
              <td className="px-3 py-2.5 text-center tnum">{formatNumber(total.ticketsB)}</td>
              <td className="px-3 py-2.5 text-center tnum">
                <Delta n={total.ticketsA - total.ticketsB} unit="" />
              </td>
              <td className="px-3 py-2.5 text-right tnum">{formatNumber(total.depositA)}</td>
              <td className="px-3 py-2.5 text-right tnum">{formatNumber(total.depositB)}</td>
              <td className="px-3 py-2.5 text-right tnum">
                <Delta n={total.depositA - total.depositB} unit="đ" />
              </td>
              <td className="px-3 py-2.5 text-center tnum">{formatNumber(total.diffPhones)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function TicketComparePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TicketCompareResult | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Ngày khởi hành đang lọc (bấm từ bảng theo ngày); null = mọi ngày
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const showToast = useToast();

  const nameA = fileA?.name ? fileA.name.replace(/\.[^/.]+$/, '') : 'File A';
  const nameB = fileB?.name ? fileB.name.replace(/\.[^/.]+$/, '') : 'File B';

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      showToast('Vui lòng chọn đủ cả 2 file Excel để đối chiếu.', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await ticketCompareApi.compare(fileA, fileB);
      setResult(data);
      setActiveTab('all');
      setDayFilter(null);
      setExpandedKeys(new Set());
      showToast('Đối chiếu dữ liệu thành công!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'So sánh thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const allItems: UnifiedDiffItem[] = useMemo(() => {
    if (!result) return [];
    const list: UnifiedDiffItem[] = [];

    result.onlyInA.forEach((r) => {
      list.push({
        ...r,
        key: `onlyA-${r.phone}-${r.day ?? ''}`,
        category: 'onlyA',
      });
    });

    result.onlyInB.forEach((r) => {
      list.push({
        ...r,
        key: `onlyB-${r.phone}-${r.day ?? ''}`,
        category: 'onlyB',
      });
    });

    result.mismatched.forEach((r) => {
      list.push({
        ...r,
        key: `mismatch-${r.phone}-${r.day ?? ''}`,
        category: 'mismatched',
      });
    });

    return list;
  }, [result]);

  const filteredItems = useMemo(() => {
    let list = allItems;

    if (activeTab === 'onlyA') {
      list = list.filter((item) => item.category === 'onlyA');
    } else if (activeTab === 'onlyB') {
      list = list.filter((item) => item.category === 'onlyB');
    } else if (activeTab === 'mismatched') {
      list = list.filter((item) => item.category === 'mismatched');
    }

    if (dayFilter !== null) list = list.filter((item) => (item.day ?? '') === dayFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.phone.toLowerCase().includes(q) ||
          (item.customerName && item.customerName.toLowerCase().includes(q)) ||
          (item.day !== undefined && vnDay(item.day).includes(q)),
      );
    }

    return list;
  }, [allItems, activeTab, searchQuery, dayFilter]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(filteredItems.map((item) => item.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    if (!result || !fileA || !fileB) return;
    setExporting(true);
    try {
      const { blob, filename } = await ticketCompareApi.exportExcel(fileA, fileB);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất báo cáo Excel.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không xuất được file Excel.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          result ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Export className="size-4 text-emerald-600 dark:text-emerald-400" weight="bold" />
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            </div>
          ) : null
        }
      >
        Đối chiếu vé nhà xe
      </PageTitle>

      {/* Upload files panel */}
      <div className="card-3d-xvip p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Chọn 2 nguồn dữ liệu đối soát</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Hệ thống gom theo số điện thoại và ngày khởi hành để tìm vé chỉ có ở một bên, lệch số vé hoặc lệch tiền cọc.
            </p>
          </div>
          {(fileA || fileB) && (
            <button
              type="button"
              onClick={() => {
                setFileA(null);
                setFileB(null);
                setResult(null);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
            >
              <ArrowsClockwise className="size-3.5" />
              Làm mới
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FileDropCard
            file={fileA}
            label="File A (Nguồn đối chiếu)"
            sublabel="VD: File nội bộ XVIP"
            badgeColor="blue"
            onChange={setFileA}
          />
          <FileDropCard
            file={fileB}
            label="File B (Nguồn nhà xe)"
            sublabel="VD: File đối tác cung cấp"
            badgeColor="indigo"
            onChange={setFileB}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="size-4 text-slate-400 shrink-0" weight="fill" />
            <span>Hỗ trợ file xuất từ hệ thống nội bộ hoặc định dạng xuất của đối tác nhà xe.</span>
          </div>

          <button
            type="button"
            disabled={loading || !fileA || !fileB}
            onClick={handleCompare}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_2px_0_#1d4ed8] transition hover:bg-blue-700 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <ArrowsLeftRight className={`size-4 ${loading ? 'animate-spin' : ''}`} weight="bold" />
            {loading ? 'Đang xử lý đối chiếu...' : 'Bắt đầu so sánh'}
          </button>
        </div>
      </div>

      {/* Results Overview */}
      {result && (
        <div className="space-y-6">
          {/* Banner so sánh tổng quan */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-slate-100 p-4 sm:p-5 dark:border-slate-800 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <ArrowsLeftRight className="size-6" weight="bold" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Kết quả đối chiếu 2 file
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-blue-700 dark:text-blue-300 truncate inline-block max-w-[200px] align-bottom">
                      {nameA}
                    </span>{' '}
                    với{' '}
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate inline-block max-w-[200px] align-bottom">
                      {nameB}
                    </span>
                  </p>
                </div>
              </div>

              {/* So sánh hai bên */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-white/80 px-3.5 py-2 shadow-xs dark:border-blue-900 dark:bg-slate-900/80">
                  <span className="size-2 rounded-full bg-blue-600" />
                  <div className="text-xs">
                    <div className="font-bold text-slate-700 dark:text-slate-300">File A</div>
                    <div className="font-black text-slate-900 dark:text-white">
                      {formatNumber(result.totalPhonesA)} SĐT · {formatNumber(result.totalTicketsA)} vé
                    </div>
                  </div>
                </div>

                <div className="text-slate-400 font-black">vs</div>

                <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-white/80 px-3.5 py-2 shadow-xs dark:border-indigo-900 dark:bg-slate-900/80">
                  <span className="size-2 rounded-full bg-indigo-600" />
                  <div className="text-xs">
                    <div className="font-bold text-slate-700 dark:text-slate-300">File B</div>
                    <div className="font-black text-slate-900 dark:text-white">
                      {formatNumber(result.totalPhonesB)} SĐT · {formatNumber(result.totalTicketsB)} vé
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox
              title="Khớp hoàn toàn"
              value={result.matchedPhones}
              subtext="SĐT & số vé trùng khớp"
              tone="emerald"
              icon={CheckCircle}
            />
            <StatBox
              title={`Chỉ có ở ${nameA}`}
              value={result.onlyInA.length}
              subtext="Thiếu ở file B"
              tone="blue"
              icon={MinusCircle}
            />
            <StatBox
              title={`Chỉ có ở ${nameB}`}
              value={result.onlyInB.length}
              subtext="Thiếu ở file A"
              tone="rose"
              icon={WarningCircle}
            />
            <StatBox
              title="Lệch vé hoặc cọc"
              value={result.mismatched.length}
              subtext="Có ở cả 2 bên nhưng khác số vé / tiền cọc"
              tone="amber"
              icon={Warning}
            />
          </div>

          {/* Tiền cọc hai bên */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Coins className="size-4 text-violet-600" weight="fill" />
                Tổng cọc {nameA}
              </div>
              <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tnum">{formatMoney(result.totalDepositA)}</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Coins className="size-4 text-violet-600" weight="fill" />
                Tổng cọc {nameB}
              </div>
              <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tnum">{formatMoney(result.totalDepositB)}</div>
            </div>
            {(() => {
              const d = result.totalDepositA - result.totalDepositB;
              return (
                <div
                  className={`rounded-xl border p-4 ${
                    d === 0
                      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chênh lệch cọc (A - B)</div>
                  <div
                    className={`mt-1.5 text-xl font-black tnum ${
                      d === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {d === 0 ? 'Khớp 0đ' : signed(d, 'đ')}
                  </div>
                </div>
              );
            })()}
          </div>

          {result.comparedByDay ? (
            <DaySummaryTable
              days={result.byDay}
              nameA={nameA}
              nameB={nameB}
              selectedDay={dayFilter}
              onSelect={setDayFilter}
            />
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              <Info className="size-4 shrink-0" weight="fill" />
              <span>Một trong hai file không có cột ngày khởi hành nên chỉ so theo số điện thoại.</span>
            </div>
          )}

          {(result.cancelledCountA > 0 || result.cancelledCountB > 0) && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <Info className="size-4 shrink-0" weight="fill" />
              <span>
                Đã tự động loại trừ vé có trạng thái <strong>&quot;Hủy&quot;</strong>: {result.cancelledCountA} vé ở file
                A và {result.cancelledCountB} vé ở file B.
              </span>
            </div>
          )}

          {/* Main Diff Table */}
          <div className="card-3d-xvip overflow-hidden">
            {/* Filter and Tab Bar */}
            <div className="border-b border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === 'all'
                        ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span>Tất cả chênh lệch</span>
                    <span className="rounded-full bg-slate-200/60 px-1.5 py-0.2 text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {allItems.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('onlyA')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === 'onlyA'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 dark:bg-slate-800 dark:text-blue-300 dark:border-blue-900'
                    }`}
                  >
                    <span>Chỉ có ở {nameA}</span>
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                      {result.onlyInA.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('onlyB')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === 'onlyB'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 dark:bg-slate-800 dark:text-indigo-300 dark:border-indigo-900'
                    }`}
                  >
                    <span>Chỉ có ở {nameB}</span>
                    <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                      {result.onlyInB.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('mismatched')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === 'mismatched'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200 dark:bg-slate-800 dark:text-amber-300 dark:border-amber-900'
                    }`}
                  >
                    <span>Lệch vé / cọc</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      {result.mismatched.length}
                    </span>
                  </button>
                </div>

                {/* Search & Bulk expand */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 md:w-64">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo SĐT, tên hoặc ngày..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {filteredItems.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={expandAll}
                        title="Mở rộng tất cả dòng chi tiết"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Mở hết
                      </button>
                      <button
                        type="button"
                        onClick={collapseAll}
                        title="Thu gọn tất cả"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Thu gọn
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table Content */}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 mb-3">
                  <CheckCircle className="size-8" weight="bold" />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Không có chênh lệch nào trong nhóm này'}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {searchQuery
                    ? 'Hãy thử thay đổi từ khóa tìm kiếm số điện thoại hoặc tên khách hàng.'
                    : 'Dữ liệu giữa 2 bên khớp hoàn toàn với điều kiện lọc hiện tại.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs dark:bg-slate-800/95">
                    <tr>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        {result.comparedByDay ? 'SĐT · Ngày KH' : 'Số điện thoại'}
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        Tên khách hàng
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        Phân loại
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        {nameA}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        {nameB}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        Chênh vé
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        Cọc A / B
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <DiffItemRow
                        key={item.key}
                        item={item}
                        isExpanded={expandedKeys.has(item.key)}
                        onToggle={() => toggleExpand(item.key)}
                        nameA={nameA}
                        nameB={nameB}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer */}
            {filteredItems.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span>
                  Hiển thị <strong>{filteredItems.length}</strong> / <strong>{allItems.length}</strong> mục chênh lệch
                </span>
                <span className="text-[11px] italic">
                  Nhấp vào dòng để xem danh sách vé, tuyến xe và giờ đi chi tiết
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
