/**
 * Khung giờ nhân viên được tạo đơn: 04h30 - 22h30 (giờ Việt Nam), Admin không bị khóa.
 * Chỉ để hiển thị gợi ý trên giao diện; server mới là nơi quyết định.
 */
export const OPEN_TIME = '04:30';
export const CLOSE_TIME = '22:30';
const OPEN_MINUTE = 4 * 60 + 30;
const CLOSE_MINUTE = 22 * 60 + 30;

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Số phút kể từ 00:00 theo giờ Việt Nam */
export function getVnMinuteOfDay(now: Date = new Date()): number {
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  })
    .format(now)
    .split(':')
    .map(Number);
  return hour * 60 + minute;
}

export function isOrderingLocked(now: Date = new Date()): boolean {
  const minute = getVnMinuteOfDay(now);
  return minute >= CLOSE_MINUTE || minute < OPEN_MINUTE;
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
