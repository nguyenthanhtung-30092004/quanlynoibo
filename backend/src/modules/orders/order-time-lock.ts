/** Múi giờ nghiệp vụ của hệ thống (khóa giờ, báo cáo theo ngày đều tính theo giờ VN) */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Nhân viên chỉ tạo được đơn từ 04h30 đến 22h30; ngoài khung này là khóa (Admin không bị khóa) */
export const ORDER_OPEN_MINUTE = 4 * 60 + 30;
export const ORDER_CLOSE_MINUTE = 22 * 60 + 30;

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: BUSINESS_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});

/** Số phút kể từ 00:00 tại múi giờ nghiệp vụ */
export function getBusinessMinuteOfDay(now: Date = new Date()): number {
  const [hour, minute] = timeFormatter.format(now).split(':').map(Number);
  return hour * 60 + minute;
}

/** Ngày dạng YYYY-MM-DD tại múi giờ nghiệp vụ */
export function getBusinessDate(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

export function isOrderCreationLocked(now: Date = new Date()): boolean {
  const minute = getBusinessMinuteOfDay(now);
  return minute >= ORDER_CLOSE_MINUTE || minute < ORDER_OPEN_MINUTE;
}

/** Mốc bắt đầu của một ngày YYYY-MM-DD theo múi giờ nghiệp vụ (UTC+7, không có DST) */
export function startOfBusinessDay(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

/** Mốc bắt đầu của ngày kế tiếp (dùng làm cận trên loại trừ) */
export function startOfNextBusinessDay(date: string): Date {
  return new Date(startOfBusinessDay(date).getTime() + 24 * 60 * 60 * 1000);
}
