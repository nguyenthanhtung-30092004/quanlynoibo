'use client';

import { ArrowRight, ClockCounterClockwise, PaperPlaneTilt, PencilSimple, PlusCircle, XCircle } from '@phosphor-icons/react';
import { Modal } from '@/features/xvip/Modal';
import { money } from '@/features/xvip/data';
import { formatDateVN } from '@/lib/format';
import { useOrderHistory } from '../hooks';
import type { OrderHistoryAction } from '../types';

const MONEY_FIELDS = new Set(['sellPrice', 'costPrice', 'deposit', 'collectOnDelivery', 'commission']);

const ACTIONS: Record<OrderHistoryAction, { label: string; icon: typeof PencilSimple; color: string }> = {
  CREATE: { label: 'Tạo đơn', icon: PlusCircle, color: 'bg-emerald-600 shadow-[0_2px_0_#065f46]' },
  UPDATE: { label: 'Cập nhật', icon: PencilSimple, color: 'bg-amber-500 shadow-[0_2px_0_#b45309]' },
  CANCEL: { label: 'Hủy vé', icon: XCircle, color: 'bg-rose-600 shadow-[0_2px_0_#9f1239]' },
  SEND_MESSAGE: { label: 'Gửi tin', icon: PaperPlaneTilt, color: 'bg-blue-600 shadow-[0_2px_0_#1e3a8a]' },
};

function fmt(field: string, value: string | number | null): string {
  if (value === null || value === '') return '(trống)';
  if (MONEY_FIELDS.has(field)) return `${money(Number(value))}đ`;
  if (field === 'departureDate') return formatDateVN(String(value));
  return String(value);
}

/** ISO -> 'HH:mm DD/MM/YYYY' theo giờ Việt Nam */
function formatFull(iso: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ngày ${get('day')}/${get('month')}/${get('year')}`;
}

export function OrderHistoryModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data, isLoading, isError } = useOrderHistory(orderId);

  return (
    <Modal title={`Lịch sử đơn #${orderId}`} onClose={onClose}>
      {isLoading ? (
        <p className="py-6 text-center text-sm font-bold text-blue-600 animate-pulse">Đang tải lịch sử...</p>
      ) : isError ? (
        <p className="py-6 text-center text-sm font-semibold text-red-600">Không tải được lịch sử đơn.</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
          <ClockCounterClockwise size={36} />
          <p className="text-sm font-semibold">Đơn này chưa có lịch sử thao tác.</p>
          <p className="text-xs">Các đơn tạo trước khi có tính năng lịch sử sẽ bắt đầu ghi từ lần sửa tiếp theo.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
          {data.map((h) => {
            const a = ACTIONS[h.action] ?? ACTIONS.UPDATE;
            const Icon = a.icon;
            return (
              <li key={h.id} className="relative">
                <span
                  className={`absolute -left-[2.15rem] top-0 flex size-7 items-center justify-center rounded-full text-white ${a.color}`}
                >
                  <Icon size={15} weight="bold" />
                </span>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {a.label} <span className="font-semibold text-slate-500 dark:text-slate-400">bởi</span> {h.actorName || 'Không rõ'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formatFull(h.createdAt)}</span>
                  </div>
                  {h.summary && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{h.summary}</p>}
                  {h.changes && h.changes.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {h.changes.map((c) => (
                        <li key={c.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{c.label}:</span>
                          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-rose-800 line-through decoration-rose-400 dark:bg-rose-950 dark:text-rose-300">
                            {fmt(c.field, c.from)}
                          </span>
                          <ArrowRight size={14} weight="bold" className="text-slate-400" />
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {fmt(c.field, c.to)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
