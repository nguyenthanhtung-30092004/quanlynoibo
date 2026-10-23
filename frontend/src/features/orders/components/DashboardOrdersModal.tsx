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
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(o)}
                    className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-extrabold text-slate-900 dark:text-white">
                        <span className="tnum text-blue-700 dark:text-blue-400">{formatOrderCode(o.id)}</span>
                        {' · '}
                        {o.customerName || 'Khách lẻ'}
                        <span className="tnum font-semibold text-slate-500 dark:text-slate-400"> · {o.phone}</span>
                      </div>
                      <div className="mt-0.5 break-words text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {showRoute && o.route?.name && <span>{o.route.name} · </span>}
                        <span className="tnum">
                          {o.departureTime} - {formatDateVN(o.departureDate)}
                        </span>
                        {showStaff && o.staff?.fullName && <span> · NV {o.staff.fullName}</span>}
                        {o.partner && <span> · {o.partner}</span>}
                      </div>
                    </div>
                    <div className="tnum flex shrink-0 items-center justify-between gap-3 text-xs font-bold sm:justify-end">
                      <span className="text-slate-600 dark:text-slate-300">{quantityText(o)}</span>
                      <span className="text-slate-900 dark:text-white sm:w-24 sm:text-right">{money(o.sellPrice)}đ</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-400 sm:w-20 sm:text-right">
                        {money(o.commission)}đ
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">
              Mỗi dòng: số vé · giá bán · hoa hồng. Bấm vào một vé để xem chi tiết.
            </p>
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
