import {
  DEFAULT_LEAVE_CONFIG,
  findAutoUrgentAbsences,
  isLateWeek,
  isRealDay,
  limitForDay,
  sanitizeLeaveConfig,
  weekdayOf,
} from './leave.logic.js';

describe('findAutoUrgentAbsences', () => {
  const staff = [
    { id: 1, fullName: 'An', since: '2026-01-01' },
    { id: 2, fullName: 'Bình', since: '2026-01-01' },
    { id: 3, fullName: 'Cường', since: '2026-10-20' },
  ];
  const set = (...ids: number[]) => new Set(ids);
  const run = (over: Partial<Parameters<typeof findAutoUrgentAbsences>[0]> = {}) =>
    findAutoUrgentAbsences({
      days: ['2026-10-18', '2026-10-21', '2026-10-24'],
      today: '2026-10-25',
      staff,
      punched: new Map([
        ['2026-10-18', set(1, 2)],
        ['2026-10-21', set(1)],
        ['2026-10-24', set(1, 2, 3)],
      ]),
      registered: new Map(),
      ...over,
    });

  it('không quẹt và chưa đăng ký nghỉ thì tính nghỉ đột xuất', () => {
    expect(run().get('2026-10-21')).toContainEqual({ userId: 2, fullName: 'Bình' });
  });

  it('ngày ai cũng đi làm thì không có ai nghỉ', () => {
    expect(run().has('2026-10-24')).toBe(false);
  });

  it('đã đăng ký nghỉ trước thì không tính nghỉ đột xuất', () => {
    const result = run({ registered: new Map([['2026-10-21', set(2)]]) });
    expect(result.get('2026-10-21')).not.toContainEqual({ userId: 2, fullName: 'Bình' });
  });

  it('chưa có tài khoản vào ngày đó thì không tính nghỉ', () => {
    // Cường tạo tài khoản 20/10, nên 18/10 không bị tính dù không quẹt; 21/10 thì có
    expect(run().get('2026-10-18')).toBeUndefined();
    expect(run().get('2026-10-21')).toEqual([
      { userId: 2, fullName: 'Bình' },
      { userId: 3, fullName: 'Cường' },
    ]);
  });

  it('ngày không ai quẹt (cả tiệm nghỉ) thì bỏ qua', () => {
    const result = run({ punched: new Map([['2026-10-18', set(1, 2)]]) });
    expect(result.has('2026-10-21')).toBe(false);
  });

  it('hôm nay và tương lai chưa xét', () => {
    const result = run({
      days: ['2026-10-25', '2026-10-26'],
      punched: new Map([
        ['2026-10-25', set(1)],
        ['2026-10-26', set(1)],
      ]),
    });
    expect(result.size).toBe(0);
  });
});

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
