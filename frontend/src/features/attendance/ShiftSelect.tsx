'use client';

import { useEffect, useState } from 'react';
import type { ShiftOption } from './types';

interface ShiftSelectProps {
  /** Giá trị đang lưu: 'auto' hoặc giờ bắt đầu ca (phút trong ngày) dạng chuỗi */
  value: string;
  shifts: ShiftOption[];
  autoLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  /** Gọi khi bấm Lưu; ném lỗi thì giữ nguyên lựa chọn đang chọn để thử lại hoặc Hủy */
  onSave: (value: string) => Promise<unknown> | unknown;
}

/**
 * Ô chọn ca có nút Lưu / Hủy: chọn xong chưa lưu ngay, nên lỡ tay chọn nhầm thì bấm Hủy là về như cũ.
 */
export function ShiftSelect({ value, shifts, autoLabel, ariaLabel, disabled, className, onSave }: ShiftSelectProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  // Giá trị đã lưu đổi (vừa lưu xong, hoặc dữ liệu tải lại) thì lựa chọn đang chờ không còn đúng nữa
  useEffect(() => setDraft(value), [value]);

  const changed = draft !== value;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      // Nơi gọi đã báo lỗi; giữ lựa chọn để người dùng thử lại hoặc Hủy
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        className={`input-3d !h-8 !px-2 !py-0 text-xs ${className ?? '!w-44'} ${
          changed ? '!border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/60' : ''
        }`}
        disabled={disabled || saving}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={ariaLabel}
      >
        <option value="auto">{autoLabel}</option>
        {shifts.map((s) => (
          <option key={s.startMinute} value={String(s.startMinute)}>
            {s.label}
          </option>
        ))}
      </select>
      {changed && (
        <>
          <button
            type="button"
            onClick={save}
            disabled={disabled || saving}
            className="btn-3d btn-3d-blue px-3 py-1 text-xs disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(value)}
            disabled={saving}
            className="btn-3d btn-3d-white px-3 py-1 text-xs disabled:opacity-50"
          >
            Hủy
          </button>
        </>
      )}
    </div>
  );
}
