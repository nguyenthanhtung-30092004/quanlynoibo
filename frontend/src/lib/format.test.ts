import { describe, expect, it } from 'vitest';
import { formatDateTimeShort, formatDateVN } from './format';
import { getVnToday, isOrderingLocked } from './time';

describe('format', () => {
  it('formatDateVN đổi YYYY-MM-DD sang DD/MM/YYYY', () => {
    expect(formatDateVN('2026-10-08')).toBe('08/10/2026');
    expect(formatDateVN('abc')).toBe('abc');
  });

  it('formatDateTimeShort dùng giờ Việt Nam', () => {
    // 01:05 UTC = 08:05 VN
    expect(formatDateTimeShort('2026-10-08T01:05:00Z')).toBe('08:05 - 08/10');
  });
});

describe('time', () => {
  it.each([
    ['2026-10-08T14:59:00Z', false], // 21:59 VN
    ['2026-10-08T15:00:00Z', true], // 22:00 VN
    ['2026-10-08T23:59:00Z', true], // 06:59 VN
    ['2026-10-09T00:00:00Z', false], // 07:00 VN
  ])('isOrderingLocked(%s) = %s', (iso, expected) => {
    expect(isOrderingLocked(new Date(iso))).toBe(expected);
  });

  it('getVnToday lấy ngày theo giờ VN', () => {
    expect(getVnToday(new Date('2026-10-08T17:30:00Z'))).toBe('2026-10-09');
  });
});
