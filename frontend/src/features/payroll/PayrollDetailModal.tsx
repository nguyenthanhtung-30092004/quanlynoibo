'use client';

import { useMemo, useState } from 'react';
import { Warning } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel } from '@/lib/month';
import { attendanceApi } from '@/features/attendance/api';
import type { AttendanceDayCell, AttendanceStaff, ShiftOption } from '@/features/attendance/types';
import { Modal } from '@/features/xvip/Modal';
import { money } from '@/features/xvip/data';
import { useToast } from '@/features/xvip/toast';
import { Avatar } from '@/features/xvip/ui';
import type { PayrollResult } from './calc';
import type { PayrollConfig, PayrollStaff } from './types';

type Filter = 'all' | 'bonus' | 'overtime';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Tất cả ngày' },
  { key: 'bonus', label: 'Ngày đạt thưởng' },
  { key: 'overtime', label: 'Ngày tăng ca' },
];

const timeText = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(iso))
    : '--:--';

const hoursText = (h: number) => `${String(h).replace('.', ',')} giờ`;

interface PayrollDetailModalProps {
  staff: PayrollStaff;
  month: string;
  config: PayrollConfig;
  result: PayrollResult;
  attendance: AttendanceStaff | null;
  shifts: ShiftOption[];
  onClose: () => void;
  /** Gọi sau khi đổi ca để trang tải lại chấm công và tính lại lương */
  onShiftChanged: () => Promise<void> | void;
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'teal' | 'red' }) {
  const color =
    tone === 'teal'
      ? 'text-teal-700 dark:text-teal-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`tnum text-base font-black ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{note}</div>
    </div>
  );
}

export function PayrollDetailModal({
  staff,
  month,
  config,
  result,
  attendance,
  shifts,
  onClose,
  onShiftChanged,
}: PayrollDetailModalProps) {
  const showToast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);

  const bonusByDay = useMemo(() => new Map(result.bonusDays.map((b) => [b.day, b.bonus])), [result.bonusDays]);

  const rows = useMemo(() => {
    const days = new Set<string>();
    for (const [day, d] of Object.entries(staff.daily)) if (d.commission > 0) days.add(day);
    for (const [day, c] of Object.entries(attendance?.days ?? {})) if (c.status !== 'not_in') days.add(day);
    return [...days].sort().map((day) => ({
      day,
      commission: staff.daily[day]?.commission ?? 0,
      bonus: bonusByDay.get(day) ?? 0,
      cell: attendance?.days[day] ?? null,
    }));
  }, [staff.daily, attendance, bonusByDay]);

  const visible = rows.filter((r) =>
    filter === 'bonus' ? r.bonus > 0 : filter === 'overtime' ? (r.cell?.overtimeHours ?? 0) > 0 : true,
  );

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await onShiftChanged();
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không lưu được ca làm việc.'}`);
    } finally {
      setBusy(false);
    }
  };

  const parseShift = (value: string) => (value === 'auto' ? null : Number(value));

  const changeDefault = (value: string) =>
    run(() => attendanceApi.setDefaultShift({ userId: staff.id, shiftStart: parseShift(value) }));

  const changeDay = (day: string, value: string) =>
    run(() => attendanceApi.setShiftOverride({ userId: staff.id, day, shiftStart: parseShift(value) }));

  const dayShiftValue = (cell: AttendanceDayCell) =>
    cell.shiftSource === 'forced' && cell.shiftStart !== null ? String(cell.shiftStart) : 'auto';

  return (
    <Modal title={`Chi tiết lương - ${monthLabel(month)}`} onClose={onClose} size="xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={staff.fullName} />
          <div>
            <div className="text-base font-black text-slate-900 dark:text-white">{staff.fullName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tổng lương tạm tính: <b className="tnum text-emerald-700 dark:text-emerald-400">{money(result.total)}đ</b>
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Ca mặc định
          <select
            className="input-3d !h-9 !w-40 !py-1 !px-2 text-sm"
            disabled={busy || !attendance}
            value={attendance?.defaultShift != null ? String(attendance.defaultShift) : 'auto'}
            onChange={(e) => changeDefault(e.target.value)}
            aria-label="Ca mặc định của nhân viên"
          >
            <option value="auto">Tự đoán</option>
            {shifts.map((s) => (
              <option key={s.startMinute} value={s.startMinute}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Công thực tế" value={`${result.workDays} / ${result.standardDays}`} note="công" />
        <Stat
          label="Thưởng ngày"
          value={`+${money(result.dailyBonus)}đ`}
          note={`${result.bonusDays.length} ngày đạt`}
          tone="teal"
        />
        <Stat
          label="Tăng ca"
          value={`+${money(result.overtimePay)}đ`}
          note={`${hoursText(result.overtimeHours)} × ${money(config.overtimePerHour)}đ`}
          tone="teal"
        />
        <Stat
          label="Vào muộn"
          value={result.latePenalty > 0 ? `−${money(result.latePenalty)}đ` : '0đ'}
          note={`${result.lateMinutes} phút muộn`}
          tone={result.latePenalty > 0 ? 'red' : undefined}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-lg border px-3 py-1 text-xs font-bold ${
              filter === f.key
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              {['Ngày', 'Ca', 'Vào – Ra', 'Công', 'Hoa hồng', 'Thưởng ngày', 'Tăng ca'].map((h, i) => (
                <th
                  key={h}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 ${
                    i >= 3 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {rows.length === 0 ? 'Tháng này chưa có dữ liệu.' : 'Không có ngày nào phù hợp bộ lọc.'}
                </td>
              </tr>
            ) : (
              visible.map(({ day, commission, bonus, cell }) => {
                const otPay = Math.round((cell?.overtimeHours ?? 0) * config.overtimePerHour);
                return (
                  <tr
                    key={day}
                    className={`border-t border-slate-200 text-sm dark:border-slate-700 ${
                      bonus > 0 ? 'bg-teal-50/70 dark:bg-teal-950/20' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                      {day.slice(8)}/{day.slice(5, 7)}
                    </td>
                    <td className="px-3 py-2">
                      {cell && cell.status === 'done' && cell.shift ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <select
                              className="input-3d !h-8 !w-40 !py-0 !px-2 text-xs"
                              disabled={busy}
                              value={dayShiftValue(cell)}
                              onChange={(e) => changeDay(day, e.target.value)}
                              aria-label={`Ca làm ngày ${day}`}
                            >
                              <option value="auto">Tự động ({cell.shift})</option>
                              {shifts.map((s) => (
                                <option key={s.startMinute} value={s.startMinute}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            {cell.alternative && (
                              <Warning size={16} weight="fill" className="shrink-0 text-amber-500" aria-hidden />
                            )}
                          </div>
                          {cell.alternative && (
                            <div className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              Chưa chắc ca. Nếu là ca {cell.alternative.shift}:{' '}
                              {cell.alternative.overtimeHours > 0
                                ? `tăng ca ${hoursText(cell.alternative.overtimeHours)}`
                                : 'không tăng ca'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {cell?.status === 'auto_out'
                            ? 'Quên quẹt ra'
                            : cell?.status === 'working' || cell?.status === 'missing_out'
                              ? 'Chưa quẹt ra'
                              : '—'}
                        </span>
                      )}
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">
                      {cell && cell.firstAt ? `${timeText(cell.firstAt)} – ${timeText(cell.lastAt)}` : '—'}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-semibold">
                      {cell ? cell.cong : '—'}
                      {cell && cell.lateMinutes > 0 && cell.status === 'done' && (
                        <span className="block text-[11px] font-normal text-red-600 dark:text-red-400">
                          muộn {cell.lateMinutes}p
                        </span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-semibold">
                      {commission > 0 ? `${money(commission)}đ` : '—'}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-bold text-teal-700 dark:text-teal-400">
                      {bonus > 0 ? `+${money(bonus)}đ` : '—'}
                    </td>
                    <td className="tnum px-3 py-2 text-right">
                      {cell && cell.overtimeHours > 0 ? (
                        <>
                          <span className="font-bold text-teal-700 dark:text-teal-400">
                            {hoursText(cell.overtimeHours)} · +{money(otPay)}đ
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            ở lại {cell.overtimeMinutes} phút
                          </span>
                        </>
                      ) : cell && cell.overtimeMinutes > 0 ? (
                        <span className="text-[11px] text-slate-400">
                          ở lại {cell.overtimeMinutes}p (chưa đủ 1 giờ)
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Tăng ca tính từ giờ kết thúc ca khi ở lại từ 1 tiếng, theo mốc 0,5 giờ (1g15 → 1 giờ, 1g45 → 2 giờ), tối đa 3 giờ/ngày.
        Ngày có dấu <Warning size={12} weight="fill" className="inline text-amber-500" /> là ngày hệ thống chưa chắc ca:
        chọn lại ca ở cột Ca (hoặc đặt ca mặc định cho nhân viên) để tính đúng tăng ca. Sau khi đổi ca, bấm
        &ldquo;Điền công từ chấm công&rdquo; ở bảng lương nếu muốn cập nhật số công.
      </p>
    </Modal>
  );
}
