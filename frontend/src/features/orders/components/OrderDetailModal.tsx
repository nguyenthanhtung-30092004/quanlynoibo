'use client';

import type { ReactNode } from 'react';
import { money } from '@/features/xvip/data';
import { Modal } from '@/features/xvip/Modal';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { CABIN_LABELS, type Order } from '../types';

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

/** Hộp chi tiết một đơn vé; truyền các callback thì hiện nút thao tác tương ứng (sửa/hủy chỉ với đơn chưa hủy) */
export function OrderDetailModal({
  order,
  onClose,
  onEdit,
  onRebook,
  onHistory,
  onCancel,
  onDelete,
}: {
  order: Order;
  onClose: () => void;
  onEdit?: (order: Order) => void;
  onRebook?: (order: Order) => void;
  onHistory?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onDelete?: (order: Order) => void;
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
          {order.cabinLines?.map((l) => (
            <DetailRow
              key={l.kind}
              label={CABIN_LABELS[l.kind]}
              value={`${l.quantity} cabin - nhập ${money(l.costPrice)}đ - bán ${money(l.sellPrice)}đ / cabin`}
            />
          ))}
          <DetailRow label="Điểm đón" value={order.pickupPoint} />
          <DetailRow label="Điểm trả" value={order.dropoffPoint} />
          <DetailRow
            label={order.vehicleCount > 0 ? 'Số xe' : 'Số ghế'}
            value={[
              order.vehicleCount > 0 && `${order.vehicleCount} xe`,
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
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {onRebook && (
            <button
              type="button"
              onClick={() => onRebook(order)}
              className="btn-3d btn-3d-green px-4 py-2 text-sm"
            >
              Đặt lại
            </button>
          )}
          {onHistory && (
            <button
              type="button"
              onClick={() => onHistory(order)}
              className="btn-3d btn-3d-white px-4 py-2 text-sm"
            >
              Lịch sử
            </button>
          )}
          {onEdit && !order.cancelledAt && (
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="btn-3d btn-3d-amber px-4 py-2 text-sm"
            >
              Sửa vé
            </button>
          )}
          {onCancel && !order.cancelledAt && (
            <button
              type="button"
              onClick={() => onCancel(order)}
              className="btn-3d btn-3d-red px-4 py-2 text-sm"
            >
              Hủy vé
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(order)}
              className="btn-3d btn-3d-red px-4 py-2 text-sm"
            >
              Xóa vé
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
