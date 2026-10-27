export interface PayrollLevel {
  label: string;
  note: string;
  base: number;
}

export interface PayrollTier {
  threshold: number;
  bonus: number;
}

/** Công thức tính lương: mọi con số Admin sửa tay được */
export interface PayrollConfig {
  levels: PayrollLevel[];
  /** Công chuẩn = số ngày trong tháng − số này */
  standardDaysOffset: number;
  /** Đạt hoa hồng tháng từ mốc này thì lương cứng là `base` (thay cho bậc) */
  topBase: { threshold: number; base: number };
  /** Thưởng ngày: mỗi ngày chỉ tính một mốc cao nhất đạt được */
  dailyBonuses: PayrollTier[];
  monthlyBonus: PayrollTier;
  /** Hoa hồng vượt mốc thì được `percent`% phần vượt */
  overRate: { threshold: number; percent: number };
  /** Vào ca muộn: trừ bấy nhiêu đồng cho mỗi phút muộn (0 = không trừ) */
  latePenaltyPerMinute: number;
  /** Tăng ca: mỗi giờ tăng ca được bấy nhiêu đồng (0 = không tính) */
  overtimePerHour: number;
  /** Bảo hiểm trừ vào lương mỗi tháng: mức mặc định cho nhân viên chưa có số riêng của tháng đó */
  insuranceDefault: number;
}

export interface PayrollEntry {
  /** Vị trí bậc trong `levels`, bắt đầu từ 0 */
  level: number;
  /** Số công thực tế; null = chưa nhập */
  workDays: number | null;
  /** Cộng / trừ thêm bằng tay (âm = trừ) */
  adjustment: number;
  note: string;
  /** Bảo hiểm của tháng này; null = chưa chốt, dùng `config.insuranceDefault`. Lưu bảng lương thì server chốt thành số */
  insurance: number | null;
  /** Tiền đã ứng trước trong tháng, trừ vào tổng lương; chỉ có ở từng tháng, không có mức mặc định */
  advance: number;
}

export interface PayrollDay {
  commission: number;
  tickets: number;
}

export interface PayrollStaff {
  id: number;
  fullName: string;
  isActive: boolean;
  entry: PayrollEntry;
  /** Hoa hồng theo từng ngày (YYYY-MM-DD) trong tháng */
  daily: Record<string, PayrollDay>;
}

export interface PayrollData {
  month: string;
  daysInMonth: number;
  config: PayrollConfig;
  staff: PayrollStaff[];
}

export interface SavePayrollInput {
  month: string;
  config: PayrollConfig;
  entries: Record<number, PayrollEntry>;
}
