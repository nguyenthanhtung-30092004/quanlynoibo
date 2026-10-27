'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  FloppyDisk,
  Function as FunctionIcon,
} from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { shiftMonth, monthLabel } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { computePayroll, monthLateMinutes, monthOvertimeHours, standardDays } from '@/features/payroll/calc';
import { FormulaPanel } from '@/features/payroll/FormulaPanel';
import { PayrollDetailModal } from '@/features/payroll/PayrollDetailModal';
import { MoneyInput } from '@/features/payroll/MoneyInput';
import { useAttendanceMonth } from '@/features/attendance/hooks';
import { usePayroll, useSavePayroll } from '@/features/payroll/hooks';
import type { PayrollConfig, PayrollData, PayrollEntry } from '@/features/payroll/types';
import { money } from '@/features/xvip/data';
import { ScrollTable } from '@/features/xvip/ScrollTable';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle, TD, TH } from '@/features/xvip/ui';

type Entries = Record<number, PayrollEntry>;

const entriesOf = (data: PayrollData): Entries =>
  Object.fromEntries(data.staff.map((s) => [s.id, s.entry]));

const vnd = (n: number) => `${n < 0 ? '-' : ''}${money(Math.abs(n))}đ`;

/** Một dòng "nhãn ... giá trị" trong thẻ nhân viên trên điện thoại */
function Line({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
        {note && <div className="text-[11px] leading-snug text-slate-400">{note}</div>}
      </div>
      <div className="tnum shrink-0 text-right text-sm font-bold text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}

export default function PayrollPage() {
  const showToast = useToast();
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const [formulaOpen, setFormulaOpen] = useState(true);
  // Nhân viên đang mở form xem chi tiết (null = đóng)
  const [detailId, setDetailId] = useState<number | null>(null);

  // Header của trang cũng dính và cao không cố định (xuống dòng khi hẹp): đo để thanh tháng dính ngay bên dưới
  const [headerHeight, setHeaderHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Thanh chọn tháng dính dưới header: bảng lương ghim tiêu đề dưới cả thanh này nên cần biết chiều cao
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(bar.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const { data, isLoading, isError, error, refetch } = usePayroll(month);
  const saveMutation = useSavePayroll();

  // Bản đang sửa tay (chưa lưu); đồng bộ lại từ server mỗi khi tải xong tháng mới hoặc vừa lưu
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [entries, setEntries] = useState<Entries>({});
  // Chấm công cả tháng (tự tải lại khi có lượt quẹt mới): công thực tế, phút vào muộn, giờ tăng ca của từng nhân viên
  const { data: attData, isError: attError, refetch: refetchAtt } = useAttendanceMonth(month);
  const att = attData ?? null;
  const congById = useMemo(
    () => new Map((att?.staff ?? []).map((s) => [s.id, Math.min(31, s.totalCong)])),
    [att],
  );
  const lateById = useMemo(
    () => new Map((att?.staff ?? []).map((s) => [s.id, monthLateMinutes(s.days)])),
    [att],
  );
  const overtimeById = useMemo(
    () => new Map((att?.staff ?? []).map((s) => [s.id, monthOvertimeHours(s.days)])),
    [att],
  );

  useEffect(() => {
    if (!data) return;
    setConfig(data.config);
    setEntries(entriesOf(data));
  }, [data]);

  const baseline = useMemo(
    () => (data ? JSON.stringify({ config: data.config, entries: entriesOf(data) }) : ''),
    [data],
  );
  const dirty = !!data && !!config && JSON.stringify({ config, entries }) !== baseline;

  const rows = useMemo(() => {
    if (!data || !config) return [];
    return data.staff
      .map((s) => {
        const entry = entries[s.id] ?? s.entry;
        // Công thực tế luôn lấy từ chấm công (máy chấm công), không nhập tay
        const workDays = att ? (congById.get(s.id) ?? 0) : null;
        const lateMinutes = lateById.get(s.id) ?? 0;
        const overtimeHours = overtimeById.get(s.id) ?? 0;
        return {
          staff: s,
          entry,
          result: computePayroll({
            config,
            daysInMonth: data.daysInMonth,
            daily: s.daily,
            entry: { ...entry, workDays },
            lateMinutes,
            overtimeHours,
          }),
        };
      })
      .sort((a, b) => {
        const levelA = a.entry?.level ?? 0;
        const levelB = b.entry?.level ?? 0;
        if (levelB !== levelA) {
          return levelB - levelA;
        }
        return a.staff.fullName.localeCompare(b.staff.fullName, 'vi');
      });
  }, [data, config, entries, att, congById, lateById, overtimeById]);

  const totals = useMemo(
    () => ({
      commission: rows.reduce((sum, r) => sum + r.result.commission, 0),
      baseSalary: rows.reduce((sum, r) => sum + r.result.baseSalary, 0),
      dailyBonus: rows.reduce((sum, r) => sum + r.result.dailyBonus, 0),
      monthlyBonus: rows.reduce((sum, r) => sum + r.result.monthlyBonus, 0),
      overBonus: rows.reduce((sum, r) => sum + r.result.overBonus, 0),
      latePenalty: rows.reduce((sum, r) => sum + r.result.latePenalty, 0),
      overtimePay: rows.reduce((sum, r) => sum + r.result.overtimePay, 0),
      adjustment: rows.reduce((sum, r) => sum + r.result.adjustment, 0),
      total: rows.reduce((sum, r) => sum + r.result.total, 0),
    }),
    [rows],
  );

  const detailRow = detailId === null ? null : (rows.find((r) => r.staff.id === detailId) ?? null);

  const std = data && config ? standardDays(data.daysInMonth, config.standardDaysOffset) : 0;

  const patchEntry = (id: number, patch: Partial<PayrollEntry>) =>
    setEntries((prev) => {
      const current = prev[id] ?? data?.staff.find((s) => s.id === id)?.entry;
      return current ? { ...prev, [id]: { ...current, ...patch } } : prev;
    });

  const changeMonth = (next: string) => {
    if (dirty && !window.confirm('Bạn đang có thay đổi chưa lưu. Chuyển tháng sẽ mất các thay đổi này, tiếp tục?')) {
      return;
    }
    setMonth(next);
    setDetailId(null);
  };

  const save = async () => {
    if (!config) return;
    try {
      await saveMutation.mutateAsync({ month, config, entries });
      showToast(`Đã lưu bảng lương ${monthLabel(month).toLowerCase()}.`);
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không lưu được bảng lương.'}`);
    }
  };

  /** Sau khi Admin đổi ca trong form chi tiết: tải lại chấm công để tính lại tăng ca / vào muộn */
  const reloadAttendance = async () => {
    await refetchAtt();
  };

  return (
    <>
      {/* Thanh chọn tháng dính ngay dưới header khi dùng máy tính; điện thoại không dính để nhường chỗ cho nội dung */}
      <div
        ref={barRef}
        className="z-10 -mx-4 md:sticky mb-5 border-b border-slate-200 bg-slate-50/95 px-4 pt-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 sm:-mx-6 sm:px-6"
        style={{ top: headerHeight }}
      >
      <PageTitle
        className="!mb-3"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => changeMonth(shiftMonth(month, -1))}
                aria-label="Tháng trước"
                className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <CaretLeft size={16} weight="bold" />
              </button>
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && changeMonth(e.target.value)}
                aria-label="Chọn tháng tính lương"
                className="h-8 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => changeMonth(shiftMonth(month, 1))}
                aria-label="Tháng sau"
                className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <CaretRight size={16} weight="bold" />
              </button>
            </div>
          </div>
        }
      >
        Bảng tính lương
      </PageTitle>
      </div>

      {isError && (
        <Card>
          <p className="text-sm font-bold text-red-600">
            {error instanceof ApiError ? error.message : 'Không tải được bảng lương.'}{' '}
            <button type="button" onClick={() => refetch()} className="underline">
              Thử lại
            </button>
          </p>
        </Card>
      )}

      {/* Tóm tắt tháng */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: monthLabel(month), value: data ? `${data.daysInMonth} ngày · ${std} công chuẩn` : '...' },
          { label: 'Nhân viên', value: data ? `${data.staff.length} người` : '...' },
          { label: 'Tổng hoa hồng (doanh số)', value: data ? vnd(totals.commission) : '...' },
          { label: 'Tổng quỹ lương', value: data ? vnd(totals.total) : '...' },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`rounded-2xl border px-4 py-3 ${
              i === 3
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{s.label}</div>
            <div
              className={`tnum mt-1 text-lg font-black ${
                i === 3 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bảng lương */}
      <Card
        className="mt-5 !p-0 overflow-clip"
        title={`Bảng lương ${monthLabel(month).toLowerCase()}`}
      >
        {/* Máy tính: bảng đầy đủ các cột */}
        <div className="hidden md:block">
        <ScrollTable pinOffset={barHeight}>
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Nhân viên</th>
                <th className={TH}>Bậc</th>
                <th className={`${TH} text-right`}>Công thực tế</th>
                <th className={`${TH} text-right`}>
                  Doanh số
                  <span className="block text-[10px] font-normal normal-case text-slate-400">Theo ngày vào sổ</span>
                </th>
                <th className={`${TH} text-right`}>Lương cứng</th>
                <th className={`${TH} text-right`}>Thưởng ngày</th>
                <th className={`${TH} text-right`}>Thưởng tháng</th>
                <th className={`${TH} text-right`}>Vượt mốc</th>
                <th className={`${TH} text-right`}>
                  Trừ vào muộn
                  <span className="block text-[10px] font-normal normal-case text-slate-400">Theo phút muộn</span>
                </th>
                <th className={`${TH} text-right`}>
                  Tăng ca
                  <span className="block text-[10px] font-normal normal-case text-slate-400">Theo giờ ở lại thêm</span>
                </th>
                <th className={`${TH} text-right`}>Điều chỉnh (+/−)</th>
                <th className={TH}>Ghi chú</th>
                <th className={`${TH} text-right`}>Tổng lương</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !config ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải bảng lương...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có nhân viên nào.
                  </td>
                </tr>
              ) : (
                rows.map(({ staff, entry, result }, index) => {
                  const days = Object.entries(staff.daily)
                    .filter(([, d]) => d.commission > 0)
                    .sort(([a], [b]) => a.localeCompare(b));
                  return (
                    <tr
                      key={staff.id}
                      onClick={() => setDetailId(staff.id)}
                      title="Bấm để xem chi tiết"
                      className="cursor-pointer transition-colors hover:bg-blue-50/25 dark:hover:bg-slate-800/50"
                    >
                      <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{index + 1}</td>
                      <td className={TD}>
                        <div className="flex items-center gap-2.5 text-left">
                          <Avatar name={staff.fullName} />
                          <span>
                            <span className="block font-extrabold text-slate-900 dark:text-white">{staff.fullName}</span>
                            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                              {days.length} ngày có doanh số
                              {!staff.isActive && <span className="ml-1 rounded bg-red-100 px-1 text-red-700">Đã khóa</span>}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
                        <select
                          className="input-3d !h-9 !w-28 !py-1 !px-2 text-sm"
                          aria-label={`Bậc lương của ${staff.fullName}`}
                          value={Math.min(entry.level, config.levels.length - 1)}
                          onChange={(e) => patchEntry(staff.id, { level: Number(e.target.value) })}
                        >
                          {config.levels.map((l, i) => (
                            <option key={i} value={i}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum text-base font-black text-slate-900 dark:text-white">
                          {att ? String(result.workDays).replace('.', ',') : attError ? '—' : '…'}
                        </span>
                        <span className="block text-[11px] text-slate-400">/ {std} công</span>
                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-1 py-0.2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          từ chấm công{month === getVnToday().slice(0, 7) ? ' (đang tính đến hôm nay)' : ''}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum font-bold text-slate-900 dark:text-white">{vnd(result.commission)}</span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum font-bold text-slate-900 dark:text-white">{vnd(result.baseSalary)}</span>
                        <span className="block text-[11px] text-slate-400">
                          {result.baseSource === 'top' && (
                            <b className="mr-1 rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              đạt mốc
                            </b>
                          )}
                          {money(result.base)} ÷ {result.standardDays} × {result.workDays}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum font-bold text-teal-700 dark:text-teal-400">{vnd(result.dailyBonus)}</span>
                        <span className="block text-[11px] text-slate-400">{result.bonusDays.length} ngày đạt</span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum font-bold text-teal-700 dark:text-teal-400">{vnd(result.monthlyBonus)}</span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum font-bold text-teal-700 dark:text-teal-400">{vnd(result.overBonus)}</span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span
                          className={`tnum font-bold ${
                            result.latePenalty > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                          }`}
                        >
                          {result.latePenalty > 0 ? `−${vnd(result.latePenalty)}` : vnd(0)}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {result.lateMinutes > 0
                            ? `muộn ${result.lateMinutes} phút${
                                config.latePenaltyPerMinute > 0 ? '' : ' (chưa đặt mức trừ)'
                              }`
                            : 'không muộn'}
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span
                          className={`tnum font-bold ${
                            result.overtimePay > 0 ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'
                          }`}
                        >
                          {result.overtimePay > 0 ? `+${vnd(result.overtimePay)}` : vnd(0)}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {result.overtimeHours > 0
                            ? `${String(result.overtimeHours).replace('.', ',')} giờ${
                                config.overtimePerHour > 0 ? '' : ' (chưa đặt mức tiền)'
                              }`
                            : 'không tăng ca'}
                        </span>
                      </td>
                      <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                        <MoneyInput
                          allowNegative
                          align="right"
                          ariaLabel={`Điều chỉnh lương của ${staff.fullName}`}
                          className="!h-9 !w-28 !py-1 !px-2 text-sm"
                          value={entry.adjustment}
                          onChange={(adjustment) => patchEntry(staff.id, { adjustment })}
                        />
                      </td>
                      <td className={TD} onClick={(e) => e.stopPropagation()}>
                        <input
                          className="input-3d !h-9 !w-40 !py-1 !px-2 text-sm"
                          aria-label={`Ghi chú lương của ${staff.fullName}`}
                          placeholder="Ghi chú..."
                          maxLength={200}
                          value={entry.note}
                          onChange={(e) => patchEntry(staff.id, { note: e.target.value })}
                        />
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className="tnum text-base font-black text-emerald-700 dark:text-emerald-400">
                          {vnd(result.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                  <td colSpan={4} className={`${TD} font-black uppercase text-slate-700 dark:text-slate-200`}>
                    Tổng cộng
                  </td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.commission)}</td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.baseSalary)}</td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.dailyBonus)}</td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.monthlyBonus)}</td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.overBonus)}</td>
                  <td className={`${TD} text-right tnum font-black text-red-600 dark:text-red-400`}>
                    {totals.latePenalty > 0 ? `−${vnd(totals.latePenalty)}` : vnd(0)}
                  </td>
                  <td className={`${TD} text-right tnum font-black text-teal-700 dark:text-teal-400`}>
                    {totals.overtimePay > 0 ? `+${vnd(totals.overtimePay)}` : vnd(0)}
                  </td>
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.adjustment)}</td>
                  <td className={TD} />
                  <td className={`${TD} text-right tnum text-base font-black text-emerald-700 dark:text-emerald-400`}>
                    {vnd(totals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </ScrollTable>
        </div>

        {/* Điện thoại: mỗi nhân viên một thẻ, tổng lương nằm ngay đầu thẻ */}
        <div className="space-y-3 p-3 md:hidden">
          {isLoading || !config ? (
            <p className="p-6 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
              Đang tải bảng lương...
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Chưa có nhân viên nào.
            </p>
          ) : (
            <>
              {rows.map(({ staff, entry, result }, index) => {
                const daysWithSales = Object.values(staff.daily).filter((d) => d.commission > 0).length;
                return (
                  <div
                    key={staff.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <button
                      type="button"
                      onClick={() => setDetailId(staff.id)}
                      aria-label={`Xem chi tiết lương của ${staff.fullName}`}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={staff.fullName} />
                        <span className="min-w-0">
                          <span className="block truncate font-extrabold text-slate-900 dark:text-white">
                            {index + 1}. {staff.fullName}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {daysWithSales} ngày có doanh số
                            {!staff.isActive && (
                              <span className="ml-1 rounded bg-red-100 px-1 text-red-700">Đã khóa</span>
                            )}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Tổng lương
                        </span>
                        <span className="tnum block text-lg font-black text-emerald-700 dark:text-emerald-400">
                          {vnd(result.total)}
                        </span>
                      </span>
                    </button>

                    <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                      <Line
                        label="Công thực tế"
                        note={`từ chấm công${month === getVnToday().slice(0, 7) ? ' (đang tính đến hôm nay)' : ''}`}
                      >
                        {att ? String(result.workDays).replace('.', ',') : attError ? '—' : '…'}
                        <span className="font-medium text-slate-400"> / {std} công</span>
                      </Line>
                      <Line label="Doanh số" note="Theo ngày vào sổ">
                        {vnd(result.commission)}
                      </Line>
                      <Line
                        label="Lương cứng"
                        note={
                          <>
                            {result.baseSource === 'top' && (
                              <b className="mr-1 rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                đạt mốc
                              </b>
                            )}
                            {money(result.base)} ÷ {result.standardDays} × {result.workDays}
                          </>
                        }
                      >
                        {vnd(result.baseSalary)}
                      </Line>
                      <Line label="Thưởng ngày" note={`${result.bonusDays.length} ngày đạt`}>
                        <span className="text-teal-700 dark:text-teal-400">{vnd(result.dailyBonus)}</span>
                      </Line>
                      <Line label="Thưởng tháng">
                        <span className="text-teal-700 dark:text-teal-400">{vnd(result.monthlyBonus)}</span>
                      </Line>
                      <Line label="Vượt mốc">
                        <span className="text-teal-700 dark:text-teal-400">{vnd(result.overBonus)}</span>
                      </Line>
                      <Line
                        label="Trừ vào muộn"
                        note={
                          result.lateMinutes > 0
                            ? `muộn ${result.lateMinutes} phút${
                                config.latePenaltyPerMinute > 0 ? '' : ' (chưa đặt mức trừ)'
                              }`
                            : 'không muộn'
                        }
                      >
                        <span className={result.latePenalty > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                          {result.latePenalty > 0 ? `−${vnd(result.latePenalty)}` : vnd(0)}
                        </span>
                      </Line>
                      <Line
                        label="Tăng ca"
                        note={
                          result.overtimeHours > 0
                            ? `${String(result.overtimeHours).replace('.', ',')} giờ${
                                config.overtimePerHour > 0 ? '' : ' (chưa đặt mức tiền)'
                              }`
                            : 'không tăng ca'
                        }
                      >
                        <span className={result.overtimePay > 0 ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'}>
                          {result.overtimePay > 0 ? `+${vnd(result.overtimePay)}` : vnd(0)}
                        </span>
                      </Line>
                    </div>

                    {/* Ô nhập: cao 44px và chữ 16px để dễ chạm, iPhone không tự phóng to khi nhập */}
                    <div className="mt-2 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Bậc</span>
                        <select
                          className="input-3d !h-11 !w-full !py-1 !px-2 !text-base"
                          aria-label={`Bậc lương của ${staff.fullName}`}
                          value={Math.min(entry.level, config.levels.length - 1)}
                          onChange={(e) => patchEntry(staff.id, { level: Number(e.target.value) })}
                        >
                          {config.levels.map((l, i) => (
                            <option key={i} value={i}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Điều chỉnh (+/−)
                        </span>
                        <MoneyInput
                          allowNegative
                          align="right"
                          ariaLabel={`Điều chỉnh lương của ${staff.fullName}`}
                          className="!h-11 !w-full !py-1 !px-2 !text-base"
                          value={entry.adjustment}
                          onChange={(adjustment) => patchEntry(staff.id, { adjustment })}
                        />
                      </label>
                      <label className="col-span-2 block min-w-0">
                        <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Ghi chú</span>
                        <input
                          className="input-3d !h-11 !w-full !py-1 !px-2 !text-base"
                          aria-label={`Ghi chú lương của ${staff.fullName}`}
                          placeholder="Ghi chú..."
                          maxLength={200}
                          value={entry.note}
                          onChange={(e) => patchEntry(staff.id, { note: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              {/* Tổng cộng cả tháng */}
              <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-3.5 dark:border-slate-600 dark:bg-slate-800/80">
                <div className="mb-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  Tổng cộng
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  <Line label="Doanh số">{vnd(totals.commission)}</Line>
                  <Line label="Lương cứng">{vnd(totals.baseSalary)}</Line>
                  <Line label="Thưởng ngày">{vnd(totals.dailyBonus)}</Line>
                  <Line label="Thưởng tháng">{vnd(totals.monthlyBonus)}</Line>
                  <Line label="Vượt mốc">{vnd(totals.overBonus)}</Line>
                  <Line label="Trừ vào muộn">
                    <span className="text-red-600 dark:text-red-400">
                      {totals.latePenalty > 0 ? `−${vnd(totals.latePenalty)}` : vnd(0)}
                    </span>
                  </Line>
                  <Line label="Tăng ca">
                    <span className="text-teal-700 dark:text-teal-400">
                      {totals.overtimePay > 0 ? `+${vnd(totals.overtimePay)}` : vnd(0)}
                    </span>
                  </Line>
                  <Line label="Điều chỉnh">{vnd(totals.adjustment)}</Line>
                  <Line label="Tổng lương">
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {vnd(totals.total)}
                    </span>
                  </Line>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {detailRow && config && (
        <PayrollDetailModal
          staff={detailRow.staff}
          month={month}
          config={config}
          result={detailRow.result}
          attendance={att?.staff.find((a) => a.id === detailRow.staff.id) ?? null}
          shifts={att?.shifts ?? []}
          onClose={() => setDetailId(null)}
          onShiftChanged={reloadAttendance}
        />
      )}

      {/* Công thức điền tay */}
      <Card
        className="mt-5"
        title="Công thức tính lương"
        action={
          <button
            type="button"
            onClick={() => setFormulaOpen((v) => !v)}
            className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-1 text-xs"
          >
            <FunctionIcon size={14} weight="bold" />
            {formulaOpen ? 'Thu gọn' : 'Chỉnh công thức'}
            {formulaOpen ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
          </button>
        }
      >
        {config && data ? (
          formulaOpen ? (
            <>
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="font-black text-emerald-900 dark:text-emerald-200">
                  Tổng lương = Lương cứng (1·2·3) + Thưởng ngày (4) + Thưởng tháng (5) + Thưởng vượt mốc (6) − Trừ vào muộn (7) + Tiền tăng ca (8) ± Điều chỉnh tay
                </div>
                <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  &ldquo;Doanh số&rdquo; ở đây chính là hoa hồng được tổng hợp theo ngày vào sổ (ngày tạo vé), không tính theo ngày khách khởi hành. Công thức dùng chung cho mọi tháng; sửa số nào, bảng lương
                  bên dưới tính lại ngay, bấm <b>Lưu bảng lương</b> ở cuối trang để giữ lại.
                </p>
              </div>
              <FormulaPanel config={config} onChange={setConfig} daysInMonth={data.daysInMonth} />
            </>
          ) : (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Lương cứng ({config.levels.map((l) => `${l.label}: ${money(l.base)}`).join(' · ')}) ÷ {std} công × công thực tế.
              Đạt {money(config.topBase.threshold)} thì lương cứng {money(config.topBase.base)}. Thưởng ngày{' '}
              {config.dailyBonuses.map((t) => `≥${money(t.threshold)}: ${money(t.bonus)}`).join(', ')}. Tháng ≥
              {money(config.monthlyBonus.threshold)}: +{money(config.monthlyBonus.bonus)}. Vượt{' '}
              {money(config.overRate.threshold)}: {config.overRate.percent}% phần vượt.
              {config.latePenaltyPerMinute > 0 && ` Vào muộn trừ ${money(config.latePenaltyPerMinute)}đ mỗi phút.`}
              {config.overtimePerHour > 0 && ` Tăng ca ${money(config.overtimePerHour)}đ mỗi giờ.`}
            </p>
          )
        ) : (
          <p className="text-sm text-slate-400">Đang tải...</p>
        )}
      </Card>

      {/* Chỉ hiện khi có thay đổi chưa lưu (công thức, bậc, điều chỉnh, ghi chú); công thực tế thì tự lấy từ chấm công */}
      {dirty && (
        <div className="sticky bottom-4 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-blue-900 dark:bg-slate-900/95">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Có thay đổi chưa lưu (công thức, bậc, điều chỉnh hoặc ghi chú).
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saveMutation.isPending}
            className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FloppyDisk size={18} weight="bold" />
            {saveMutation.isPending ? 'Đang lưu...' : 'Lưu bảng lương'}
          </button>
        </div>
      )}
    </>
  );
}
