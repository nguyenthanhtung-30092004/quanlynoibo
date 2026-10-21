import {
  DEFAULT_ATTENDANCE_CONFIG,
  SHIFTS,
  congForShift,
  congFromMinutes,
  evaluateDay,
  isAutoCloseDue,
  overtimeHoursFromMinutes,
  resolveShift,
  resolveShiftForDay,
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

  it('quên quẹt ra, hệ thống đã tự chấm ra 23:59: không tính công', () => {
    const r = evaluateDay(
      { firstAt: vn('05:30'), lastAt: vn('05:30'), punchCount: 1, isToday: false, autoClosed: true },
      DEFAULT_ATTENDANCE_CONFIG,
    );
    expect(r).toMatchObject({ status: 'auto_out', cong: 0, minutes: 0, shift: null });
  });

  it('đã bị tự chấm ra nhưng sau đó có lượt ra thật (chấm bù): tính công bình thường', () => {
    const r = evaluateDay(
      { firstAt: vn('06:00'), lastAt: vn('15:30'), punchCount: 2, isToday: false, autoClosed: true },
      DEFAULT_ATTENDANCE_CONFIG,
    );
    expect(r).toMatchObject({ status: 'done', cong: 1 });
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

describe('isAutoCloseDue', () => {
  it('tới 23:59 mới tự chấm ra hôm nay; ngày đã qua thì luôn đến hạn; ngày mai chưa', () => {
    const at = (minuteOfDay: number) => ({ day: '2026-10-20', minuteOfDay });
    expect(isAutoCloseDue('2026-10-20', at(23 * 60 + 58))).toBe(false);
    expect(isAutoCloseDue('2026-10-20', at(23 * 60 + 59))).toBe(true);
    expect(isAutoCloseDue('2026-10-19', at(8 * 60))).toBe(true);
    expect(isAutoCloseDue('2026-10-21', at(23 * 60 + 59))).toBe(false);
  });
});

describe('vietnamClock', () => {
  it('đổi sang giờ Việt Nam (UTC+7), qua ngày đúng', () => {
    expect(vietnamClock(new Date('2026-10-13T16:59:00Z'))).toEqual({ day: '2026-10-13', minuteOfDay: 23 * 60 + 59 });
    expect(vietnamClock(new Date('2026-10-13T17:00:00Z'))).toEqual({ day: '2026-10-14', minuteOfDay: 0 });
  });
});

describe('overtimeHoursFromMinutes', () => {
  it('dưới 1 tiếng thì không tính tăng ca', () => {
    expect(overtimeHoursFromMinutes(0)).toBe(0);
    expect(overtimeHoursFromMinutes(59)).toBe(0);
  });

  it('các mốc 1 / 1,5 / 2 / 2,5 / 3 tiếng, phần lẻ làm tròn xuống nửa giờ', () => {
    expect(overtimeHoursFromMinutes(60)).toBe(1);
    expect(overtimeHoursFromMinutes(75)).toBe(1); // 1g15 -> 1
    expect(overtimeHoursFromMinutes(89)).toBe(1);
    expect(overtimeHoursFromMinutes(90)).toBe(1.5);
    expect(overtimeHoursFromMinutes(104)).toBe(1.5);
    expect(overtimeHoursFromMinutes(105)).toBe(2); // 1g45 -> 2
    expect(overtimeHoursFromMinutes(120)).toBe(2);
    expect(overtimeHoursFromMinutes(150)).toBe(2.5);
    expect(overtimeHoursFromMinutes(165)).toBe(3);
  });

  it('tối đa 3 tiếng, phần dư không tính', () => {
    expect(overtimeHoursFromMinutes(180)).toBe(3);
    expect(overtimeHoursFromMinutes(400)).toBe(3);
  });
});

describe('resolveShiftForDay', () => {
  it('Admin chọn tay thì dùng đúng ca đó, không mập mờ', () => {
    const c = resolveShiftForDay(hm(6, 5), hm(16, 45), { forcedStart: hm(7) });
    expect(c).toMatchObject({ source: 'forced', alternative: null });
    expect(c.shift.label).toBe('7h - 16h30');
  });

  it('ca mặc định của nhân viên được dùng khi giờ vào hợp lý', () => {
    const c = resolveShiftForDay(hm(6, 5), hm(16, 45), { defaultStart: hm(6) });
    expect(c.source).toBe('default');
    expect(c.shift.label).toBe('6h - 15h30');
  });

  it('ca mặc định quá xa giờ vào thì bỏ qua và tự đoán', () => {
    const c = resolveShiftForDay(hm(13, 30), hm(22), { defaultStart: hm(5) });
    expect(c.source).toBe('auto');
    expect(c.shift.label).toBe('13h30 - 22h');
  });

  it('ra đúng giờ một ca thì lấy ca đó, không có tăng ca', () => {
    const c = resolveShiftForDay(hm(6, 5), hm(15, 30));
    expect(c.shift.label).toBe('6h - 15h30');
    expect(c.alternative).toBeNull();
  });

  it('giờ ra lệch hẳn mọi ca thì dựa vào giờ vào: vào 6h ra 16h45 là ca 6h tăng ca', () => {
    const c = resolveShiftForDay(hm(6, 5), hm(16, 45));
    expect(c.shift.label).toBe('6h - 15h30');
    // cách hiểu khác: ca 7h ra 16h45 chỉ ở lại 15 phút, không tăng ca => đánh dấu để Admin xem lại
    expect(c.alternative?.shift.label).toBe('7h - 16h30');
    expect(c.alternative?.overtimeHours).toBe(0);
  });

  it('vào 6h ra đúng 16h30: nghiêng về ca 7h (không tăng ca) nhưng đánh dấu mập mờ', () => {
    const c = resolveShiftForDay(hm(6, 5), hm(16, 30));
    expect(c.shift.label).toBe('7h - 16h30');
    expect(c.alternative?.shift.label).toBe('6h - 15h30');
    expect(c.alternative?.overtimeHours).toBe(1);
  });
});

describe('evaluateDay: tăng ca', () => {
  const day = (inAt: string, outAt: string) =>
    evaluateDay(
      { firstAt: vn(inAt), lastAt: vn(outAt), punchCount: 2, isToday: false },
      DEFAULT_ATTENDANCE_CONFIG,
    );

  it('ca 6h - 15h30 ra 17h: ở lại 90 phút, tăng ca 1,5 giờ, công vẫn tối đa 1', () => {
    const r = day('06:00', '17:00');
    expect(r).toMatchObject({ cong: 1, overtimeMinutes: 90, overtimeHours: 1.5 });
  });

  it('ra đúng giờ hoặc về sớm thì không có tăng ca', () => {
    expect(day('06:00', '15:30')).toMatchObject({ overtimeMinutes: 0, overtimeHours: 0 });
    expect(day('06:00', '14:00')).toMatchObject({ overtimeHours: 0 });
  });

  it('ở lại dưới 1 tiếng thì chưa tính tăng ca', () => {
    expect(day('06:00', '16:00')).toMatchObject({ overtimeMinutes: 30, overtimeHours: 0 });
  });

  it('quên quẹt ra (hệ thống tự chấm 23:59) thì không có tăng ca', () => {
    const r = evaluateDay(
      { firstAt: vn('06:00'), lastAt: vn('06:00'), punchCount: 1, isToday: false, autoClosed: true },
      DEFAULT_ATTENDANCE_CONFIG,
    );
    expect(r).toMatchObject({ overtimeHours: 0, overtimeMinutes: 0 });
  });

  it('Admin chọn ca 7h cho ngày vào 6h ra 16h45: không tăng ca', () => {
    const r = evaluateDay(
      { firstAt: vn('06:05'), lastAt: vn('16:45'), punchCount: 2, isToday: false, forcedShiftStart: hm(7) },
      DEFAULT_ATTENDANCE_CONFIG,
    );
    expect(r).toMatchObject({ overtimeHours: 0, shiftSource: 'forced' });
  });
});
