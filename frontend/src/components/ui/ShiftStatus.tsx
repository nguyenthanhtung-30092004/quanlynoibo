'use client';

import { cn } from '@/lib/cn';
import { CLOSE_TIME, isOrderingLocked, OPEN_TIME } from '@/lib/time';
import { useNow } from '@/lib/use-vn-now';

/**
 * Trạng thái nhận đơn theo quy chế 04h30–22h30 (giờ Việt Nam, áp dụng cho nhân viên).
 * Chỉ để hiển thị; server mới là nơi chặn tạo đơn.
 */
export function ShiftStatus() {
  const now = useNow();
  if (!now) return <span className="inline-block h-7 w-56" aria-hidden />;

  const locked = isOrderingLocked(now);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-medium',
        locked ? 'bg-st-cancelled-bg text-st-cancelled-text' : 'bg-st-completed-bg text-st-completed-text',
      )}
      role="status"
    >
      <span
        className={cn('size-2 rounded-full', locked ? 'bg-st-cancelled-dot' : 'bg-st-completed-dot')}
        aria-hidden
      />
      {locked
        ? `Đang khóa tạo đơn, mở lại lúc ${OPEN_TIME}`
        : `Đang nhận đơn, khóa lúc ${CLOSE_TIME}`}
    </span>
  );
}
