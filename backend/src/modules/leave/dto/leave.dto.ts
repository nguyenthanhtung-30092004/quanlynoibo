import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class LeaveMonthQueryDto {
  @Matches(MONTH, { message: 'Tháng phải có dạng YYYY-MM' })
  month: string;
}

export class LeaveDayQueryDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;
}

export class RegisterLeaveDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;
}

export class AdminRegisterLeaveDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;

  @Type(() => Number)
  @IsInt({ message: 'Nhân viên không hợp lệ' })
  @Min(1, { message: 'Nhân viên không hợp lệ' })
  userId: number;
}

export class SaveLeaveConfigDto {
  @IsInt({ message: 'Số người nghỉ đầu tuần phải là số nguyên' })
  @Min(0, { message: 'Số người nghỉ không được âm' })
  @Max(100)
  earlyMax: number;

  @IsInt({ message: 'Số người nghỉ cuối tuần phải là số nguyên' })
  @Min(0, { message: 'Số người nghỉ không được âm' })
  @Max(100)
  lateMax: number;
}

export class SetDayLimitDto {
  @Matches(DAY, { message: 'Ngày phải có dạng YYYY-MM-DD' })
  day: string;

  /** Số người nghỉ tối đa riêng cho ngày này (0 = khóa); bỏ trống / null = dùng mặc định theo nhóm */
  @IsOptional()
  @IsInt({ message: 'Số người nghỉ phải là số nguyên' })
  @Min(0, { message: 'Số người nghỉ không được âm' })
  @Max(100)
  max?: number | null;
}
