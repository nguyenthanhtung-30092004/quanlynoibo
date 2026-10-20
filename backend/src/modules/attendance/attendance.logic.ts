/**
 * Chấm công theo lượt quẹt trên máy chấm công và theo ca làm việc.
 * Toàn bộ quy tắc nằm ở đây dưới dạng hàm thuần để kiểm thử được; service chỉ lo lưu / đọc DB.
 */

export interface AttendanceConfig {
  /** Chỉ còn dùng cho công cũ tính theo đăng nhập (trước khi có máy chấm công); công theo ca: đủ cả ca = 1 công */
  fullMinutes: number;
  /** Như trên; công theo ca: đủ một nửa ca = 0,5 công */
  halfMinutes: number;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  fullMinutes: 480,
  halfMinutes: 240,
};

/** Quẹt lần nữa trong khoảng này (trước hoặc sau lượt đã ghi) bị coi là quẹt trùng và bỏ qua */
export const PUNCH_COOLDOWN_SECONDS = 120;

export interface Shift {
  /** Phút trong ngày (0-1439) bắt đầu ca */
  startMinute: number;
  /** Phút trong ngày kết thúc ca */
  endMinute: number;
  /** Nhãn hiển thị, vd "6h - 15h30" */
  label: string;
}

const at = (hour: number, minute = 0) => hour * 60 + minute;
const hm = (minuteOfDay: number) => {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};
const shift = (startMinute: number, endMinute: number): Shift => ({
  startMinute,
  endMinute,
  label: `${hm(startMinute)} - ${hm(endMinute)}`,
});

export const SHIFTS: readonly Shift[] = [
  shift(at(5), at(13, 30)),
  shift(at(6), at(15, 30)),
  shift(at(7), at(16, 30)),
  shift(at(8), at(17, 30)),
  shift(at(9), at(18, 30)),
  shift(at(10), at(19, 30)),
  shift(at(12), at(21)),
  shift(at(13, 30), at(22)),
];

/**
 * Đoán nhân viên làm ca nào từ giờ quẹt vào và giờ quẹt ra.
 * Giờ ra quyết định: chọn ca có giờ kết thúc gần giờ ra nhất (vào 5h05 ra 13h30 là ca 5h, vào muộn;
 * vào 5h05 ra 15h30 là ca 6h, vào sớm). Bằng nhau thì chọn ca có giờ bắt đầu gần giờ vào hơn.
 */
export function resolveShift(inMinute: number, outMinute: number): Shift {
  let best = SHIFTS[0];
  let bestEnd = Infinity;
  let bestStart = Infinity;
  for (const s of SHIFTS) {
    const endGap = Math.abs(s.endMinute - outMinute);
    const startGap = Math.abs(s.startMinute - inMinute);
    if (endGap < bestEnd || (endGap === bestEnd && startGap < bestStart)) {
      best = s;
      bestEnd = endGap;
      bestStart = startGap;
    }
  }
  return best;
}

/** Hết ngày lúc 23:59 (giờ VN): ai còn mở (chưa quẹt ra) thì hệ thống tự chấm ra và không tính công */
export const AUTO_CLOSE_MINUTE = 23 * 60 + 59;

/** Ngày `day` đã đến hạn tự chấm ra chưa: ngày đã qua, hoặc hôm nay mà đã tới 23:59 */
export function isAutoCloseDue(day: string, now: { day: string; minuteOfDay: number }): boolean {
  return day < now.day || (day === now.day && now.minuteOfDay >= AUTO_CLOSE_MINUTE);
}

/**
 * - not_in: chưa quẹt lượt nào
 * - working: mới quẹt vào (hôm nay), chưa quẹt ra
 * - auto_out: quên quẹt ra, 23:59 hệ thống đã tự chấm ra nên không tính công (Admin vẫn chỉnh tay được)
 * - missing_out: ngày đã qua mà chỉ có một lượt quẹt nhưng chưa được tự chấm ra (dữ liệu cũ), không tính công
 * - done: đã có lượt vào và lượt ra
 */
export type DayStatus = 'not_in' | 'working' | 'auto_out' | 'missing_out' | 'done';

export interface DayResult {
  status: DayStatus;
  shift: Shift | null;
  /** Số phút được tính trong ca (từ max(giờ vào, đầu ca) đến min(giờ ra, cuối ca)) */
  minutes: number;
  cong: number;
  /** Vào sau giờ bắt đầu ca bao nhiêu phút */
  lateMinutes: number;
  /** Ra trước giờ kết thúc ca bao nhiêu phút */
  earlyLeaveMinutes: number;
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
 * Số công của công cũ tính theo thời gian đăng nhập (trước khi dùng máy chấm công):
 * đủ `fullMinutes` là 1 công. Công tính theo ca dùng `congForShift`.
 */
export function congFromMinutes(minutes: number, config: AttendanceConfig): number {
  if (minutes >= config.fullMinutes) return 1;
  if (config.halfMinutes > 0 && minutes >= config.halfMinutes) return 0.5;
  return 0;
}

/**
 * Số công của một ca: có mặt đủ cả khung giờ của ca là 1 công (không trừ nghỉ trưa),
 * thiếu giờ nhưng đủ một nửa ca thì được nửa công, ít hơn nữa là 0.
 */
export function congForShift(minutes: number, shift: Shift): number {
  const length = shift.endMinute - shift.startMinute;
  if (minutes >= length) return 1;
  if (minutes * 2 >= length) return 0.5;
  return 0;
}

/**
 * Tính một ngày công từ lượt quẹt đầu (vào) và lượt quẹt cuối (ra) trong ngày.
 * Chỉ tính phần giờ nằm trong ca: vào sớm hơn đầu ca thì tính từ đầu ca, ở lại quá cuối ca vẫn chỉ tính hết ca.
 * Nên một ngày tối đa 1 công dù ở lại 9 tiếng. Có mặt đủ cả khung giờ của ca là 1 công, không trừ nghỉ trưa.
 *
 * `punchCount` chỉ đếm lượt quẹt thật (máy chấm công hoặc request chấm ra), không đếm lượt hệ thống tự chấm ra.
 * Mới có một lượt thật mà hệ thống đã tự chấm ra thì không tính công; nếu sau đó có lượt ra thật
 * (vd Admin gửi request chấm ra bù) thì ngày đó tính bình thường.
 */
export function evaluateDay(
  input: {
    firstAt: Date | null;
    lastAt: Date | null;
    punchCount: number;
    isToday: boolean;
    autoClosed?: boolean;
  },
  config: AttendanceConfig,
): DayResult {
  const none = { shift: null, minutes: 0, cong: 0, lateMinutes: 0, earlyLeaveMinutes: 0 };
  if (input.punchCount === 0 || !input.firstAt || !input.lastAt) return { status: 'not_in', ...none };
  if (input.punchCount === 1) {
    if (input.autoClosed) return { status: 'auto_out', ...none };
    return { status: input.isToday ? 'working' : 'missing_out', ...none };
  }

  const inMinute = vietnamClock(input.firstAt).minuteOfDay;
  const outMinute = vietnamClock(input.lastAt).minuteOfDay;
  const s = resolveShift(inMinute, outMinute);

  const from = Math.max(inMinute, s.startMinute);
  const to = Math.min(outMinute, s.endMinute);
  const minutes = Math.max(0, to - from);
  return {
    status: 'done',
    shift: s,
    minutes,
    cong: congForShift(minutes, s),
    lateMinutes: Math.max(0, inMinute - s.startMinute),
    earlyLeaveMinutes: Math.max(0, s.endMinute - outMinute),
  };
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
