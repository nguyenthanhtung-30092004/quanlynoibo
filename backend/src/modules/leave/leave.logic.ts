/** Giới hạn số người được nghỉ trong một ngày, chia theo đầu tuần / cuối tuần */
export interface LeaveConfig {
  /** Số người nghỉ tối đa cho các ngày đầu tuần (T2, T3, T4, T5) */
  earlyMax: number;
  /** Số người nghỉ tối đa cho các ngày cuối tuần (T6, T7, CN) */
  lateMax: number;
}

export const DEFAULT_LEAVE_CONFIG: LeaveConfig = { earlyMax: 3, lateMax: 2 };

const MAX_LIMIT = 100;

const clampLimit = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_LIMIT, Math.max(0, Math.floor(n)));
};

export function sanitizeLeaveConfig(input: unknown): LeaveConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    earlyMax: clampLimit(raw.earlyMax, DEFAULT_LEAVE_CONFIG.earlyMax),
    lateMax: clampLimit(raw.lateMax, DEFAULT_LEAVE_CONFIG.lateMax),
  };
}

/** Thứ trong tuần của ngày YYYY-MM-DD (0 = Chủ nhật ... 6 = Thứ bảy), không phụ thuộc múi giờ máy chủ */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Đầu tuần = T2..T5, cuối tuần = T6, T7, CN */
export function isLateWeek(day: string): boolean {
  const w = weekdayOf(day);
  return w === 5 || w === 6 || w === 0;
}

/** Giới hạn hiệu lực của ngày: chỉnh riêng theo ngày (nếu có) ưu tiên hơn mặc định theo nhóm */
export function limitForDay(day: string, config: LeaveConfig, override?: number | null): number {
  if (override !== undefined && override !== null) return override;
  return isLateWeek(day) ? config.lateMax : config.earlyMax;
}

export interface AutoUrgentInput {
  /** Các ngày cần xét (YYYY-MM-DD) */
  days: string[];
  /** Hôm nay; chỉ xét ngày đã qua vì hôm nay nhân viên vẫn còn có thể đến */
  today: string;
  /** Nhân viên đang hoạt động; `since` là ngày tạo tài khoản, trước ngày đó không tính là nghỉ */
  staff: Array<{ id: number; fullName: string; since: string }>;
  /** Ngày -> những người có lượt quẹt trong ngày đó */
  punched: Map<string, Set<number>>;
  /** Ngày -> những người đã có đăng ký nghỉ (kể cả Admin đăng ký hộ) */
  registered: Map<string, Set<number>>;
}

/**
 * Nghỉ đột xuất tự ghi nhận: ngày đã qua, nhân viên không quẹt lượt nào và cũng chưa đăng ký nghỉ.
 * Ngày mà không ai quẹt (cả tiệm nghỉ, hoặc máy chấm công chưa dùng) thì bỏ qua, tránh ghi nhận hàng loạt sai.
 * Kết quả là tính ra từ dữ liệu chứ không lưu: sau này có lượt quẹt bù thì ngày đó tự hết bị tính nghỉ.
 */
export function findAutoUrgentAbsences(input: AutoUrgentInput): Map<string, Array<{ userId: number; fullName: string }>> {
  const result = new Map<string, Array<{ userId: number; fullName: string }>>();
  for (const day of input.days) {
    if (day >= input.today) continue;
    const punched = input.punched.get(day);
    if (!punched || punched.size === 0) continue;
    const registered = input.registered.get(day);
    const absent = input.staff.filter((u) => u.since <= day && !punched.has(u.id) && !registered?.has(u.id));
    if (absent.length > 0) result.set(day, absent.map((u) => ({ userId: u.id, fullName: u.fullName })));
  }
  return result;
}

/** Ngày YYYY-MM-DD có tồn tại thật trong lịch hay không (loại 2026-02-30...) */
export function isRealDay(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
