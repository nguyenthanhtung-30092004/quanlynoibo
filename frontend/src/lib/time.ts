/**
 * Khung giờ khóa tạo đơn (22h00 - 07h00, giờ Việt Nam).
 * Chỉ để hiển thị gợi ý trên giao diện; server mới là nơi quyết định.
 */
export const LOCK_START_HOUR = 22;
export const LOCK_END_HOUR = 7;

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function getVnHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(now);
  return Number(hour);
}

export function isOrderingLocked(now: Date = new Date()): boolean {
  const hour = getVnHour(now);
  return hour >= LOCK_START_HOUR || hour < LOCK_END_HOUR;
}

/** Ngày hiện tại dạng YYYY-MM-DD theo giờ Việt Nam */
export function getVnToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatVnClock(now: Date = new Date()): string {
  return now.toLocaleTimeString('vi-VN', { hour12: false, timeZone: TIME_ZONE });
}
