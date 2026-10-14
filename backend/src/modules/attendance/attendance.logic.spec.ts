import {
  DEFAULT_ATTENDANCE_CONFIG,
  congFromMinutes,
  evaluateBeat,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
} from './attendance.logic.js';

describe('evaluateBeat', () => {
  it('nhân viên đăng nhập: được tính, không cần thao tác', () => {
    expect(evaluateBeat({ role: 'STAFF' })).toEqual({ counted: true, reason: 'ok' });
  });

  it('Admin không chấm công', () => {
    expect(evaluateBeat({ role: 'ADMIN' })).toEqual({ counted: false, reason: 'not_staff' });
  });
});

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

describe('vietnamClock', () => {
  it('đổi sang giờ Việt Nam (UTC+7), qua ngày đúng', () => {
    expect(vietnamClock(new Date('2026-10-13T16:59:00Z'))).toEqual({ day: '2026-10-13', minuteOfDay: 23 * 60 + 59 });
    expect(vietnamClock(new Date('2026-10-13T17:00:00Z'))).toEqual({ day: '2026-10-14', minuteOfDay: 0 });
  });
});
