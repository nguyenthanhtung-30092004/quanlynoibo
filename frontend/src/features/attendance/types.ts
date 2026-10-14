export interface AttendanceConfig {
  /** Số phút làm việc từ mức này trở lên được 1 công (mặc định 480 = 8 tiếng) */
  fullMinutes: number;
  /** Từ mức này được nửa công (mặc định 240 = 4 tiếng); 0 = không tính nửa công */
  halfMinutes: number;
}

export type BeatReason = 'ok' | 'not_staff';

export interface TodayStatus {
  minutesToday: number;
  congToday: number;
  fullMinutes: number;
  halfMinutes?: number;
}

export interface HeartbeatResult extends TodayStatus {
  counted: boolean;
  reason: BeatReason;
}

export type MyTodayStatus = TodayStatus;

export interface AttendanceDayCell {
  minutes: number;
  /** Số công cuối cùng của ngày (đã tính cả chỉnh tay) */
  cong: number;
  /** Số công tự tính từ số phút */
  autoCong: number;
  overridden: boolean;
  note: string;
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

export interface DayLogEvent {
  kind: 'login' | 'logout';
  at: string;
}

export interface DayLogStaff {
  userId: number;
  fullName: string;
  minutes: number;
  cong: number;
  firstAt: string | null;
  lastAt: string | null;
  events: DayLogEvent[];
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
  todayMinutes: number;
}
