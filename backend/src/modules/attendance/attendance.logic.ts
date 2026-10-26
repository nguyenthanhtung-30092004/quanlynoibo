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

/** Ở lại sau giờ kết thúc ca tối thiểu bấy nhiêu phút mới tính là tăng ca */
export const OVERTIME_MIN_MINUTES = 60;
/**
 * Vào muộn dưới bấy nhiêu phút thì vẫn đủ công và chỉ bị trừ tiền vào muộn;
 * từ mức này trở lên công tính theo giờ có mặt (nửa công) và không trừ tiền vào muộn nữa.
 * Bảng lương ở frontend (`LATE_HALF_CONG_MINUTES` trong payroll/calc.ts) phải dùng cùng con số này.
 */
export const LATE_KEEP_FULL_CONG_MINUTES = 30;
/** Mỗi ngày tính tối đa bấy nhiêu giờ tăng ca, phần dư không tính */
export const OVERTIME_MAX_HOURS = 3;

/**
 * Đổi số phút ở lại sau giờ kết thúc ca thành số giờ tăng ca theo mốc 0,5 giờ.
 * Dưới 60 phút: 0. Từ 60 phút: luôn làm tròn xuống mốc 0,5 giờ (phần lẻ dưới 30 phút bỏ đi, từ 30 phút là 0,5 giờ).
 * Vd 1g15 -> 1, 1g30 -> 1,5, 1g45 -> 1,5, 2g30 -> 2,5, 2g45 -> 2,5; tối đa OVERTIME_MAX_HOURS.
 */
export function overtimeHoursFromMinutes(extraMinutes: number): number {
  if (!(extraMinutes >= OVERTIME_MIN_MINUTES)) return 0;
  const hours = Math.floor(extraMinutes / 30) / 2;
  return Math.min(OVERTIME_MAX_HOURS, hours);
}

/** Ra trong khoảng này quanh giờ kết thúc ca thì coi là ra đúng giờ (không phải tăng ca) */
const CLEAN_FINISH_MINUTES = 10;
/** Ca mặc định của nhân viên chỉ được dùng khi giờ vào cách giờ bắt đầu ca không quá bấy nhiêu phút */
const DEFAULT_SHIFT_MAX_GAP = 120;
/** Vào cách giờ bắt đầu một ca không quá bấy nhiêu phút thì coi là đi ca đó (dùng khi bỏ ca mặc định) */
const OTHER_SHIFT_START_TOLERANCE = 15;
/** Vào sớm hơn đầu ca đã đoán quá bấy nhiêu phút thì coi là bất thường và xem xét ca khác theo giờ vào */
const EARLY_ARRIVAL_MAX_MINUTES = 60;
/** Giờ vào cách đầu một ca không quá bấy nhiêu phút thì đủ sát để coi là đi ca đó (dùng khi vào sớm bất thường) */
const SHIFT_START_MATCH_MINUTES = 30;

export type ShiftSource = 'auto' | 'default' | 'forced';

export interface ShiftChoice {
  shift: Shift;
  source: ShiftSource;
  /** Cách đoán khác cũng hợp lý và cho số giờ tăng ca khác; null nếu không có gì mập mờ */
  alternative: { shift: Shift; overtimeHours: number } | null;
}

const shiftByStart = (startMinute: number | null | undefined): Shift | null =>
  startMinute == null ? null : (SHIFTS.find((s) => s.startMinute === startMinute) ?? null);

const overtimeOf = (shift: Shift, outMinute: number) =>
  overtimeHoursFromMinutes(outMinute - shift.endMinute);

/**
 * Xác định ca của một ngày, ưu tiên: Admin chọn tay cho ngày đó > ca mặc định của nhân viên > tự đoán.
 *
 * Tự đoán: giờ ra gần giờ kết thúc ca nào (`resolveShift`) thì là ca đó, vì người ta quẹt ra đúng giờ là chuyện thường.
 * Nhưng khi giờ ra lệch hẳn so với mọi ca (quá CLEAN_FINISH_MINUTES sau giờ kết thúc) thì nhiều khả năng là tăng ca,
 * lúc đó dùng giờ VÀO để biết ca (giờ vào không bị tăng ca làm lệch).
 * Nếu hai cách đoán cho số giờ tăng ca khác nhau thì trả thêm `alternative` để giao diện đánh dấu cho Admin xem lại;
 * mặc định chọn cách không phát sinh tăng ca để không trả tiền khi chưa chắc.
 */
export function resolveShiftForDay(
  inMinute: number,
  outMinute: number,
  hints: { forcedStart?: number | null; defaultStart?: number | null } = {},
): ShiftChoice {
  const forced = shiftByStart(hints.forcedStart);
  if (forced) return { shift: forced, source: 'forced', alternative: null };

  const byOut = resolveShift(inMinute, outMinute);

  let byIn = SHIFTS[0];
  for (const s of SHIFTS) {
    if (Math.abs(s.startMinute - inMinute) < Math.abs(byIn.startMinute - inMinute)) byIn = s;
  }

  const preferred = shiftByStart(hints.defaultStart);
  if (preferred && Math.abs(inMinute - preferred.startMinute) <= DEFAULT_SHIFT_MAX_GAP) {
    // Giờ quẹt khớp rõ ràng một ca khác (ra đúng giờ kết thúc ca đó, và vào gần giờ bắt đầu ca đó hơn
    // ca mặc định) thì ca mặc định sai, vd mặc định 7h nhưng vào 7h53 ra 17h31 là ca 8h.
    const fitsOtherShift =
      byOut !== preferred &&
      Math.abs(outMinute - byOut.endMinute) <= CLEAN_FINISH_MINUTES &&
      Math.abs(inMinute - byOut.startMinute) < Math.abs(inMinute - preferred.startMinute);
    // Vào sát giờ bắt đầu một ca khác nhưng muộn hẳn so với ca mặc định, và cũng không ra đúng giờ ca mặc định,
    // thì nhiều khả năng đi ca khác chứ không phải vào muộn cả tiếng, vd mặc định 7h nhưng vào 8h03 ra 20h04 là ca 8h.
    const startsOtherShift =
      byIn !== preferred &&
      inMinute - preferred.startMinute > LATE_KEEP_FULL_CONG_MINUTES &&
      Math.abs(inMinute - byIn.startMinute) <= OTHER_SHIFT_START_TOLERANCE &&
      byIn.endMinute <= outMinute &&
      outMinute - preferred.endMinute > CLEAN_FINISH_MINUTES;
    if (startsOtherShift) {
      const asDefault = overtimeOf(preferred, outMinute);
      return {
        shift: byIn,
        source: 'auto',
        alternative:
          asDefault !== overtimeOf(byIn, outMinute) ? { shift: preferred, overtimeHours: asDefault } : null,
      };
    }
    if (!fitsOtherShift) return { shift: preferred, source: 'default', alternative: null };
  }

  const pastEnd = outMinute - byOut.endMinute;
  let chosen = pastEnd > CLEAN_FINISH_MINUTES && byIn.endMinute <= outMinute ? byIn : byOut;
  // Ra đúng giờ hết một ca nhưng vào sớm hơn đầu ca đó quá nhiều thì ít khả năng là vào sớm thật: nếu giờ vào
  // sát đầu một ca khác thì nhiều khả năng đi ca khác và tăng ca, vd vào 11h45 ra 22h là ca 12h tăng ca 1 giờ (không phải ca 13h30)
  if (
    chosen !== byIn &&
    chosen.startMinute - inMinute > EARLY_ARRIVAL_MAX_MINUTES &&
    Math.abs(byIn.startMinute - inMinute) <= SHIFT_START_MATCH_MINUTES &&
    byIn.endMinute <= outMinute
  ) {
    chosen = byIn;
  }
  const other = chosen === byIn ? byOut : byIn;
  const alternative =
    other !== chosen && overtimeOf(other, outMinute) !== overtimeOf(chosen, outMinute)
      ? { shift: other, overtimeHours: overtimeOf(other, outMinute) }
      : null;
  return { shift: chosen, source: 'auto', alternative };
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
  /** Ở lại sau giờ kết thúc ca bao nhiêu phút (0 nếu không ở lại muộn) */
  overtimeMinutes: number;
  /** Số giờ tăng ca được tính theo mốc 0,5 giờ, tối đa OVERTIME_MAX_HOURS */
  overtimeHours: number;
  /** Ca do ai xác định; null khi chưa có ca */
  shiftSource: ShiftSource | null;
  /** Cách hiểu ca khác cho số giờ tăng ca khác (cần Admin xem lại); null nếu không mập mờ */
  alternative: { shift: Shift; overtimeHours: number } | null;
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
 * Nên một ngày tối đa 1 công dù ở lại 9 tiếng (phần ở lại quá giờ kết thúc ca không thành công mà thành tăng ca, xem `overtimeHoursFromMinutes`). Có mặt đủ cả khung giờ của ca là 1 công, không trừ nghỉ trưa.
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
    /** Giờ bắt đầu ca (phút trong ngày) do Admin chọn tay cho ngày này */
    forcedShiftStart?: number | null;
    /** Giờ bắt đầu ca mặc định của nhân viên */
    defaultShiftStart?: number | null;
  },
  config: AttendanceConfig,
): DayResult {
  const none = {
    shift: null,
    minutes: 0,
    cong: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    overtimeHours: 0,
    shiftSource: null,
    alternative: null,
  };
  if (input.punchCount === 0 || !input.firstAt || !input.lastAt) return { status: 'not_in', ...none };
  if (input.punchCount === 1) {
    if (input.autoClosed) return { status: 'auto_out', ...none };
    return { status: input.isToday ? 'working' : 'missing_out', ...none };
  }

  const inMinute = vietnamClock(input.firstAt).minuteOfDay;
  const outMinute = vietnamClock(input.lastAt).minuteOfDay;
  const choice = resolveShiftForDay(inMinute, outMinute, {
    forcedStart: input.forcedShiftStart,
    defaultStart: input.defaultShiftStart,
  });
  const s = choice.shift;

  const from = Math.max(inMinute, s.startMinute);
  const to = Math.min(outMinute, s.endMinute);
  const minutes = Math.max(0, to - from);
  const lateMinutes = Math.max(0, inMinute - s.startMinute);
  // Vào muộn dưới ngưỡng chỉ bị trừ tiền theo phút, công vẫn tính như vào đúng giờ
  const congMinutes = lateMinutes < LATE_KEEP_FULL_CONG_MINUTES ? Math.max(0, to - s.startMinute) : minutes;
  return {
    status: 'done',
    shift: s,
    minutes,
    cong: congForShift(congMinutes, s),
    lateMinutes,
    earlyLeaveMinutes: Math.max(0, s.endMinute - outMinute),
    overtimeMinutes: Math.max(0, outMinute - s.endMinute),
    overtimeHours: overtimeOf(s, outMinute),
    shiftSource: choice.source,
    alternative: choice.alternative,
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
