'use client';

import { Alert, Button, DatePicker, Skeleton } from 'antd';
import dayjs from 'dayjs';
import {
  ChatCircleDots,
  CurrencyCircleDollar,
  HandCoins,
  Percent,
  Ticket,
  type Icon,
} from '@phosphor-icons/react';
import { useKpi } from '@/features/orders/hooks';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { getVnToday } from '@/lib/time';

interface StatCardProps {
  label: string;
  value: string;
  note: string;
  icon: Icon;
  /** Màu nền nguyên khối của thẻ (viết đầy đủ class để Tailwind quét được) */
  color: string;
}

function StatCard({ label, value, note, icon: StatIcon, color }: StatCardProps) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 text-white ${color}`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/20">
        <StatIcon size={26} weight="fill" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-sm opacity-90">{label}</div>
        <div className="tnum truncate text-2xl font-bold">{value}</div>
        <div className="truncate text-xs opacity-90">{note}</div>
      </div>
    </div>
  );
}

/** Dải 5 thẻ thống kê của một ngày vào sổ (Admin: toàn công ty, nhân viên: của mình) */
export function DaySummary({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const today = getVnToday();
  const { data: kpi, isPending, isError, error, refetch } = useKpi(date);

  const smsRate = kpi && kpi.total > 0 ? Math.round((kpi.smsSent / kpi.total) * 100) : 0;

  return (
    <section aria-label="Thống kê theo ngày" className="mb-5">
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-sm text-ink-3">Chọn ngày:</span>
        <DatePicker
          allowClear={false}
          value={dayjs(date)}
          format="DD/MM/YYYY"
          disabledDate={(d) => d.isAfter(dayjs(today), 'day')}
          onChange={(d) => onDateChange(d.format('YYYY-MM-DD'))}
          aria-label="Chọn ngày thống kê"
        />
      </div>

      {isError ? (
        <Alert
          type="error"
          showIcon
          message={error instanceof ApiError ? error.message : 'Không tải được thống kê.'}
          action={
            <Button size="small" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : isPending || !kpi ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Tổng vé"
            value={String(kpi.total)}
            note={`${kpi.seats} ghế`}
            icon={Ticket}
            color="bg-blue-600"
          />
          <StatCard
            label="Tổng tiền vé"
            value={formatVND(kpi.revenue ?? 0)}
            note="Giá bán trong ngày"
            icon={CurrencyCircleDollar}
            color="bg-green-600"
          />
          <StatCard
            label="Tổng hoa hồng"
            value={formatVND(kpi.commission)}
            note="Nhập tay trên từng vé"
            icon={Percent}
            color="bg-orange-500"
          />
          <StatCard
            label="Đã cọc / Nhờ thu"
            value={formatVND(kpi.deposit)}
            note={`Nhờ thu: ${formatVND(kpi.collectOnDelivery)}`}
            icon={HandCoins}
            color="bg-purple-600"
          />
          <StatCard
            label="Đã gửi SMS / Zalo"
            value={`${kpi.smsSent} / ${kpi.total}`}
            note={kpi.total > 0 ? `${smsRate}% tổng vé` : 'Chưa có vé'}
            icon={ChatCircleDots}
            color="bg-rose-500"
          />
        </div>
      )}
    </section>
  );
}
