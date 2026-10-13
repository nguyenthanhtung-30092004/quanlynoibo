'use client';

import type { ReactNode } from 'react';
import { money } from '@/features/xvip/data';
import { Modal } from '@/features/xvip/Modal';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import type { Order } from '../types';

/** Nhóm các dòng thông tin trong hộp chi tiết đơn */
function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-400">
        {title}
      </h3>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
        {children}
      </dl>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 px-3 py-2 text-sm">
      <dt className="w-32 shrink-0 font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-bold text-slate-900 dark:text-white">
        {value || '—'}
      </dd>
    </div>
  );
}

/** Hộp chi tiết một đơn vé; truyền `onEdit` thì hiện thêm nút "Sửa vé" cho đơn chưa hủy */
export function OrderDetailModal({
  order,
  onClose,
  onEdit,
}: {
  order: Order;
  onClose: () => void;
  onEdit?: (order: Order) => void;
}) {
  return (
    <Modal title={`Chi tiết đơn ${formatOrderCode(order.id)}`} onClose={onClose}>
      <div className="space-y-4">
        {order.cancelledAt && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <p>Đơn đã hủy lúc {formatDateVN(order.cancelledAt)}</p>
            {order.cancelReason && <p className="mt-0.5 font-semibold">Lý do: {order.cancelReason}</p>}
          </div>
        )}
        <DetailGroup title="Khách hàng">
          <DetailRow label="Tên" value={order.customerName || 'Khách lẻ'} />
          <DetailRow label="Số điện thoại" value={order.phone} />
          <DetailRow label="Nhân viên tạo" value={order.staff?.fullName} />
        </DetailGroup>
        <DetailGroup title="Chuyến đi">
          <DetailRow label="Tuyến" value={order.route?.name} />
          <DetailRow
            label="Giờ đi"
            value={`${order.departureTime} - ${formatDateVN(order.departureDate)}`}
          />
          <DetailRow label="Nhà xe" value={order.partner || 'XVIP'} />
          <DetailRow label="Loại hình" value={order.vehicleType} />
          <DetailRow label="Điểm đón" value={order.pickupPoint} />
          <DetailRow label="Điểm trả" value={order.dropoffPoint} />
          <DetailRow
            label="Số ghế"
            value={[
              order.seatCount > 0 && `${order.seatCount} ghế`,
              order.seatFront > 0 && `${order.seatFront} đầu`,
              order.seatMiddle > 0 && `${order.seatMiddle} giữa`,
              order.seatBack > 0 && `${order.seatBack} cuối`,
            ]
              .filter(Boolean)
              .join(', ')}
          />
        </DetailGroup>
        <DetailGroup title="Giá tiền">
          <DetailRow label="Giá nhập" value={`${money(order.costPrice)}đ`} />
          <DetailRow label="Giá bán" value={`${money(order.sellPrice)}đ`} />
          <DetailRow label="Đã cọc" value={`${money(order.deposit)}đ`} />
          <DetailRow label="Nhờ thu" value={`${money(order.collectOnDelivery)}đ`} />
          <DetailRow label="Hoa hồng" value={`${money(order.commission)}đ`} />
        </DetailGroup>
        <DetailGroup title="Khác">
          <DetailRow
            label="Tin nhắn"
            value={
              order.smsSent
                ? order.messageChannel === 'ZALO'
                  ? 'Đã gửi Zalo'
                  : 'Đã gửi SMS'
                : 'Chưa gửi'
            }
          />
          <DetailRow label="Ghi chú" value={order.note} />
        </DetailGroup>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {onEdit && !order.cancelledAt && (
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="btn-3d btn-3d-amber px-4 py-2 text-sm"
            >
              Sửa vé
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-3d btn-3d-white px-4 py-2 text-sm">
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
