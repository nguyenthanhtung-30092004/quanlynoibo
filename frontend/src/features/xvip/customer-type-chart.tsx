import type { Kpi } from '@/features/orders/types';

export const REGULAR_COLOR = '#2563eb';
export const NEW_COLOR = '#f59e0b';

const fmt = (n: number) => n.toLocaleString('vi-VN');

/**
 * Tỷ lệ khách quen và khách lạ trong khoảng ngày đang lọc, tính theo số điện thoại (mỗi số là một khách).
 * Khách quen là số điện thoại có từ `minOrders` đơn trở lên (đếm trên toàn bộ lịch sử).
 */
export function CustomerTypeChart({ data }: { data: Kpi['byCustomerType'] }) {
  const customers = (data?.regular.customers ?? 0) + (data?.new.customers ?? 0);
  if (!data || customers === 0) {
    return (
      <div className="py-8 text-center text-xs font-bold text-slate-400">
        Chưa có khách nào trong khoảng thời gian đã chọn.
      </div>
    );
  }

  const regularPct = (data.regular.customers / customers) * 100;
  const gradient = `conic-gradient(${REGULAR_COLOR} 0% ${regularPct}%, ${NEW_COLOR} ${regularPct}% 100%)`;
  const rows = [
    { key: 'regular', label: 'Khách quen', note: `từ ${data.minOrders} đơn trở lên`, color: REGULAR_COLOR, ...data.regular },
    { key: 'new', label: 'Khách lạ', note: `dưới ${data.minOrders} đơn`, color: NEW_COLOR, ...data.new },
  ];
  const totalOrders = data.regular.orders + data.new.orders;

  return (
    <div className="flex flex-col items-center gap-6 pt-2">
      <div
        className="relative size-40 rounded-full border border-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.3)] dark:border-slate-700"
        style={{ background: gradient }}
        role="img"
        aria-label={`Khách quen ${Math.round(regularPct)}%, khách lạ ${100 - Math.round(regularPct)}%`}
      >
        <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full border border-slate-100 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900">
          <span className="tnum text-xl font-black text-slate-900 dark:text-white">{fmt(customers)}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Khách
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-2.5 p-1">
            <span className="mt-0.5 size-3 shrink-0 rounded-full shadow-sm" style={{ background: r.color }} />
            <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-3">
              <div>
                {r.label}
                <span className="ml-1 font-medium text-slate-400">({r.note})</span>
              </div>
              <div className="tnum font-bold text-slate-900 dark:text-white sm:shrink-0">
                {fmt(r.customers)} khách · {fmt(r.orders)} đơn ({Math.round((r.customers / customers) * 100)}%)
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        Tính theo số điện thoại, vé đã hủy không tính. Khách quen đóng góp{' '}
        <b className="tnum text-slate-600 dark:text-slate-300">
          {Math.round((data.regular.orders / Math.max(1, totalOrders)) * 100)}%
        </b>{' '}
        số đơn có số điện thoại.
      </p>
    </div>
  );
}
