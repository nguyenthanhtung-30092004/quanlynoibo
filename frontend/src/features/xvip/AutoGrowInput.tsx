'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Ô nhập một dòng nhưng tự xuống dòng và cao lên theo nội dung, nên gõ dài đến đâu
 * cũng thấy hết chứ không bị cắt phía sau. Enter vẫn gửi form như ô nhập thường,
 * không chèn xuống dòng thật vào dữ liệu.
 */
export function AutoGrowInput({
  value,
  onChange,
  maxLength,
  invalid = false,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  invalid?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Đặt lại chiều cao theo nội dung mỗi khi đổi giá trị
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`input-3d !h-auto !min-h-[42px] resize-none overflow-hidden leading-snug ${
        invalid ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''
      }`}
      aria-invalid={invalid}
      value={value}
      maxLength={maxLength}
      autoFocus={autoFocus}
      placeholder={placeholder}
      // Dán nhiều dòng thì gộp thành một dòng
      onChange={(e) => onChange(e.target.value.replace(/\s*[\r\n]+\s*/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
