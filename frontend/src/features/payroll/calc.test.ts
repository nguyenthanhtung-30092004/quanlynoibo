import { describe, expect, it } from 'vitest';
import { computePayroll, dayBonus, monthLateMinutes, monthOvertimeHours, standardDays } from './calc';
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
  latePenaltyPerMinute: 0,
  overtimePerHour: 0,
  // 0 để các phép tính khác không bị lẫn khoản bảo hiểm; phần bảo hiểm có bộ test riêng bên dưới
  insuranceDefault: 0,
};

const entry = (over: Partial<PayrollEntry> = {}): PayrollEntry => ({
  level: 0,
  workDays: 27,
  adjustment: 0,
  note: '',
  insurance: null,
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

describe('bảo hiểm', () => {
  const withDefault = { ...config, insuranceDefault: 567_000 };

  it('chưa có số riêng thì trừ theo mức mặc định', () => {
    const r = computePayroll({ config: withDefault, daysInMonth: 31, daily: {}, entry: entry() });
    expect(r.insurance).toBe(567_000);
    expect(r.total).toBe(4_200_000 - 567_000);
  });

  it('số riêng của tháng thắng mức mặc định', () => {
    const r = computePayroll({ config: withDefault, daysInMonth: 31, daily: {}, entry: entry({ insurance: 700_000 }) });
    expect(r.insurance).toBe(700_000);
    expect(r.total).toBe(4_200_000 - 700_000);
  });

  it('đổi mức mặc định không đổi tháng đã chốt số riêng', () => {
    const saved = entry({ insurance: 567_000 });
    const raised = { ...config, insuranceDefault: 678_000 };
    const july = computePayroll({ config: raised, daysInMonth: 31, daily: {}, entry: saved });
    const august = computePayroll({ config: raised, daysInMonth: 31, daily: {}, entry: entry() });
    expect(july.insurance).toBe(567_000);
    expect(august.insurance).toBe(678_000);
  });

  it('chốt 0 là không trừ, dù mức mặc định có số', () => {
    const r = computePayroll({ config: withDefault, daysInMonth: 31, daily: {}, entry: entry({ insurance: 0 }) });
    expect(r.insurance).toBe(0);
    expect(r.total).toBe(4_200_000);
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

  it('vào muộn: trừ số phút muộn × mức trừ mỗi phút khỏi tổng lương', () => {
    const late = { ...config, latePenaltyPerMinute: 1_000 };
    const r = computePayroll({ config: late, daysInMonth: 31, daily: {}, entry: entry(), lateMinutes: 45 });
    expect(r.lateMinutes).toBe(45);
    expect(r.latePenalty).toBe(45_000);
    expect(r.total).toBe(4_200_000 - 45_000);
  });

  it('mức trừ bằng 0 hoặc không có phút muộn thì không trừ gì', () => {
    const free = computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry(), lateMinutes: 120 });
    expect(free.latePenalty).toBe(0);
    expect(free.total).toBe(4_200_000);
    const onTime = computePayroll({
      config: { ...config, latePenaltyPerMinute: 1_000 },
      daysInMonth: 31,
      daily: {},
      entry: entry(),
    });
    expect(onTime.latePenalty).toBe(0);
    expect(onTime.total).toBe(4_200_000);
  });

  it('trừ muộn cộng được với điều chỉnh tay', () => {
    const late = { ...config, latePenaltyPerMinute: 2_000 };
    const r = computePayroll({
      config: late,
      daysInMonth: 31,
      daily: {},
      entry: entry({ adjustment: 100_000 }),
      lateMinutes: 10,
    });
    expect(r.total).toBe(4_200_000 - 20_000 + 100_000);
  });
});

describe('monthLateMinutes', () => {
  const cell = (lateMinutes: number, over: { overridden?: boolean; status?: 'done' | 'working' } = {}) => ({
    lateMinutes,
    overridden: over.overridden ?? false,
    status: over.status ?? ('done' as const),
  });

  it('cộng phút muộn của các ngày đã quẹt đủ vào / ra', () => {
    expect(monthLateMinutes({ '2026-10-01': cell(5), '2026-10-02': cell(0), '2026-10-03': cell(20) })).toBe(25);
  });

  it('bỏ qua ngày Admin đã chỉnh tay và ngày chưa quẹt ra', () => {
    expect(
      monthLateMinutes({
        '2026-10-01': cell(30, { overridden: true }),
        '2026-10-02': cell(15, { status: 'working' }),
        '2026-10-03': cell(10),
      }),
    ).toBe(10);
  });

  it('ngày muộn từ 30 phút đã bị trừ nửa công nên không trừ tiền vào muộn nữa', () => {
    expect(monthLateMinutes({ '2026-10-01': cell(29), '2026-10-02': cell(30), '2026-10-03': cell(90) })).toBe(29);
  });

  it('không có ngày nào thì là 0', () => {
    expect(monthLateMinutes({})).toBe(0);
  });
});

describe('tăng ca', () => {
  it('cộng giờ tăng ca của từng ngày trong tháng', () => {
    expect(monthOvertimeHours({ '2026-10-01': { overtimeHours: 1.5 }, '2026-10-02': { overtimeHours: 0 }, '2026-10-03': { overtimeHours: 3 } })).toBe(4.5);
    expect(monthOvertimeHours({})).toBe(0);
  });

  it('tiền tăng ca = số giờ × mức mỗi giờ, cộng vào tổng lương', () => {
    const r = computePayroll({
      config: { ...config, overtimePerHour: 25_000 },
      daysInMonth: 31,
      daily: {},
      entry: entry({ workDays: 0 }),
      overtimeHours: 6.5,
    });
    expect(r).toMatchObject({ overtimeHours: 6.5, overtimePay: 162_500 });
    expect(r.total).toBe(162_500);
  });

  it('mức tăng ca 0 thì không cộng tiền; không truyền giờ thì coi như 0', () => {
    expect(computePayroll({ config, daysInMonth: 31, daily: {}, entry: entry(), overtimeHours: 5 }).overtimePay).toBe(0);
    expect(
      computePayroll({ config: { ...config, overtimePerHour: 25_000 }, daysInMonth: 31, daily: {}, entry: entry() }).overtimePay,
    ).toBe(0);
  });
});
