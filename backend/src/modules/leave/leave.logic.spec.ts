import { DEFAULT_LEAVE_CONFIG, isLateWeek, isRealDay, limitForDay, sanitizeLeaveConfig, weekdayOf } from './leave.logic.js';

describe('leave.logic', () => {
  it('xác định thứ trong tuần', () => {
    expect(weekdayOf('2026-10-15')).toBe(4); // Thứ 5
    expect(weekdayOf('2026-10-18')).toBe(0); // Chủ nhật
  });

  it('T2-T5 là đầu tuần, T6-CN là cuối tuần', () => {
    expect(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map(isLateWeek)).toEqual([false, false, false, false]);
    expect(['2026-10-16', '2026-10-17', '2026-10-18'].map(isLateWeek)).toEqual([true, true, true]);
  });

  it('giới hạn theo ngày ưu tiên hơn mặc định theo nhóm', () => {
    expect(limitForDay('2026-10-13', DEFAULT_LEAVE_CONFIG)).toBe(3);
    expect(limitForDay('2026-10-17', DEFAULT_LEAVE_CONFIG)).toBe(2);
    expect(limitForDay('2026-10-17', DEFAULT_LEAVE_CONFIG, 0)).toBe(0);
    expect(limitForDay('2026-10-13', DEFAULT_LEAVE_CONFIG, null)).toBe(3);
  });

  it('làm sạch cấu hình', () => {
    expect(sanitizeLeaveConfig({ earlyMax: 5, lateMax: -2 })).toEqual({ earlyMax: 5, lateMax: 0 });
    expect(sanitizeLeaveConfig('rác')).toEqual(DEFAULT_LEAVE_CONFIG);
  });

  it('nhận biết ngày không tồn tại', () => {
    expect(isRealDay('2026-02-30')).toBe(false);
    expect(isRealDay('2026-02-28')).toBe(true);
  });
});
