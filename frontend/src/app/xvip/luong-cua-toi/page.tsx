'use client';

import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Lock } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { useAttendanceMonth } from '@/features/attendance/hooks';
import { computePayroll, monthLateMinutes, monthOvertimeHours } from '@/features/payroll/calc';
import { useMyPayroll } from '@/features/payroll/hooks';
import { money } from '@/features/xvip/data';
import { Card, PageTitle } from '@/features/xvip/ui';

const vnd = (n: number) => `${n < 0 ? '-' : ''}${money(Math.abs(n))}đ`;
const num = (n: number) => String(n).replace('.', ',');

function Line({ label, note, value, tone }: { label: string; note?: string; value: string; tone?: 'plus' | 'minus' }) {
  const color =
    tone === 'plus'
      ? 'text-teal-700 dark:text-teal-400'
      : tone === 'minus'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-900 dark:text-white';
  return (
    <div className="flex items-start justify-between gap-3 border-t border-slate-100 py-3 first:border-t-0 dark:border-slate-800">
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</div>
        {note && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{note}</div>}
      </div>
      <div className={`tnum shrink-0 text-base font-black ${color}`}>{value}</div>
    </div>
  );
}

/** Nhân viên xem lương của chính mình: chỉ xem, mọi con số do hệ thống và Admin quyết định */
export default function MyPayrollPage() {
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const { data, isLoading, isError, error, refetch } = useMyPayroll(month);
  // Chấm công của chính mình (server đã lọc theo người đăng nhập): lấy công, phút muộn, giờ tăng ca
  const { data: att } = useAttendanceMonth(month);

  const me = data?.staff[0];
  const result = useMemo(() => {
    if (!data || !me) return null;
    const mine = att?.staff[0];
    return computePayroll({
      config: data.config,
      daysInMonth: data.daysInMonth,
      daily: me.daily,
      entry: { ...me.entry, workDays: mine ? Math.min(31, mine.totalCong) : null },
      lateMinutes: mine ? monthLateMinutes(mine.days) : 0,
      overtimeHours: mine ? monthOvertimeHours(mine.days) : 0,
    });
  }, [data, me, att]);

  const isCurrentMonth = month === getVnToday().slice(0, 7);

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Tháng trước"
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              aria-label="Chọn tháng"
              className="h-8 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Tháng sau"
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        }
      >
        Lương của tôi
      </PageTitle>

      {isError && (
        <Card>
          <p className="text-sm font-bold text-red-600">
            {error instanceof ApiError ? error.message : 'Không tải được lương.'}{' '}
            <button type="button" onClick={() => refetch()} className="underline">
              Thử lại
            </button>
          </p>
        </Card>
      )}

      {isLoading && <p className="p-8 text-center text-sm font-bold text-blue-600 animate-pulse">Đang tải lương...</p>}

      {data && !result && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có dữ liệu lương cho tài khoản của bạn.</p>
        </Card>
      )}

      {data && me && result && (
        <>
          <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Tổng lương {monthLabel(month).toLowerCase()}
              {isCurrentMonth ? ' (tạm tính đến hôm nay)' : ''}
            </div>
            <div className="tnum mt-1 text-3xl font-black text-emerald-700 dark:text-emerald-300">
              {vnd(result.total)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              <Lock size={12} weight="bold" />
              Chỉ xem. Có thắc mắc về lương, bạn liên hệ Admin.
            </div>
          </div>

          <Card title="Chi tiết cách tính">
            <Line
              label="Lương cứng"
              note={`${money(result.base)} ÷ ${result.standardDays} công chuẩn × ${num(result.workDays)} công thực tế${
                result.baseSource === 'top' ? ' (đạt mốc doanh số cao)' : ''
              }`}
              value={vnd(result.baseSalary)}
            />
            <Line
              label="Thưởng ngày"
              note={`${result.bonusDays.length} ngày đạt mốc`}
              value={`+${vnd(result.dailyBonus)}`}
              tone="plus"
            />
            <Line label="Thưởng tháng" value={`+${vnd(result.monthlyBonus)}`} tone="plus" />
            <Line label="Thưởng vượt mốc" value={`+${vnd(result.overBonus)}`} tone="plus" />
            <Line
              label="Tăng ca"
              note={result.overtimeHours > 0 ? `${num(result.overtimeHours)} giờ` : 'Không tăng ca'}
              value={`+${vnd(result.overtimePay)}`}
              tone="plus"
            />
            <Line
              label="Trừ vào muộn"
              note={result.lateMinutes > 0 ? `Muộn ${result.lateMinutes} phút` : 'Không đi muộn'}
              value={result.latePenalty > 0 ? `−${vnd(result.latePenalty)}` : vnd(0)}
              tone={result.latePenalty > 0 ? 'minus' : undefined}
            />
            <Line
              label="Bảo hiểm"
              value={result.insurance > 0 ? `−${vnd(result.insurance)}` : vnd(0)}
              tone={result.insurance > 0 ? 'minus' : undefined}
            />
            <div className="flex items-center justify-between border-t-2 border-slate-200 pt-3 dark:border-slate-700">
              <span className="text-sm font-black uppercase text-slate-700 dark:text-slate-200">Tổng lương</span>
              <span className="tnum text-lg font-black text-emerald-700 dark:text-emerald-400">{vnd(result.total)}</span>
            </div>
          </Card>

          <Card className="mt-5" title="Doanh số và công">
            <Line label="Doanh số (hoa hồng) cả tháng" note="Tính theo ngày vào sổ" value={vnd(result.commission)} />
            <Line
              label="Công thực tế"
              note={att ? 'Lấy từ máy chấm công' : 'Đang tải chấm công...'}
              value={`${num(result.workDays)} / ${result.standardDays}`}
            />
          </Card>
        </>
      )}
    </>
  );
}
