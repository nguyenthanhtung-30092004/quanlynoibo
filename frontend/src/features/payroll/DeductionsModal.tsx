'use client';

import { Plus, Trash } from '@phosphor-icons/react';
import { monthLabel } from '@/lib/month';
import { Modal } from '@/features/xvip/Modal';
import { money } from '@/features/xvip/data';
import { MoneyInput } from './MoneyInput';
import type { PayrollDeduction } from './types';

/** Khớp giới hạn ở backend (`MAX_DEDUCTIONS`) */
const MAX_ROWS = 30;

interface DeductionsModalProps {
  staffName: string;
  month: string;
  deductions: PayrollDeduction[];
  /** Mỗi lần sửa gọi ngay; Admin bấm "Lưu bảng lương" ở trang để giữ lại */
  onChange: (deductions: PayrollDeduction[]) => void;
  onClose: () => void;
}

/**
 * Danh sách khoản trừ do lỗi của một nhân viên trong tháng: mỗi dòng một số tiền và một lý do.
 * Lý do không bắt buộc (Admin có thể sửa lại sau); dòng số tiền 0 sẽ bị bỏ khi lưu.
 */
export function DeductionsModal({ staffName, month, deductions, onChange, onClose }: DeductionsModalProps) {
  const total = deductions.reduce((sum, d) => sum + d.amount, 0);

  const patch = (index: number, change: Partial<PayrollDeduction>) =>
    onChange(deductions.map((d, i) => (i === index ? { ...d, ...change } : d)));

  return (
    <Modal title={`Khoản trừ do lỗi - ${staffName}`} onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {monthLabel(month)}. Mỗi khoản ghi số tiền bị trừ và lý do. Nhân viên sẽ thấy lý do này ở trang lương của mình.
      </p>

      {deductions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tháng này chưa có khoản trừ nào.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {deductions.map((d, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[9rem_1fr]">
                <MoneyInput
                  align="right"
                  ariaLabel={`Số tiền trừ khoản ${i + 1}`}
                  className="!h-10 !w-full !px-2 !text-base"
                  value={d.amount}
                  onChange={(amount) => patch(i, { amount })}
                />
                <input
                  className="input-3d !h-10 !w-full !px-2 !text-base"
                  aria-label={`Lý do trừ khoản ${i + 1}`}
                  placeholder="Trừ vì..."
                  maxLength={200}
                  value={d.reason}
                  onChange={(e) => patch(i, { reason: e.target.value })}
                />
              </div>
              <button
                type="button"
                aria-label={`Xóa khoản trừ ${i + 1}`}
                onClick={() => onChange(deductions.filter((_, idx) => idx !== i))}
                className="btn-3d-mini mt-1 shrink-0 text-red-600"
              >
                <Trash size={16} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={deductions.length >= MAX_ROWS}
          onClick={() => onChange([...deductions, { amount: 0, reason: '' }])}
          className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-40"
        >
          <Plus size={16} weight="bold" /> Thêm khoản trừ
        </button>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
          Tổng trừ: <span className="tnum text-red-600 dark:text-red-400">−{money(total)}đ</span>
        </span>
      </div>
    </Modal>
  );
}
