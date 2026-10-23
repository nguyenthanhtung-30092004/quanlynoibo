'use client';

import { useMemo, useState } from 'react';
import { money } from '@/features/xvip/data';
import { Modal } from '@/features/xvip/Modal';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { useOrders } from '../hooks';
import type { Order, OrderFilters } from '../types';
import { OrderDetailModal } from './OrderDetailModal';

/** Số vé tối đa tải một lần (bằng giới hạn của API) */
const MAX_ROWS = 1000;

/** Số lượng hiển thị của một đơn: vé, xe hoặc hàng tùy loại hình */
function quantityText(o: Order): string {
  if (o.tickets > 0) return `${o.tickets} vé`;
  if (o.vehicleCount > 0) return `${o.vehicleCount} xe`;
  if (o.goods) return 'Gửi hàng';
  return '';
}

/**
 * Danh sách toàn bộ vé của một tuyến hoặc một nhân viên trên dashboard, theo đúng khoảng ngày đang lọc.
 * `filters` chỉ cần chứa phần lọc tuyến / nhân viên và khoảng ngày; bấm một vé để xem chi tiết (chỉ xem).
 */
export function DashboardOrdersModal({
  title,
  filters,
  showRoute,
  showStaff,
  onClose,
}: {
  title: string;
  filters: Omit<OrderFilters, 'page' | 'pageSize' | 'search' | 'activeOnly'>;
  /** Hiện tên tuyến trên từng vé (dùng khi xem theo nhân viên) */
  showRoute?: boolean;
  /** Hiện tên nhân viên trên từng vé (dùng khi xem theo tuyến) */
  showStaff?: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Order | null>(null);
  const { data, isLoading, isError } = useOrders({
    ...filters,
    search: '',
    activeOnly: true,
    page: 1,
    pageSize: MAX_ROWS,
  });

  const orders = useMemo(() => data?.data ?? [], [data]);
  const totals = useMemo(
    () => ({
      tickets: orders.reduce((sum, o) => sum + (o.tickets || 0), 0),
      sell: orders.reduce((sum, o) => sum + (o.sellPrice || 0), 0),
      commission: orders.reduce((sum, o) => sum + (o.commission || 0), 0),
    }),
    [orders],
  );
  const total = data?.total ?? orders.length;

  return (
    <>
      {/* Đang xem chi tiết một vé thì Esc chỉ đóng chi tiết, không đóng luôn danh sách */}
      <Modal title={title} size="xl" onClose={() => !detail && onClose()}>
        {isLoading ? (
          <div className="py-10 text-center text-sm font-bold text-slate-400">Đang tải danh sách vé...</div>
        ) : isError ? (
          <div className="py-10 text-center text-sm font-bold text-rose-600">Không tải được danh sách vé.</div>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center text-sm font-bold text-slate-400">
            Không có vé nào trong khoảng thời gian đã chọn.
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary label="Số đơn" value={total.toLocaleString('vi-VN')} />
              <Summary label="Số vé" value={totals.tickets.toLocaleString('vi-VN')} />
              <Summary label="Doanh thu" value={`${money(totals.sell)}đ`} />
              <Summary label="Hoa hồng" value={`${money(totals.commission)}đ`} tone="green" />
            </div>
            {total > orders.length && (
              <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                Chỉ hiển thị {orders.length.toLocaleString('vi-VN')} đơn đầu trong tổng {total.toLocaleString('vi-VN')} đơn.
                Hãy thu hẹp khoảng ngày để xem đủ.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <th className="px-3 py-2">Mã vé</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    {showRoute && <th className="px-3 py-2">Tuyến</th>}
                    {showStaff && <th className="px-3 py-2">Nhân viên</th>}
                    <th className="px-3 py-2">Giờ đi</th>
                    <th className="px-3 py-2">Đối tác</th>
                    <th className="px-3 py-2 text-right">Số vé</th>
                    <th className="px-3 py-2 text-right">Giá bán</th>
                    <th className="px-3 py-2 text-right">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      tabIndex={0}
                      onClick={() => setDetail(o)}
                      onKeyDown={(e) => e.key === 'Enter' && setDetail(o)}
                      className="cursor-pointer align-top transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:outline-none dark:hover:bg-slate-800/60 dark:focus:bg-slate-800/60"
                    >
                      <td className="tnum whitespace-nowrap px-3 py-2 font-extrabold text-blue-700 dark:text-blue-400">
                        {formatOrderCode(o.id)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900 dark:text-white">{o.customerName || 'Khách lẻ'}</div>
                        <div className="tnum font-semibold text-slate-500 dark:text-slate-400">{o.phone}</div>
                      </td>
                      {showRoute && (
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{o.route?.name ?? '—'}</td>
                      )}
                      {showStaff && (
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                          {o.staff?.fullName ?? '—'}
                        </td>
                      )}
                      <td className="tnum whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                        <div>{o.departureTime}</div>
                        <div className="text-slate-500 dark:text-slate-400">{formatDateVN(o.departureDate)}</div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{o.partner || '—'}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                        {quantityText(o) || '—'}
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                        {money(o.sellPrice)}đ
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right font-black text-emerald-700 dark:text-emerald-400">
                        {money(o.commission)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">Bấm vào một dòng để xem chi tiết vé.</p>
          </>
        )}
      </Modal>
      {detail && <OrderDetailModal order={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'green' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={`tnum text-sm font-black ${
          tone === 'green' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
