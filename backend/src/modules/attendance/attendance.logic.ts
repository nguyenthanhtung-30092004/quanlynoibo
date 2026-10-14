/**
 * Chấm công theo thời gian đăng nhập / online và có thao tác thật trong ngày.
 * Toàn bộ quy tắc nằm ở đây dưới dạng hàm thuần để kiểm thử được; service chỉ lo lưu / đọc DB.
 */

export interface AttendanceConfig {
  /** Số phút làm việc từ mức này trở lên được 1 công (mặc định 480 = 8 tiếng) */
  fullMinutes: number;
  /** Từ mức này được nửa công (mặc định 240 = 4 tiếng); 0 = không tính nửa công */
  halfMinutes: number;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  fullMinutes: 480,
  halfMinutes: 240,
};

/** Lý do một lượt "tôi đang làm việc" được tính hoặc không */
export type BeatReason = 'ok' | 'not_staff';

export interface BeatVerdict {
  counted: boolean;
  reason: BeatReason;
}

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Chuẩn hóa cấu hình do client gửi lên hoặc đọc từ DB; cấu hình cũ có trường thừa (vị trí...) vẫn đọc bình thường và bỏ qua */
export function sanitizeAttendanceConfig(input: unknown): AttendanceConfig {
  const raw = obj(input);
  const def = DEFAULT_ATTENDANCE_CONFIG;
  const fullMinutes = num(raw.fullMinutes, def.fullMinutes, 1, 1440);
  return {
    fullMinutes,
    halfMinutes: Math.min(fullMinutes, num(raw.halfMinutes, def.halfMinutes, 0, 1440)),
  };
}

/**
 * Một lượt "đang online" có được ghi nhận không: chỉ cần là nhân viên (STAFF) đang đăng nhập.
 * Không đòi thao tác chuột/bàn phím, không phụ thuộc thiết bị.
 */
export function evaluateBeat(input: { role: string }): BeatVerdict {
  if (input.role !== 'STAFF') return { counted: false, reason: 'not_staff' };
  return { counted: true, reason: 'ok' };
}

/** Số công của một ngày theo số phút tính từ lần đăng nhập đầu tiên trong ngày */
export function congFromMinutes(minutes: number, config: AttendanceConfig): number {
  if (minutes >= config.fullMinutes) return 1;
  if (config.halfMinutes > 0 && minutes >= config.halfMinutes) return 0.5;
  return 0;
}

/** Ngày (YYYY-MM-DD) và phút trong ngày (0-1439) theo giờ Việt Nam; do server tính, không tin giờ máy khách */
export function vietnamClock(now: Date = new Date()): { day: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
  };
}
