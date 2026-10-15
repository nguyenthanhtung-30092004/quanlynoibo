'use client';

import { useState } from 'react';
import { Modal } from '@/features/xvip/Modal';
import { formatOrderCode } from '@/lib/format';
import type { Order } from '../types';

/** Lý do hủy hay gặp, bấm để điền nhanh vào ô lý do */
export const CANCEL_REASONS = [
  'Khách không đi nữa',
  'Khách đổi giờ / ngày',
  'Nhập nhầm vé',
  'Nhà xe hết chỗ',
  'Khách không liên lạc được',
];

interface CancelOrderModalProps {
  order: Order;
  onClose: () => void;
  onConfirm: (orderId: number, reason: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function CancelOrderModal({
  order,
  onClose,
  onConfirm,
  isSubmitting = false,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Vui lòng chọn hoặc nhập lý do hủy vé.');
      return;
    }
    await onConfirm(order.id, reason.trim());
  };

  return (
    <Modal title="Hủy vé" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Hủy vé{' '}
          <strong className="text-slate-900 dark:text-white">
            {formatOrderCode(order.id)}
          </strong>{' '}
          của khách{' '}
          <strong className="text-slate-900 dark:text-white">
            {order.customerName || order.phone}
          </strong>
        </p>
        <div>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Lý do hủy <span className="text-red-500">*</span>
          </span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  setError('');
                }}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  reason === r
                    ? 'border-rose-400 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className={`input-3d min-h-[5rem] resize-y p-3 ${error ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            maxLength={500}
            placeholder="Chọn nhanh ở trên hoặc nhập lý do hủy..."
            aria-invalid={!!error}
            autoFocus
          />
          {error && (
            <span
              role="alert"
              className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-white px-4 py-2 text-sm"
          >
            Giữ vé
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-3d btn-3d-red px-5 py-2 text-sm"
          >
            {isSubmitting ? 'Đang hủy...' : 'Xác nhận hủy vé'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
