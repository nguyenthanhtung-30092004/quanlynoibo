'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/features/xvip/data';

const format = (n: number) => (n === 0 ? '' : `${n < 0 ? '-' : ''}${money(Math.abs(n))}`);

/** Ô nhập số tiền có dấu chấm ngăn cách hàng nghìn; `allowNegative` cho phép nhập số âm (khoản trừ) */
export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  placeholder = '0',
  className = '',
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  allowNegative?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(format(value));
  const last = useRef(value);

  // Giá trị đổi từ bên ngoài (đổi tháng, khôi phục mặc định...) thì cập nhật chữ hiển thị
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(format(value));
    }
  }, [value]);

  return (
    <input
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const negative = allowNegative && raw.trim().startsWith('-');
        const digits = raw.replace(/\D/g, '');
        const n = digits ? Number(digits) : 0;
        const next = negative ? -n : n;
        setText(digits ? `${negative ? '-' : ''}${money(n)}` : negative ? '-' : '');
        last.current = next;
        onChange(next);
      }}
      className={`input-3d tnum text-right ${className}`}
    />
  );
}
