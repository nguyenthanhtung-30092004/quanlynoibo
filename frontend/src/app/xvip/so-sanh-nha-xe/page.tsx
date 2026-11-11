'use client';

import { useId, useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsLeftRight,
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
import type { TicketCompareResult, TicketDetail } from '@/features/ticket-compare/types';
import { useToast } from '@/features/xvip/toast';
import { PageTitle } from '@/features/xvip/ui';

type TabKey = 'all' | 'onlyA' | 'onlyB' | 'mismatched';

function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
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
          ? 'border-xv-blue bg-blue-50/60 shadow-lg dark:border-blue-400 dark:bg-blue-950/20'
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
                Kéo thả hoặc <span className="text-xv-blue underline underline-offset-2">chọn file Excel</span>
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
      text: 'Lệch số vé',
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
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-black ${
              item.delta > 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            {item.delta > 0 ? `+${item.delta}` : item.delta} vé
          </span>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/50">
          <td colSpan={6} className="px-4 py-3.5 sm:px-6">
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

export default function TicketComparePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TicketCompareResult | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
        key: `onlyA-${r.phone}`,
        category: 'onlyA',
      });
    });

    result.onlyInB.forEach((r) => {
      list.push({
        ...r,
        key: `onlyB-${r.phone}`,
        category: 'onlyB',
      });
    });

    result.mismatched.forEach((r) => {
      list.push({
        ...r,
        key: `mismatch-${r.phone}`,
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.phone.toLowerCase().includes(q) ||
          (item.customerName && item.customerName.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allItems, activeTab, searchQuery]);

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

  const handleExportCsv = () => {
    if (!result || allItems.length === 0) return;
    const header = ['Số điện thoại', 'Tên khách', 'Phân loại', 'Vé file A', 'Vé file B', 'Chênh lệch'];
    const rows = allItems.map((item) => [
      `"${item.phone}"`,
      `"${(item.customerName ?? '').replace(/"/g, '""')}"`,
      item.category === 'onlyA' ? `Chỉ có ở ${nameA}` : item.category === 'onlyB' ? `Chỉ có ở ${nameB}` : 'Lệch số vé',
      item.countA,
      item.countB,
      item.delta,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ket_qua_so_sanh_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất báo cáo CSV thành công!', 'success');
  };

  return (
    <div className="space-y-6">
      <PageTitle
        actions={
          result ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Export className="size-4 text-emerald-600 dark:text-emerald-400" weight="bold" />
                Xuất file CSV
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
              Hệ thống gom nhóm theo số điện thoại để tìm số chỉ có ở một bên hoặc bị lệch số vé.
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
            className="flex items-center gap-2 rounded-xl bg-xv-blue px-6 py-2.5 text-sm font-bold text-white shadow-[0_2px_0_#1d4ed8] transition hover:bg-blue-700 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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
              title="Lệch số lượng vé"
              value={result.mismatched.length}
              subtext="Cùng SĐT nhưng khác số vé"
              tone="amber"
              icon={Warning}
            />
          </div>

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
                    <span>Lệch số vé</span>
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
                      placeholder="Tìm theo SĐT hoặc tên..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-xv-blue focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                        Số điện thoại
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
                        Chênh lệch
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
