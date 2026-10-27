'use client';

import { MagnifyingGlass, X } from '@phosphor-icons/react';

/**
 * Ô tìm nhân viên theo tên (gõ "tien" vẫn ra "Tiên"). Chữ 16px để iPhone không tự phóng to khi chạm vào ô.
 * `shown`/`total`: hiện "x/y nhân viên" khi đang lọc.
 */
export function StaffSearch({
  value,
  onChange,
  shown,
  total,
}: {
  value: string;
  onChange: (v: string) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          className="input-3d !h-11 !pl-10 !pr-10 !text-base"
          placeholder="Tìm nhân viên theo tên…"
          aria-label="Tìm nhân viên theo tên"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Xóa tìm kiếm"
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>
      {value.trim() && (
        <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {shown}/{total} người
        </span>
      )}
    </div>
  );
}
