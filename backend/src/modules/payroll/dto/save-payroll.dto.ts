import { IsObject, IsOptional, Matches } from 'class-validator';

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class PayrollQueryDto {
  @Matches(MONTH_PATTERN, { message: 'Tháng phải có dạng YYYY-MM' })
  month: string;
}

export class SavePayrollDto {
  @Matches(MONTH_PATTERN, { message: 'Tháng phải có dạng YYYY-MM' })
  month: string;

  /** Công thức tính lương (chuẩn hóa ở service); bỏ trống thì giữ công thức đang lưu */
  @IsOptional()
  @IsObject({ message: 'Công thức tính lương không hợp lệ' })
  config?: Record<string, unknown>;

  /** Phần nhập tay theo từng nhân viên: { [userId]: { level, workDays, adjustment, note, insurance, advance } } */
  @IsOptional()
  @IsObject({ message: 'Dữ liệu nhập tay không hợp lệ' })
  entries?: Record<string, unknown>;
}
