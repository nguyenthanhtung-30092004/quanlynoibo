import {
  getBusinessDate,
  isOrderCreationLocked,
  startOfBusinessDay,
  startOfNextBusinessDay,
} from './order-time-lock.js';

// Giờ VN = UTC+7
const vn = (iso: string) => new Date(`${iso}+07:00`);

describe('isOrderCreationLocked', () => {
  it.each([
    ['2026-10-08T22:29:59', false],
    ['2026-10-08T22:30:00', true],
    ['2026-10-08T23:30:00', true],
    ['2026-10-09T00:00:00', true],
    ['2026-10-09T04:29:59', true],
    ['2026-10-09T04:30:00', false],
    ['2026-10-09T12:00:00', false],
  ])('%s -> khóa=%s', (time, locked) => {
    expect(isOrderCreationLocked(vn(time))).toBe(locked);
  });

  it('tính theo giờ VN, không phụ thuộc múi giờ máy chủ', () => {
    // 16:00 UTC = 23:00 VN -> khóa
    expect(isOrderCreationLocked(new Date('2026-10-08T16:00:00Z'))).toBe(true);
    // 02:00 UTC = 09:00 VN -> mở
    expect(isOrderCreationLocked(new Date('2026-10-08T02:00:00Z'))).toBe(false);
  });
});

describe('business date helpers', () => {
  it('getBusinessDate lấy ngày theo giờ VN', () => {
    expect(getBusinessDate(new Date('2026-10-08T17:30:00Z'))).toBe('2026-10-09');
  });

  it('khoảng ngày dài đúng 24h', () => {
    const from = startOfBusinessDay('2026-10-08');
    const to = startOfNextBusinessDay('2026-10-08');
    expect(to.getTime() - from.getTime()).toBe(86_400_000);
    expect(from.toISOString()).toBe('2026-10-07T17:00:00.000Z');
  });
});
