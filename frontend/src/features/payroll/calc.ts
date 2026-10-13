import type { PayrollConfig, PayrollDay, PayrollEntry } from './types';

export interface DayBonus {
  /** YYYY-MM-DD */
  day: string;
  commission: number;
  bonus: number;
}

export interface PayrollResult {
  /** Công chuẩn của tháng */
  standardDays: number;
  /** Tổng hoa hồng (doanh số) cả tháng */
  commission: number;
  /** Lương cứng áp dụng (theo bậc, hoặc mức cao khi đạt mốc) */
  base: number;
  baseSource: 'level' | 'top';
  workDays: number;
  /** Lương cứng thực nhận = lương cứng / công chuẩn × công thực tế */
  baseSalary: number;
  dailyBonus: number;
  /** Các ngày đạt mốc thưởng ngày */
  bonusDays: DayBonus[];
  monthlyBonus: number;
  /** 10% (hoặc tỷ lệ cấu hình) phần hoa hồng vượt mốc */
  overBonus: number;
  adjustment: number;
  total: number;
}

/** Công chuẩn = số ngày trong tháng − offset (31 → 27, 30 → 26, 29 → 25, 28 → 24) */
export function standardDays(daysInMonth: number, offset: number): number {
  return Math.max(1, daysInMonth - offset);
}

/** Thưởng của một ngày: mốc cao nhất mà hoa hồng ngày đạt được (không cộng dồn các mốc) */
export function dayBonus(commission: number, tiers: PayrollConfig['dailyBonuses']): number {
  let best = 0;
  let bestThreshold = -1;
  for (const tier of tiers) {
    if (tier.threshold > 0 && commission >= tier.threshold && tier.threshold > bestThreshold) {
      best = tier.bonus;
      bestThreshold = tier.threshold;
    }
  }
  return best;
}

export function computePayroll(input: {
  config: PayrollConfig;
  daysInMonth: number;
  daily: Record<string, PayrollDay>;
  entry: PayrollEntry;
}): PayrollResult {
  const { config, daysInMonth, daily, entry } = input;
  const std = standardDays(daysInMonth, config.standardDaysOffset);

  const days = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  const commission = days.reduce((sum, [, d]) => sum + d.commission, 0);

  const levelBase = config.levels[Math.min(entry.level, config.levels.length - 1)]?.base ?? 0;
  const reachedTop = config.topBase.threshold > 0 && commission >= config.topBase.threshold;
  const base = reachedTop ? config.topBase.base : levelBase;

  const workDays = entry.workDays ?? 0;
  const baseSalary = Math.round((base / std) * workDays);

  const bonusDays: DayBonus[] = [];
  for (const [day, d] of days) {
    const bonus = dayBonus(d.commission, config.dailyBonuses);
    if (bonus > 0) bonusDays.push({ day, commission: d.commission, bonus });
  }
  const dailyBonus = bonusDays.reduce((sum, d) => sum + d.bonus, 0);

  const monthlyBonus =
    config.monthlyBonus.threshold > 0 && commission >= config.monthlyBonus.threshold
      ? config.monthlyBonus.bonus
      : 0;

  const overBonus = Math.round(
    (Math.max(0, commission - config.overRate.threshold) * config.overRate.percent) / 100,
  );

  const total = baseSalary + dailyBonus + monthlyBonus + overBonus + entry.adjustment;

  return {
    standardDays: std,
    commission,
    base,
    baseSource: reachedTop ? 'top' : 'level',
    workDays,
    baseSalary,
    dailyBonus,
    bonusDays,
    monthlyBonus,
    overBonus,
    adjustment: entry.adjustment,
    total,
  };
}
