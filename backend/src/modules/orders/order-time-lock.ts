/** Múi giờ nghiệp vụ của hệ thống (khóa giờ, báo cáo theo ngày đều tính theo giờ VN) */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Khóa tạo đơn từ 22h00 tối đến 07h00 sáng hôm sau */
export const ORDER_LOCK_START_HOUR = 22;
export const ORDER_LOCK_END_HOUR = 7;

const hourFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: BUSINESS_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});

/** Giờ (0-23) tại múi giờ nghiệp vụ */
export function getBusinessHour(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

/** Ngày dạng YYYY-MM-DD tại múi giờ nghiệp vụ */
export function getBusinessDate(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

export function isOrderCreationLocked(now: Date = new Date()): boolean {
  const hour = getBusinessHour(now);
  return hour >= ORDER_LOCK_START_HOUR || hour < ORDER_LOCK_END_HOUR;
}

/** Mốc bắt đầu của một ngày YYYY-MM-DD theo múi giờ nghiệp vụ (UTC+7, không có DST) */
export function startOfBusinessDay(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

/** Mốc bắt đầu của ngày kế tiếp (dùng làm cận trên loại trừ) */
export function startOfNextBusinessDay(date: string): Date {
  return new Date(startOfBusinessDay(date).getTime() + 24 * 60 * 60 * 1000);
}
