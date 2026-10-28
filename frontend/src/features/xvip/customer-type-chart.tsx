'use client';

import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { Kpi } from '@/features/orders/types';

export const REGULAR_COLOR = '#2563eb';
export const NEW_COLOR = '#f59e0b';

const fmt = (n: number) => n.toLocaleString('vi-VN');

/** Số đơn và doanh số (hoa hồng) của khách quen / khách lạ trên một tuyến (đã gộp hai chiều) */
export interface CustomerRouteShare {
  name: string;
  regularOrders: number;
  newOrders: number;
  regularSeats: number;
  newSeats: number;
  regularCommission: number;
  newCommission: number;
}

/**
 * Tỷ lệ khách quen và khách lạ trong khoảng ngày đang lọc, tính theo số điện thoại (mỗi số là một khách).
 * Khách quen là số điện thoại có từ `minOrders` đơn trở lên (đếm trên toàn bộ lịch sử).
 */
export function CustomerTypeChart({
  data,
  routes = [],
}: {
  data: Kpi['byCustomerType'];
  /** Các tuyến, để bấm vào nhóm khách nào thì xem nhóm đó đặt tuyến nào nhiều */
  routes?: CustomerRouteShare[];
}) {
  const [open, setOpen] = useState<'regular' | 'new' | null>(null);
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
        {rows.map((r) => {
          const isOpen = open === r.key;
          // Các tuyến mà nhóm này đặt, nhiều đơn nhất trước; % tính trên số đơn của chính nhóm (đơn có số điện thoại)
          const groupRoutes = routes
            .map((x) => ({
              name: x.name,
              orders: r.key === 'regular' ? x.regularOrders : x.newOrders,
              seats: r.key === 'regular' ? x.regularSeats : x.newSeats,
              commission: r.key === 'regular' ? x.regularCommission : x.newCommission,
            }))
            .filter((x) => x.orders > 0)
            .sort((a, b) => b.orders - a.orders);
          const groupTotal = groupRoutes.reduce((sum, x) => sum + x.orders, 0);
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : (r.key as 'regular' | 'new'))}
                aria-expanded={isOpen}
                title={`Bấm để xem ${r.label.toLowerCase()} đặt những tuyến nào`}
                className="flex w-full items-start gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
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
                <CaretDown
                  size={14}
                  weight="bold"
                  className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-1 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {r.label} đặt tuyến nào (% theo số đơn)
                  </div>
                  {groupRoutes.length === 0 ? (
                    <div className="py-2 text-center text-[11px] font-semibold text-slate-400">Chưa có đơn nào.</div>
                  ) : (
                    <ul className="space-y-2.5">
                      {groupRoutes.map((x) => {
                        const pct = (x.orders / groupTotal) * 100;
                        return (
                          <li key={x.name}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-200">{x.name}</span>
                              <span className="tnum shrink-0 text-sm font-black" style={{ color: r.color }}>
                                {pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                            </div>
                            <div className="tnum mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {fmt(x.orders)} đơn · {fmt(x.seats)} vé · DS {fmt(x.commission)}đ
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        Tính theo số điện thoại, vé đã hủy không tính. Khách quen đóng góp{' '}
        <b className="tnum text-slate-600 dark:text-slate-300">
          {Math.round((data.regular.orders / Math.max(1, totalOrders)) * 100)}%
        </b>{' '}
        số đơn có số điện thoại. Bấm vào từng nhóm để xem nhóm đó đặt tuyến nào.
      </p>
    </div>
  );
}
