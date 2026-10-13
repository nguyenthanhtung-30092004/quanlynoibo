import {
  DEFAULT_ATTENDANCE_CONFIG,
  congFromMinutes,
  distanceMeters,
  evaluateBeat,
  isMobileUserAgent,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
} from './attendance.logic.js';

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';

// Hồ Gươm, Hà Nội
const OFFICE = { lat: 21.0285, lng: 105.8542 };
const config: AttendanceConfig = { ...DEFAULT_ATTENDANCE_CONFIG, workplace: OFFICE };

const beat = (over: Partial<Parameters<typeof evaluateBeat>[0]> = {}) =>
  evaluateBeat({ config, role: 'STAFF', userAgent: DESKTOP, lat: OFFICE.lat, lng: OFFICE.lng, accuracy: 30, ...over });

describe('distanceMeters', () => {
  it('cùng một điểm thì bằng 0', () => {
    expect(distanceMeters(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
  });

  it('0,001 độ vĩ ≈ 111 mét', () => {
    const d = distanceMeters(21.0285, 105.8542, 21.0295, 105.8542);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
});

describe('isMobileUserAgent', () => {
  it('nhận ra điện thoại và máy tính bảng, không nhận nhầm máy tính', () => {
    expect(isMobileUserAgent(IPHONE)).toBe(true);
    expect(isMobileUserAgent(ANDROID)).toBe(true);
    expect(isMobileUserAgent(DESKTOP)).toBe(false);
    expect(isMobileUserAgent(undefined)).toBe(false);
  });
});

describe('evaluateBeat', () => {
  it('đúng vị trí, máy tính, nhân viên: được tính', () => {
    expect(beat()).toEqual({ counted: true, reason: 'ok', distanceM: 0 });
  });

  it('Admin không chấm công', () => {
    expect(beat({ role: 'ADMIN' }).reason).toBe('not_staff');
  });

  it('điện thoại không tính', () => {
    expect(beat({ userAgent: IPHONE }).reason).toBe('mobile');
    expect(beat({ userAgent: ANDROID }).counted).toBe(false);
  });

  it('công ty chưa cài vị trí thì không ai được tính', () => {
    const r = evaluateBeat({
      config: DEFAULT_ATTENDANCE_CONFIG,
      role: 'STAFF',
      userAgent: DESKTOP,
      lat: OFFICE.lat,
      lng: OFFICE.lng,
      accuracy: 10,
    });
    expect(r.reason).toBe('not_configured');
  });

  it('không có vị trí (từ chối định vị) thì không tính', () => {
    expect(beat({ lat: undefined, lng: undefined }).reason).toBe('no_location');
    expect(beat({ lat: null, lng: null }).reason).toBe('no_location');
  });

  it('ở xa công ty thì không tính, kèm khoảng cách', () => {
    const r = beat({ lat: 21.0385, lng: OFFICE.lng }); // ~1,1 km
    expect(r.reason).toBe('out_of_range');
    expect(r.distanceM).toBeGreaterThan(1000);
  });

  it('sát mép bán kính vẫn tính, vượt bán kính thì không', () => {
    // ~111 mét (< 150) và ~167 mét (> 150)
    expect(beat({ lat: 21.0295 }).counted).toBe(true);
    expect(beat({ lat: 21.03 }).counted).toBe(false);
  });

  it('định vị quá thô (sai số lớn) thì không tin', () => {
    expect(beat({ accuracy: 5000 }).reason).toBe('low_accuracy');
    expect(beat({ accuracy: 300 }).counted).toBe(true);
  });
});

describe('congFromMinutes', () => {
  it('từ 7 tiếng (420 phút) trở lên được 1 công', () => {
    expect(congFromMinutes(419, config)).toBe(0);
    expect(congFromMinutes(420, config)).toBe(1);
    expect(congFromMinutes(900, config)).toBe(1);
  });

  it('mặc định không có nửa công, bật nửa công thì tính', () => {
    expect(congFromMinutes(250, config)).toBe(0);
    const half = { ...config, halfMinutes: 210 };
    expect(congFromMinutes(209, half)).toBe(0);
    expect(congFromMinutes(210, half)).toBe(0.5);
    expect(congFromMinutes(420, half)).toBe(1);
  });
});

describe('sanitizeAttendanceConfig', () => {
  it('thiếu hoặc rác thì lấy mặc định', () => {
    expect(sanitizeAttendanceConfig(null)).toEqual(DEFAULT_ATTENDANCE_CONFIG);
    expect(sanitizeAttendanceConfig('abc')).toEqual(DEFAULT_ATTENDANCE_CONFIG);
  });

  it('chặn toạ độ và số vô lý', () => {
    const c = sanitizeAttendanceConfig({
      workplace: { lat: 200, lng: 'x' },
      radiusM: 1,
      maxAccuracyM: 99999,
      fullMinutes: 5000,
      halfMinutes: 9999,
    });
    expect(c.workplace).toEqual({ lat: null, lng: null });
    expect(c.radiusM).toBe(10);
    expect(c.maxAccuracyM).toBe(5000);
    expect(c.fullMinutes).toBe(1440);
    expect(c.halfMinutes).toBeLessThanOrEqual(c.fullMinutes);
  });

  it('giữ nguyên toạ độ hợp lệ', () => {
    const c = sanitizeAttendanceConfig({ workplace: OFFICE, radiusM: 200 });
    expect(c.workplace).toEqual(OFFICE);
    expect(c.radiusM).toBe(200);
  });
});

describe('vietnamClock', () => {
  it('đổi sang giờ Việt Nam (UTC+7), qua ngày đúng', () => {
    expect(vietnamClock(new Date('2026-10-13T16:59:00Z'))).toEqual({ day: '2026-10-13', minuteOfDay: 23 * 60 + 59 });
    expect(vietnamClock(new Date('2026-10-13T17:00:00Z'))).toEqual({ day: '2026-10-14', minuteOfDay: 0 });
  });
});
