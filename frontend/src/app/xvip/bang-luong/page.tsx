'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { computePayroll, standardDays } from '@/features/payroll/calc';
import { FormulaPanel } from '@/features/payroll/FormulaPanel';
import { MoneyInput } from '@/features/payroll/MoneyInput';
import { attendanceApi } from '@/features/attendance/api';
import { usePayroll, useSavePayroll } from '@/features/payroll/hooks';
import type { PayrollConfig, PayrollData, PayrollEntry } from '@/features/payroll/types';
import { money } from '@/features/xvip/data';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle, TD, TH } from '@/features/xvip/ui';

type Entries = Record<number, PayrollEntry>;

const entriesOf = (data: PayrollData): Entries =>
  Object.fromEntries(data.staff.map((s) => [s.id, s.entry]));

const vnd = (n: number) => `${n < 0 ? '-' : ''}${money(Math.abs(n))}đ`;

export default function PayrollPage() {
  const showToast = useToast();
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const [formulaOpen, setFormulaOpen] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

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

  const { data, isLoading, isError, error, refetch } = usePayroll(month);
  const saveMutation = useSavePayroll();

  // Bản đang sửa tay (chưa lưu); đồng bộ lại từ server mỗi khi tải xong tháng mới hoặc vừa lưu
  const [config, setConfig] = useState<PayrollConfig | null>(null);
  const [entries, setEntries] = useState<Entries>({});
  const [autoFilledIds, setAutoFilledIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!data) return;
    setConfig(data.config);
    setEntries(entriesOf(data));
    setAutoFilledIds(new Set());

    // Tự động điền công từ chấm công cho nhân viên chưa có số công đã lưu (workDays === null)
    let cancelled = false;
    attendanceApi
      .month(data.month)
      .then((att) => {
        if (cancelled) return;
        const congById = new Map(att.staff.map((s) => [s.id, s.totalCong]));
        const newAuto = new Set<number>();
        setEntries((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const s of data.staff) {
            // Chỉ tự điền cho người chưa có số công đã lưu trong DB (workDays === null)
            if (s.entry.workDays === null) {
              const cong = congById.get(s.id);
              if (typeof cong === 'number') {
                next[s.id] = { ...(prev[s.id] ?? s.entry), workDays: Math.min(31, cong) };
                newAuto.add(s.id);
                changed = true;
              }
            }
          }
          return changed ? next : prev;
        });
        setAutoFilledIds(newAuto);
      })
      .catch(() => {
        // Lỗi gọi chấm công không được chặn việc mở bảng lương: bỏ qua và hiện toast
        showToast('Lưu ý: Không tự động lấy được số liệu chấm công cho tháng này.');
      });

    return () => {
      cancelled = true;
    };
  }, [data, showToast]);

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
        return { staff: s, entry, result: computePayroll({ config, daysInMonth: data.daysInMonth, daily: s.daily, entry }) };
      })
      .sort((a, b) => {
        const levelA = a.entry?.level ?? 0;
        const levelB = b.entry?.level ?? 0;
        if (levelB !== levelA) {
          return levelB - levelA;
        }
        return a.staff.fullName.localeCompare(b.staff.fullName, 'vi');
      });
  }, [data, config, entries]);

  const totals = useMemo(
    () => ({
      commission: rows.reduce((sum, r) => sum + r.result.commission, 0),
      baseSalary: rows.reduce((sum, r) => sum + r.result.baseSalary, 0),
      dailyBonus: rows.reduce((sum, r) => sum + r.result.dailyBonus, 0),
      monthlyBonus: rows.reduce((sum, r) => sum + r.result.monthlyBonus, 0),
      overBonus: rows.reduce((sum, r) => sum + r.result.overBonus, 0),
      adjustment: rows.reduce((sum, r) => sum + r.result.adjustment, 0),
      total: rows.reduce((sum, r) => sum + r.result.total, 0),
    }),
    [rows],
  );

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
    setExpanded(null);
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

  const fillFullDays = () => {
    if (!data) return;
    setEntries((prev) => {
      const next = { ...prev };
      for (const s of data.staff) {
        const e = prev[s.id] ?? s.entry;
        if (e.workDays === null) next[s.id] = { ...e, workDays: std };
      }
      return next;
    });
  };

  /** Điền số công thực tế từ bảng chấm công của tháng (chỉ người đã có công, không ghi đè người chưa có dữ liệu) */
  const [fillingAttendance, setFillingAttendance] = useState(false);
  const fillFromAttendance = async () => {
    if (!data) return;
    setFillingAttendance(true);
    try {
      const att = await attendanceApi.month(month);
      const congById = new Map(att.staff.map((s) => [s.id, s.totalCong]));
      const targets = data.staff.filter((s) => (congById.get(s.id) ?? 0) > 0);
      setAutoFilledIds((prev) => {
        const next = new Set(prev);
        for (const s of targets) next.add(s.id);
        return next;
      });
      setEntries((prev) => {
        const next = { ...prev };
        for (const s of targets) {
          next[s.id] = { ...(prev[s.id] ?? s.entry), workDays: Math.min(31, congById.get(s.id) ?? 0) };
        }
        return next;
      });
      const filled = targets.length;
      showToast(
        filled > 0
          ? `Đã điền công từ chấm công cho ${filled} nhân viên. Bấm Lưu bảng lương để giữ lại.`
          : 'Tháng này chưa có công nào từ chấm công để điền.',
      );
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không lấy được dữ liệu chấm công.'}`);
    } finally {
      setFillingAttendance(false);
    }
  };

  const missingDays = rows.filter((r) => r.entry.workDays === null).length;

  return (
    <>
      {/* Thanh chọn tháng + nút lưu dính ngay dưới header, cuộn xuống vẫn thấy */}
      <div
        className="sticky z-10 -mx-4 mb-5 border-b border-slate-200 bg-slate-50/95 px-4 pt-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 sm:-mx-6 sm:px-6"
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
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saveMutation.isPending}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            >
              <FloppyDisk size={18} weight="bold" />
              {saveMutation.isPending ? 'Đang lưu...' : dirty ? 'Lưu bảng lương' : 'Đã lưu'}
            </button>
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
        className="mt-5 !p-0 overflow-hidden"
        title={`Bảng lương ${monthLabel(month).toLowerCase()}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fillFromAttendance}
              disabled={fillingAttendance || !data}
              className="btn-3d btn-3d-white px-3 py-1 text-xs disabled:opacity-50"
            >
              {fillingAttendance ? 'Đang lấy...' : 'Điền công từ chấm công'}
            </button>
            {missingDays > 0 && (
              <button type="button" onClick={fillFullDays} className="btn-3d btn-3d-white px-3 py-1 text-xs">
                Điền đủ {std} công cho {missingDays} người chưa nhập
              </button>
            )}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Nhân viên</th>
                <th className={TH}>Bậc</th>
                <th className={`${TH} text-right`}>Công thực tế</th>
                <th className={`${TH} text-right`}>
                  Doanh số (hoa hồng)
                  <span className="block text-[10px] font-normal normal-case text-slate-400">Theo ngày vào sổ</span>
                </th>
                <th className={`${TH} text-right`}>Lương cứng</th>
                <th className={`${TH} text-right`}>Thưởng ngày</th>
                <th className={`${TH} text-right`}>Thưởng tháng</th>
                <th className={`${TH} text-right`}>Vượt mốc</th>
                <th className={`${TH} text-right`}>Điều chỉnh (+/−)</th>
                <th className={TH}>Ghi chú</th>
                <th className={`${TH} text-right`}>Tổng lương</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !config ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải bảng lương...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có nhân viên nào.
                  </td>
                </tr>
              ) : (
                rows.map(({ staff, entry, result }, index) => {
                  const open = expanded === staff.id;
                  const days = Object.entries(staff.daily)
                    .filter(([, d]) => d.commission > 0)
                    .sort(([a], [b]) => a.localeCompare(b));
                  return (
                    <Fragment key={staff.id}>
                      <tr className="transition-colors hover:bg-blue-50/25 dark:hover:bg-slate-800/50">
                        <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{index + 1}</td>
                        <td className={TD}>
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : staff.id)}
                            title="Xem chi tiết từng ngày"
                            className="flex items-center gap-2.5 text-left"
                          >
                            <Avatar name={staff.fullName} />
                            <span>
                              <span className="block font-extrabold text-slate-900 dark:text-white">{staff.fullName}</span>
                              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                                {open ? <CaretUp size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
                                {days.length} ngày có doanh số
                                {!staff.isActive && <span className="ml-1 rounded bg-red-100 px-1 text-red-700">Đã khóa</span>}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className={TD}>
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
                          <input
                            type="number"
                            min={0}
                            max={31}
                            step={0.5}
                            inputMode="decimal"
                            aria-label={`Số công của ${staff.fullName}`}
                            placeholder={String(std)}
                            value={entry.workDays ?? ''}
                            onChange={(e) => {
                              setAutoFilledIds((prev) => {
                                if (!prev.has(staff.id)) return prev;
                                const next = new Set(prev);
                                next.delete(staff.id);
                                return next;
                              });
                              patchEntry(staff.id, {
                                workDays: e.target.value === '' ? null : Math.min(31, Math.max(0, Number(e.target.value))),
                              });
                            }}
                            className="input-3d tnum !h-9 !w-20 !py-1 !px-2 text-right text-sm"
                          />
                          <span className="block text-[11px] text-slate-400">/ {std} công</span>
                          {autoFilledIds.has(staff.id) && (
                            <span className="mt-0.5 inline-block rounded bg-blue-50 px-1 py-0.2 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              từ chấm công{month === getVnToday().slice(0, 7) ? ' (đang tính đến hôm nay)' : ''}
                            </span>
                          )}
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
                          <MoneyInput
                            allowNegative
                            align="right"
                            ariaLabel={`Điều chỉnh lương của ${staff.fullName}`}
                            className="!h-9 !w-28 !py-1 !px-2 text-sm"
                            value={entry.adjustment}
                            onChange={(adjustment) => patchEntry(staff.id, { adjustment })}
                          />
                        </td>
                        <td className={TD}>
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
                      {open && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                          <td colSpan={12} className="border-t border-slate-200 px-6 py-3 dark:border-slate-700">
                            {days.length === 0 ? (
                              <p className="text-xs font-semibold text-slate-500">Tháng này chưa có doanh số ngày nào.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {days.map(([day, d]) => {
                                  const bonus = result.bonusDays.find((b) => b.day === day)?.bonus ?? 0;
                                  return (
                                    <span
                                      key={day}
                                      className={`rounded-lg border px-2.5 py-1 text-xs ${
                                        bonus > 0
                                          ? 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200'
                                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                      }`}
                                    >
                                      <b>{day.slice(8)}/{day.slice(5, 7)}</b> · <span className="tnum">{money(d.commission)}đ</span>
                                      {bonus > 0 && <b className="tnum ml-1">+{money(bonus)}</b>}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
                  <td className={`${TD} text-right tnum font-black`}>{vnd(totals.adjustment)}</td>
                  <td className={TD} />
                  <td className={`${TD} text-right tnum text-base font-black text-emerald-700 dark:text-emerald-400`}>
                    {vnd(totals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

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
                  Tổng lương = Lương cứng (1·2·3) + Thưởng ngày (4) + Thưởng tháng (5) + Thưởng vượt mốc (6) ± Điều chỉnh tay
                </div>
                <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  &ldquo;Doanh số&rdquo; ở đây chính là hoa hồng được tổng hợp theo ngày vào sổ (ngày tạo vé), không tính theo ngày khách khởi hành. Công thức dùng chung cho mọi tháng; sửa số nào, bảng lương
                  bên dưới tính lại ngay, bấm <b>Lưu bảng lương</b> để giữ lại.
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
            </p>
          )
        ) : (
          <p className="text-sm text-slate-400">Đang tải...</p>
        )}
      </Card>
    </>
  );
}
