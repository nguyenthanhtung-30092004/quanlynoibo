'use client';

import { Modal } from '@/features/xvip/Modal';
import { formatOrderCode } from '@/lib/format';
import type { Order } from '../types';

interface DeleteOrderModalProps {
  order: Order;
  onClose: () => void;
  onConfirm: (orderId: number) => Promise<void>;
  isSubmitting?: boolean;
}

export function DeleteOrderModal({
  order,
  onClose,
  onConfirm,
  isSubmitting = false,
}: DeleteOrderModalProps) {
  return (
    <Modal title="Xác nhận xóa vé" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Bạn có chắc chắn muốn xóa đơn vé{' '}
          <strong className="text-slate-900 dark:text-white">
            {formatOrderCode(order.id)}
          </strong>{' '}
          của khách hàng{' '}
          <strong className="text-slate-900 dark:text-white">
            {order.customerName || order.phone}
          </strong>{' '}
          không?
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-white px-4 py-2 text-sm"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onConfirm(order.id)}
            disabled={isSubmitting}
            className="btn-3d btn-3d-red px-5 py-2 text-sm"
          >
            {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
