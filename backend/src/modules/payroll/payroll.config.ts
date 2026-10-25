/** Một bậc lương cứng (theo thâm niên) */
export interface PayrollLevel {
  label: string;
  note: string;
  base: number;
}

/** Một mốc thưởng: đạt từ `threshold` thì được `bonus` */
export interface PayrollTier {
  threshold: number;
  bonus: number;
}

/**
 * Công thức tính lương. Mọi con số do Admin điền tay trên trang Bảng lương.
 * "Doanh số" trong quy chế chính là hoa hồng (lãi nhà xe trả khi bán được vé).
 */
export interface PayrollConfig {
  levels: PayrollLevel[];
  /** Công chuẩn của tháng = số ngày trong tháng − số này (31 ngày → 27 công) */
  standardDaysOffset: number;
  /** Đạt hoa hồng tháng từ `threshold` thì lương cứng của tháng là `base` (thay cho bậc) */
  topBase: { threshold: number; base: number };
  /** Thưởng ngày: mỗi ngày chỉ tính một mốc cao nhất đạt được */
  dailyBonuses: PayrollTier[];
  /** Thưởng khi tổng hoa hồng cả tháng đạt mốc */
  monthlyBonus: PayrollTier;
  /** Hoa hồng vượt `threshold` thì được `percent`% phần vượt */
  overRate: { threshold: number; percent: number };
  /** Vào ca muộn: trừ bấy nhiêu đồng cho mỗi phút muộn (0 = không trừ) */
  latePenaltyPerMinute: number;
  /** Tăng ca: mỗi giờ tăng ca được bấy nhiêu đồng (0 = không tính) */
  overtimePerHour: number;
}

/** Phần nhập tay của từng nhân viên trong một tháng */
export interface PayrollEntry {
  /** Vị trí bậc trong `levels` (bắt đầu từ 0) */
  level: number;
  /** Số công thực tế; null = chưa nhập */
  workDays: number | null;
  /** Cộng / trừ thêm bằng tay (âm = trừ) */
  adjustment: number;
  note: string;
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  levels: [
    { label: 'Bậc 1', note: 'Làm việc dưới 1 năm', base: 4_200_000 },
    { label: 'Bậc 2', note: 'Làm việc trên 1 năm', base: 4_400_000 },
    { label: 'Bậc 3', note: 'Làm việc trên 2 năm', base: 4_600_000 },
    { label: 'Bậc 4', note: 'Làm việc trên 3 năm', base: 4_800_000 },
  ],
  standardDaysOffset: 4,
  topBase: { threshold: 55_000_000, base: 5_000_000 },
  dailyBonuses: [
    { threshold: 2_000_000, bonus: 50_000 },
    { threshold: 2_500_000, bonus: 100_000 },
  ],
  monthlyBonus: { threshold: 30_000_000, bonus: 100_000 },
  overRate: { threshold: 30_000_000, percent: 10 },
  latePenaltyPerMinute: 25_000,
  overtimePerHour: 25_000,
};

export const EMPTY_PAYROLL_ENTRY: PayrollEntry = {
  level: 0,
  workDays: null,
  adjustment: 0,
  note: '',
};

const MAX_MONEY = 100_000_000_000;

const num = (value: unknown, fallback: number, min = 0, max = MAX_MONEY): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const text = (value: unknown, fallback: string, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : fallback;

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Chuẩn hóa công thức do client gửi lên (hoặc đọc từ DB): ép kiểu, chặn số lạ, thiếu thì lấy mặc định */
export function sanitizeConfig(input: unknown): PayrollConfig {
  const raw = obj(input);
  const def = DEFAULT_PAYROLL_CONFIG;

  const levelsRaw = Array.isArray(raw.levels) ? raw.levels : [];
  const levels = levelsRaw.slice(0, 10).map((l, i) => {
    const o = obj(l);
    return {
      label: text(o.label, `Bậc ${i + 1}`, 40),
      note: text(o.note, '', 100),
      base: num(o.base, 0),
    };
  });

  const tiersRaw = Array.isArray(raw.dailyBonuses) ? raw.dailyBonuses : null;
  const dailyBonuses = (tiersRaw ?? def.dailyBonuses)
    .slice(0, 10)
    .map((t) => {
      const o = obj(t);
      return { threshold: num(o.threshold, 0), bonus: num(o.bonus, 0) };
    })
    .sort((a, b) => a.threshold - b.threshold);

  const top = obj(raw.topBase);
  const monthly = obj(raw.monthlyBonus);
  const over = obj(raw.overRate);

  return {
    levels: levels.length > 0 ? levels : def.levels,
    standardDaysOffset: num(raw.standardDaysOffset, def.standardDaysOffset, 0, 28),
    topBase: {
      threshold: num(top.threshold, def.topBase.threshold),
      base: num(top.base, def.topBase.base),
    },
    dailyBonuses,
    monthlyBonus: {
      threshold: num(monthly.threshold, def.monthlyBonus.threshold),
      bonus: num(monthly.bonus, def.monthlyBonus.bonus),
    },
    overRate: {
      threshold: num(over.threshold, def.overRate.threshold),
      percent: num(over.percent, def.overRate.percent, 0, 100),
    },
    latePenaltyPerMinute: num(raw.latePenaltyPerMinute, def.latePenaltyPerMinute, 0, 10_000_000),
    overtimePerHour: num(raw.overtimePerHour, def.overtimePerHour, 0, 10_000_000),
  };
}

/** Chuẩn hóa dữ liệu nhập tay của một nhân viên */
export function sanitizeEntry(input: unknown, levelCount: number): PayrollEntry {
  const raw = obj(input);
  const workDaysRaw = raw.workDays;
  let workDays: number | null = null;
  if (workDaysRaw !== null && workDaysRaw !== undefined && workDaysRaw !== '') {
    const n = Number(workDaysRaw);
    // Cho nhập nửa công (0,5)
    if (Number.isFinite(n)) workDays = Math.min(31, Math.max(0, Math.round(n * 2) / 2));
  }
  return {
    level: num(raw.level, 0, 0, Math.max(0, levelCount - 1)),
    workDays,
    adjustment: num(raw.adjustment, 0, -MAX_MONEY, MAX_MONEY),
    note: text(raw.note, '', 200),
  };
}
