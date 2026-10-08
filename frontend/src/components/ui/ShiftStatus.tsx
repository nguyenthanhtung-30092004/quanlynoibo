'use client';

import { cn } from '@/lib/cn';
import { isOrderingLocked, LOCK_END_HOUR, LOCK_START_HOUR } from '@/lib/time';
import { useNow } from '@/lib/use-vn-now';

const pad = (hour: number) => String(hour).padStart(2, '0');

/**
 * Trạng thái nhận đơn theo quy chế khóa 22h–07h (giờ Việt Nam).
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
        ? `Đang khóa tạo đơn, mở lại lúc ${pad(LOCK_END_HOUR)}:00`
        : `Đang nhận đơn, khóa lúc ${pad(LOCK_START_HOUR)}:00`}
    </span>
  );
}
