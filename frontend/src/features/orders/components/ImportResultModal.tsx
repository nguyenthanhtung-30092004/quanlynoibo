'use client';

import { useState } from 'react';
import { Modal } from '@/features/xvip/Modal';
import type { ImportResult } from '../types';

interface ImportResultModalProps {
  result: ImportResult;
  onClose: () => void;
  /** Có truyền thì hiện nút "Hoàn tác nhập" để xóa các đơn vừa nhập */
  onRollback?: (ids: number[]) => void;
  isRollingBack?: boolean;
}

export function ImportResultModal({
  result,
  onClose,
  onRollback,
  isRollingBack = false,
}: ImportResultModalProps) {
  const [confirming, setConfirming] = useState(false);
  const canRollback = !!onRollback && result.createdIds.length > 0;

  return (
    <Modal title="Kết quả nhập Excel" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {result.created}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Đã nhập
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {result.duplicates}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Trùng, bỏ qua
            </div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/40">
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
              {result.failed}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Lỗi
            </div>
          </div>
        </div>
        {result.errors.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-400">
              Các dòng không nhập được
            </h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              {result.errors.map((er) => (
                <li
                  key={er.row}
                  className="text-slate-800 dark:text-slate-200"
                >
                  <strong>Dòng {er.row}:</strong> {er.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {canRollback && confirming && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            Xóa {result.createdIds.length} đơn vừa nhập để nhập lại? Việc này không khôi phục được.
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          {canRollback && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-3d btn-3d-red px-4 py-2 text-sm"
            >
              Hoàn tác nhập
            </button>
          )}
          {canRollback && confirming && (
            <>
              <button
                type="button"
                disabled={isRollingBack}
                onClick={() => onRollback?.(result.createdIds)}
                className="btn-3d btn-3d-red px-4 py-2 text-sm"
              >
                {isRollingBack ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
              <button
                type="button"
                disabled={isRollingBack}
                onClick={() => setConfirming(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Không xóa
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-blue px-5 py-2 text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
