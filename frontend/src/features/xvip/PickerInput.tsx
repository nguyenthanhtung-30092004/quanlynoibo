'use client';

import type { ReactNode } from 'react';
import { CalendarBlank, Clock } from '@phosphor-icons/react';

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
const formatDate = (v: string) => {
  const [y, m, d] = v.split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

interface BaseProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

/**
 * Khung hiển thị tự vẽ (chữ rõ ràng, có biểu tượng) phủ lên ô chọn gốc của
 * trình duyệt đã làm trong suốt. Bấm vào là mở bộ chọn ngày/giờ gốc của máy,
 * nên vẫn dùng tốt trên điện thoại nhưng không còn kiểu chữ thô
 * như "ngày 8 thg 10, 2026".
 */
function PickerShell({
  type,
  value,
  display,
  placeholder,
  icon,
  onChange,
  required,
}: BaseProps & { type: 'date' | 'time'; display: string; icon: ReactNode }) {
  return (
    <div className="relative">
      <div
        className={`input-3d flex items-center justify-between gap-2 pr-3 ${
          display ? '' : 'text-slate-400'
        }`}
        aria-hidden
      >
        <span className="truncate font-medium">{display || placeholder}</span>
        <span className="shrink-0 text-slate-400">{icon}</span>
      </div>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

export function DateInput({ placeholder = 'dd/mm/yyyy', ...props }: BaseProps) {
  return (
    <PickerShell
      {...props}
      placeholder={placeholder}
      type="date"
      display={formatDate(props.value)}
      icon={<CalendarBlank size={18} weight="duotone" />}
    />
  );
}

export function TimeInput({ placeholder = '--:--', ...props }: BaseProps) {
  return (
    <PickerShell
      {...props}
      placeholder={placeholder}
      type="time"
      display={props.value}
      icon={<Clock size={18} weight="duotone" />}
    />
  );
}
