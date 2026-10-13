import { IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Mỗi lượt báo "tôi đang thao tác" kèm vị trí hiện tại của trình duyệt */
export class HeartbeatDto {
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ không hợp lệ' })
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ không hợp lệ' })
  @Min(-180)
  @Max(180)
  lng?: number;

  /** Sai số định vị (mét) do trình duyệt báo */
  @IsOptional()
  @IsNumber({}, { message: 'Sai số định vị không hợp lệ' })
  @Min(0)
  accuracy?: number;
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
