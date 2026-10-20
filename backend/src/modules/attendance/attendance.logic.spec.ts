import {
  DEFAULT_ATTENDANCE_CONFIG,
  SHIFTS,
  congForShift,
  congFromMinutes,
  evaluateDay,
  resolveShift,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
} from './attendance.logic.js';

/** "05:30" của ngày 2026-10-13 theo giờ Việt Nam */
const vn = (hhmm: string) => new Date(`2026-10-13T${hhmm}:00+07:00`);
const hm = (h: number, m = 0) => h * 60 + m;

describe('congFromMinutes', () => {
  it('mặc định mới: 480 phút (8 tiếng) = 1 công, 240 phút (4 tiếng) = 0,5 công', () => {
    const config = DEFAULT_ATTENDANCE_CONFIG;
    expect(congFromMinutes(239, config)).toBe(0);
    expect(congFromMinutes(240, config)).toBe(0.5);
    expect(congFromMinutes(479, config)).toBe(0.5);
    expect(congFromMinutes(480, config)).toBe(1);
    expect(congFromMinutes(600, config)).toBe(1);
  });

  it('tùy biến cấu hình ngưỡng công', () => {
    const custom: AttendanceConfig = { fullMinutes: 420, halfMinutes: 0 };
    expect(congFromMinutes(419, custom)).toBe(0);
    expect(congFromMinutes(420, custom)).toBe(1);
    expect(congFromMinutes(250, custom)).toBe(0);
  });
});

describe('sanitizeAttendanceConfig', () => {
  it('thiếu hoặc rác thì lấy mặc định mới (480 / 240)', () => {
    expect(sanitizeAttendanceConfig(null)).toEqual(DEFAULT_ATTENDANCE_CONFIG);
    expect(sanitizeAttendanceConfig('abc')).toEqual(DEFAULT_ATTENDANCE_CONFIG);
  });

  it('vẫn đọc được cấu hình cũ có các trường định vị thừa và bỏ qua chúng', () => {
    const oldConfig = {
      workplace: { lat: 21.0285, lng: 105.8542 },
      radiusM: 150,
      maxAccuracyM: 300,
      fullMinutes: 420,
      halfMinutes: 210,
    };
    const c = sanitizeAttendanceConfig(oldConfig);
    expect(c).toEqual({ fullMinutes: 420, halfMinutes: 210 });
    expect((c as unknown as Record<string, unknown>).workplace).toBeUndefined();
    expect((c as unknown as Record<string, unknown>).radiusM).toBeUndefined();
  });

  it('chặn số phút vô lý', () => {
    const c = sanitizeAttendanceConfig({
      fullMinutes: 5000,
      halfMinutes: 9999,
    });
    expect(c.fullMinutes).toBe(1440);
    expect(c.halfMinutes).toBeLessThanOrEqual(c.fullMinutes);
  });
});

describe('SHIFTS', () => {
  it('có đủ 8 ca và nhãn dễ đọc', () => {
    expect(SHIFTS.map((s) => s.label)).toEqual([
      '5h - 13h30',
      '6h - 15h30',
      '7h - 16h30',
      '8h - 17h30',
      '9h - 18h30',
      '10h - 19h30',
      '12h - 21h',
      '13h30 - 22h',
    ]);
  });
});

describe('resolveShift', () => {
  it('vào 5h30 ra 13h30 là ca 5h (vào muộn)', () => {
    expect(resolveShift(hm(5, 30), hm(13, 30)).label).toBe('5h - 13h30');
  });

  it('vào 5h30 ra 15h30 là ca 6h (vào sớm)', () => {
    expect(resolveShift(hm(5, 30), hm(15, 30)).label).toBe('6h - 15h30');
  });

  it('giờ ra lệch một chút vẫn về ca gần nhất', () => {
    expect(resolveShift(hm(7, 55), hm(17, 40)).label).toBe('8h - 17h30');
    expect(resolveShift(hm(13, 35), hm(22, 10)).label).toBe('13h30 - 22h');
  });

  it('giờ ra nằm giữa hai ca thì chọn ca có giờ bắt đầu gần giờ vào hơn', () => {
    // 14h30 cách 13h30 và 15h30 đều 60 phút
    expect(resolveShift(hm(5, 5), hm(14, 30)).label).toBe('5h - 13h30');
    expect(resolveShift(hm(6, 5), hm(14, 30)).label).toBe('6h - 15h30');
  });
});

describe('evaluateDay', () => {
  const config = DEFAULT_ATTENDANCE_CONFIG;
  const day = (inAt: string | null, outAt: string | null, punchCount: number, isToday = false) =>
    evaluateDay({ firstAt: inAt ? vn(inAt) : null, lastAt: outAt ? vn(outAt) : null, punchCount, isToday }, config);

  it('chưa quẹt lượt nào', () => {
    expect(day(null, null, 0)).toMatchObject({ status: 'not_in', cong: 0, shift: null });
  });

  it('mới quẹt vào hôm nay: đang làm, chưa tính công', () => {
    expect(day('05:30', '05:30', 1, true)).toMatchObject({ status: 'working', cong: 0, shift: null });
  });

  it('ngày đã qua chỉ có một lượt: thiếu lượt ra, không tính công', () => {
    expect(day('05:30', '05:30', 1, false)).toMatchObject({ status: 'missing_out', cong: 0 });
  });

  it('vào 5h30 ra 13h30: ca 5h, vào muộn 30 phút nên chưa đủ ca, nửa công', () => {
    const r = day('05:30', '13:30', 2);
    expect(r).toMatchObject({ status: 'done', minutes: 480, cong: 0.5, lateMinutes: 30, earlyLeaveMinutes: 0 });
    expect(r.shift?.label).toBe('5h - 13h30');
  });

  it('đủ cả khung giờ của ca là 1 công, không trừ nghỉ trưa (ca dài 8,5 hay 9,5 tiếng đều vậy)', () => {
    expect(day('05:00', '13:30', 2)).toMatchObject({ minutes: 510, cong: 1, lateMinutes: 0, earlyLeaveMinutes: 0 });
    expect(day('06:00', '15:30', 2)).toMatchObject({ minutes: 570, cong: 1 });
    expect(day('12:00', '21:00', 2)).toMatchObject({ minutes: 540, cong: 1 });
  });

  it('thiếu dù một phút so với cả ca thì không đủ 1 công', () => {
    expect(day('06:01', '15:30', 2)).toMatchObject({ cong: 0.5, lateMinutes: 1 });
    expect(day('06:00', '15:29', 2)).toMatchObject({ cong: 0.5, earlyLeaveMinutes: 1 });
  });

  it('đủ một nửa ca là 0,5 công, chưa tới nửa ca là 0', () => {
    // ca 6h - 15h30 dài 570 phút, nửa ca = 285 phút = 4g45
    expect(day('06:00', '10:45', 2, false)).toMatchObject({ minutes: 285 });
    expect(congForShift(285, SHIFTS[1])).toBe(0.5);
    expect(congForShift(284, SHIFTS[1])).toBe(0);
    expect(congForShift(569, SHIFTS[1])).toBe(0.5);
    expect(congForShift(570, SHIFTS[1])).toBe(1);
  });

  it('vào 5h30 ra 15h30: ca 6h, vào sớm nên chỉ tính từ 6h, đủ 1 công', () => {
    const r = day('05:30', '15:30', 2);
    expect(r).toMatchObject({ minutes: 570, cong: 1, lateMinutes: 0, earlyLeaveMinutes: 0 });
    expect(r.shift?.label).toBe('6h - 15h30');
  });

  it('ở lại 9 tiếng vẫn chỉ tính theo ca, tối đa 1 công', () => {
    const r = day('08:00', '20:00', 2);
    expect(r.cong).toBe(1);
    expect(r.minutes).toBeLessThanOrEqual(r.shift!.endMinute - r.shift!.startMinute);
  });

  it('về sớm: tính đến giờ ra, ra sớm bao nhiêu phút được ghi lại', () => {
    // vào 8h ra 13h: gần ca 5h - 13h30 nhất, tính 300 phút (hơn nửa ca 255 phút)
    const r = day('08:00', '13:00', 2);
    expect(r.minutes).toBe(300);
    expect(r.cong).toBe(0.5);
    expect(r.earlyLeaveMinutes).toBe(30);
  });

  it('vào quá muộn: thiếu giờ nên thành nửa công', () => {
    // ca 6h - 15h30, vào 9h, ra 15h30 = 390 phút
    const r = day('09:00', '15:30', 2);
    expect(r).toMatchObject({ minutes: 390, cong: 0.5, lateMinutes: 180 });
  });
});

describe('vietnamClock', () => {
  it('đổi sang giờ Việt Nam (UTC+7), qua ngày đúng', () => {
    expect(vietnamClock(new Date('2026-10-13T16:59:00Z'))).toEqual({ day: '2026-10-13', minuteOfDay: 23 * 60 + 59 });
    expect(vietnamClock(new Date('2026-10-13T17:00:00Z'))).toEqual({ day: '2026-10-14', minuteOfDay: 0 });
  });
});
