export interface AttendanceConfig {
  /** Số phút làm trong ca từ mức này trở lên được 1 công (mặc định 480 = 8 tiếng) */
  fullMinutes: number;
  /** Từ mức này được nửa công (mặc định 240 = 4 tiếng); 0 = không tính nửa công */
  halfMinutes: number;
}

/**
 * - not_in: chưa quẹt lượt nào
 * - working: mới quẹt vào, chưa quẹt ra
 * - missing_out: ngày đã qua mà quên quẹt ra, chưa tính công
 * - done: đã có lượt vào và lượt ra
 */
export type DayStatus = 'not_in' | 'working' | 'missing_out' | 'done';

/** Chấm công hôm nay của chính người đăng nhập (chip ở header) */
export interface MyTodayStatus {
  status: DayStatus;
  /** Ca đã xác định được sau khi quẹt ra, vd "6h - 15h30" */
  shift: string | null;
  minutes: number;
  cong: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  punchedInAt: string | null;
  punchedOutAt: string | null;
  fullMinutes: number;
  halfMinutes: number;
  /** Giờ máy chủ lúc trả dữ liệu, để bộ đếm không lệch theo đồng hồ máy nhân viên */
  serverNow: string;
}

export interface AttendanceDayCell {
  /** Số phút được tính trong ca */
  minutes: number;
  /** Số công cuối cùng của ngày (đã tính cả chỉnh tay) */
  cong: number;
  /** Số công tự tính từ lượt quẹt */
  autoCong: number;
  overridden: boolean;
  note: string;
  status: DayStatus;
  /** null với công cũ tính theo đăng nhập (trước khi dùng máy chấm công) */
  shift: string | null;
  firstAt: string | null;
  lastAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

export interface AttendanceStaff {
  id: number;
  fullName: string;
  isActive: boolean;
  /** Theo ngày YYYY-MM-DD; ngày không có dữ liệu thì không có khóa */
  days: Record<string, AttendanceDayCell>;
  totalCong: number;
}

export interface AttendanceMonth {
  month: string;
  daysInMonth: number;
  config: AttendanceConfig;
  staff: AttendanceStaff[];
}

export interface OverrideInput {
  userId: number;
  day: string;
  /** null = bỏ chỉnh tay */
  cong: number | null;
  note?: string;
}

export interface DayLogStaff {
  userId: number;
  fullName: string;
  status: DayStatus;
  shift: string | null;
  minutes: number;
  cong: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /** Lượt quẹt đầu tiên (giờ vào) */
  firstAt: string | null;
  /** Lượt quẹt cuối (giờ ra); null nếu mới có một lượt */
  lastAt: string | null;
  /** Mọi lượt quẹt trong ngày, theo thứ tự thời gian */
  punches: string[];
}

export interface DayLog {
  day: string;
  staff: DayLogStaff[];
}

export interface OnlineUser {
  userId: number;
  fullName: string;
  role: string;
  connections: number;
  onlineSince: string;
  lastSeenAt: string;
}
