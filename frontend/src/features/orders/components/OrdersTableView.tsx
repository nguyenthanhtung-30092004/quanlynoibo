'use client';

import { CheckCircle, Ticket as TicketIcon } from '@phosphor-icons/react';
import { Card, NUM, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { ScrollTable } from '@/features/xvip/ScrollTable';
import { Pagination } from '@/features/xvip/Pagination';
import {
  ThCommission,
  ThCustomerName,
  ThDepartureTime,
  ThDeposit,
  ThOrderCode,
  ThPartner,
  ThPhone,
  ThRoute,
  ThSellPrice,
  ThSms,
  ThStaff,
} from '@/features/xvip/OrderColumnFilters';
import type { Order, OrderFilters } from '../types';

const TH_CELL = TH;
const TD_CELL = TD;

interface OrdersTableViewProps {
  ordersList: Order[];
  totalOrders: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  isAdmin: boolean;
  localFilters: OrderFilters;
  filters: OrderFilters;
  onFilterChange: (patch: Partial<OrderFilters>) => void;
  onPageChange: (page: number) => void;
  onSelectOrder: (order: Order) => void;
  onOpenCreate: () => void;
}

export function OrdersTableView({
  ordersList,
  totalOrders,
  currentPage,
  pageSize,
  isLoading,
  isAdmin,
  localFilters,
  filters,
  onFilterChange,
  onPageChange,
  onSelectOrder,
  onOpenCreate,
}: OrdersTableViewProps) {
  const colProps = {
    local: localFilters,
    filters,
    onChange: onFilterChange,
  };

  return (
    <Card className="mt-5 overflow-clip !p-0">
      <ScrollTable>
        <table className="w-full">
          <thead>
            <tr>
              <th className={`${TH_CELL} w-12 text-center`}>STT</th>
              <ThOrderCode {...colProps} />
              <ThDepartureTime {...colProps} />
              <ThPartner {...colProps} />
              <ThRoute {...colProps} />
              <ThCustomerName {...colProps} />
              <ThPhone {...colProps} />
              <ThSellPrice {...colProps} />
              <ThDeposit {...colProps} />
              <ThCommission {...colProps} />
              <ThStaff showFilter={isAdmin} {...colProps} />
              <ThSms {...colProps} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                >
                  Đang tải danh sách vé từ cơ sở dữ liệu...
                </td>
              </tr>
            ) : ordersList.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <TicketIcon size={36} className="text-slate-400" />
                    <span>Chưa có đơn vé nào trong hệ thống.</span>
                    <button
                      type="button"
                      onClick={onOpenCreate}
                      className="btn-3d btn-3d-blue px-4 py-2 text-xs"
                    >
                      + Tạo đơn vé đầu tiên
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              ordersList.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => onSelectOrder(t)}
                  title="Bấm để xem chi tiết"
                  className={`group cursor-pointer hover:bg-blue-50/70 dark:hover:bg-slate-800/80 transition-colors ${
                    t.cancelledAt
                      ? 'order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20'
                      : ''
                  }`}
                >
                  {/* 1. STT (Sticky Left) */}
                  <td
                    className={`${TD_CELL} text-center font-semibold text-slate-500 dark:text-slate-400`}
                  >
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>

                  {/* 2. Mã đơn */}
                  <td className={`${TD_CELL} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                    {formatOrderCode(t.id)}
                    {t.cancelledAt && (
                      <span className="cancel-badge mt-1 block w-fit rounded-md bg-rose-100 px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        Đã hủy
                      </span>
                    )}
                  </td>

                  {/* 3. Giờ xe */}
                  <td className={`${TD_CELL} font-bold text-blue-700 dark:text-blue-400`}>
                    {t.departureTime}
                    <span className="mt-0.5 block text-[13px] font-bold text-slate-800 dark:text-slate-200">
                      {formatDateVN(t.departureDate)}
                    </span>
                  </td>

                  {/* 4. Nhà xe */}
                  <td className={`${TD_CELL} font-bold text-slate-800 dark:text-slate-200`}>
                    {t.partner || 'XVIP'}
                  </td>

                  {/* 5. Tuyến đường */}
                  <td className={`${TD_CELL} font-semibold text-slate-700 dark:text-slate-300`}>
                    {t.route?.name || 'Tuyến liên tỉnh'}
                  </td>

                  {/* 6. Khách hàng */}
                  <td className={`${TD_CELL} w-56 min-w-56 max-w-56 !whitespace-normal [overflow-wrap:anywhere] font-bold text-slate-900 dark:text-white`}>
                    {t.customerName || 'Khách lẻ'}
                  </td>

                  {/* 7. Số điện thoại */}
                  <td className={`${TD_CELL} tnum font-semibold text-slate-600 dark:text-slate-300`}>
                    {t.phone}
                  </td>

                  {/* 8. Giá bán */}
                  <td className={`${TD_CELL} ${NUM} text-slate-900 dark:text-white`}>
                    {money(t.sellPrice)}đ
                  </td>

                  {/* 9. Đã cọc */}
                  <td className={`${TD_CELL} ${NUM} font-bold text-slate-800 dark:text-slate-300`}>
                    {money(t.deposit)}đ
                  </td>

                  {/* 10. Hoa hồng */}
                  <td className={`${TD_CELL} ${NUM} font-black text-red-600 dark:text-red-400`}>
                    {money(t.commission)}đ
                  </td>

                  {/* 10. NV tạo */}
                  <td className={`${TD_CELL} text-slate-800 dark:text-slate-300 font-semibold`}>
                    {t.staff?.fullName || 'NV'}
                  </td>

                  {/* 11. Tin nhắn */}
                  <td className={TD_CELL}>
                    {t.smsSent ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle
                          size={16}
                          weight="fill"
                          className="text-emerald-600 shrink-0"
                        />
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {t.messageChannel === 'ZALO'
                            ? 'Đã gửi Zalo'
                            : 'Đã gửi SMS'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                        Chưa gửi
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollTable>
      {!isLoading && totalOrders > pageSize && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={totalOrders}
          onChange={onPageChange}
        />
      )}
    </Card>
  );
}
