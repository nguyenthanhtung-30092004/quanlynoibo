import { describe, expect, it } from 'vitest';
import { computePayroll, dayBonus, standardDays } from './calc';
import type { PayrollConfig, PayrollEntry } from './types';

const config: PayrollConfig = {
  levels: [
    { label: 'Bậc 1', note: '', base: 4_200_000 },
    { label: 'Bậc 2', note: '', base: 4_400_000 },
  ],
  standardDaysOffset: 4,
  topBase: { threshold: 55_000_000, base: 5_000_000 },
  dailyBonuses: [
    { threshold: 2_000_000, bonus: 50_000 },
    { threshold: 2_500_000, bonus: 100_000 },
  ],
  monthlyBonus: { threshold: 30_000_000, bonus: 100_000 },
  overRate: { threshold: 30_000_000, percent: 10 },
};

const entry = (over: Partial<PayrollEntry> = {}): PayrollEntry => ({
  level: 0,
  workDays: 27,
  adjustment: 0,
  note: '',
  ...over,
});

describe('standardDays', () => {
  it('công chuẩn = số ngày − 4', () => {
    expect(standardDays(31, 4)).toBe(27);
    expect(standardDays(30, 4)).toBe(26);
    expect(standardDays(29, 4)).toBe(25);
    expect(standardDays(28, 4)).toBe(24);
  });
});

describe('dayBonus', () => {
  it('chỉ tính mốc cao nhất, không cộng dồn', () => {
    expect(dayBonus(1_999_999, config.dailyBonuses)).toBe(0);
    expect(dayBonus(2_000_000, config.dailyBonuses)).toBe(50_000);
    expect(dayBonus(2_499_999, config.dailyBonuses)).toBe(50_000);
    expect(dayBonus(2_500_000, config.dailyBonuses)).toBe(100_000);
    expect(dayBonus(9_000_000, config.dailyBonuses)).toBe(100_000);
  });
});

describe('computePayroll', () => {
  it('đủ công, không có doanh số: chỉ có lương cứng', () => {
    const r = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry() });
    expect(r.baseSalary).toBe(4_200_000);
    expect(r.total).toBe(4_200_000);
  });

  it('lương cứng tính theo công thực tế (31 ngày: chia 27)', () => {
    const r = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry({ workDays: 20 }) });
    expect(r.baseSalary).toBe(Math.round((4_200_000 / 27) * 20));
  });

  it('làm hơn công chuẩn thì được hơn', () => {
    const r = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry({ workDays: 29 }) });
    expect(r.baseSalary).toBeGreaterThan(4_200_000);
  });

  it('chưa nhập công thì lương cứng bằng 0', () => {
    const r = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry({ workDays: null }) });
    expect(r.baseSalary).toBe(0);
  });

  it('thưởng ngày + thưởng tháng + 10% phần vượt', () => {
    const daily = {
      '2026-10-01': { commission: 2_200_000, tickets: 4 },
      '2026-10-02': { commission: 2_600_000, tickets: 5 },
      '2026-10-03': { commission: 1_900_000, tickets: 3 },
      '2026-10-04': { commission: 28_000_000, tickets: 30 },
    };
    const r = computePayroll({ config, daysInMonth: 31, daily, entry: entry() });
    expect(r.commission).toBe(34_700_000);
    expect(r.bonusDays.map((d) => d.bonus)).toEqual([50_000, 100_000, 100_000]);
    expect(r.dailyBonus).toBe(250_000);
    expect(r.monthlyBonus).toBe(100_000);
    expect(r.overBonus).toBe(470_000);
    expect(r.total).toBe(4_200_000 + 250_000 + 100_000 + 470_000);
  });

  it('chưa tới mốc 30 triệu thì không có thưởng tháng và phần vượt', () => {
    const daily = { '2026-10-01': { commission: 29_999_999, tickets: 9 } };
    const r = computePayroll({ config, daysInMonth: 31, daily, entry: entry() });
    expect(r.monthlyBonus).toBe(0);
    expect(r.overBonus).toBe(0);
  });

  it('đạt 55 triệu thì lương cứng là 5 triệu thay cho bậc', () => {
    const daily = { '2026-10-01': { commission: 55_000_000, tickets: 99 } };
    const r = computePayroll({ config, daysInMonth: 31, daily, entry: entry({ level: 1 }) });
    expect(r.baseSource).toBe('top');
    expect(r.base).toBe(5_000_000);
    expect(r.baseSalary).toBe(5_000_000);
  });

  it('chưa đạt 55 triệu thì theo bậc đã chọn', () => {
    const daily = { '2026-10-01': { commission: 54_999_999, tickets: 99 } };
    const r = computePayroll({ config, daysInMonth: 31, daily, entry: entry({ level: 1 }) });
    expect(r.baseSource).toBe('level');
    expect(r.base).toBe(4_400_000);
  });

  it('điều chỉnh tay được cộng / trừ vào tổng', () => {
    const plus = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry({ adjustment: 300_000 }) });
    const minus = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry({ adjustment: -200_000 }) });
    expect(plus.total).toBe(4_500_000);
    expect(minus.total).toBe(4_000_000);
  });
});
