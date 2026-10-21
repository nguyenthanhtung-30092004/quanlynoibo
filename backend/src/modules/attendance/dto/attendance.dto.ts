import { IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class AttendanceDayQueryDto {
  @IsOptional()
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day?: string;
}

export class AttendanceMonthQueryDto {
  @Matches(MONTH, { message: 'Tháng phải có dạng YYYY-MM' })
  month: string;
}

export class SaveAttendanceConfigDto {
  @IsObject({ message: 'Cấu hình chấm công không hợp lệ' })
  config: Record<string, unknown>;
}

export class AttendanceOverrideDto {
  @IsInt({ message: 'Mã nhân viên không hợp lệ' })
  userId: number;

  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;

  /** Số công chỉnh tay cho ngày đó; null = bỏ chỉnh tay, quay về số công tự tính */
  @IsOptional()
  @IsNumber({}, { message: 'Số công không hợp lệ' })
  @Min(0)
  @Max(2)
  cong?: number | null;

  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  note?: string;
}

export class AttendanceShiftOverrideDto {
  @IsInt({ message: 'Mã nhân viên không hợp lệ' })
  userId: number;

  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;

  /** Giờ bắt đầu ca (phút trong ngày) Admin chọn cho ngày đó; null = bỏ chọn, quay về tự đoán */
  @IsOptional()
  @IsInt({ message: 'Ca làm việc không hợp lệ' })
  @Min(0)
  @Max(1439)
  shiftStart?: number | null;
}

export class AttendanceDefaultShiftDto {
  @IsInt({ message: 'Mã nhân viên không hợp lệ' })
  userId: number;

  /** Giờ bắt đầu ca mặc định (phút trong ngày); null = bỏ ca mặc định */
  @IsOptional()
  @IsInt({ message: 'Ca làm việc không hợp lệ' })
  @Min(0)
  @Max(1439)
  shiftStart?: number | null;
}
