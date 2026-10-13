export interface AttendanceConfig {
  /** Số phút làm việc từ mức này trở lên được 1 công (420 = 7 tiếng) */
  fullMinutes: number;
  /** Từ mức này được nửa công; 0 = không tính nửa công */
  halfMinutes: number;
  /** Vị trí công ty; null = chưa cài, khi đó chưa ai được tính công */
  workplace: { lat: number | null; lng: number | null };
  /** Bán kính coi là đang ở công ty (mét) */
  radiusM: number;
  /** Sai số định vị tối đa chấp nhận được (mét) */
  maxAccuracyM: number;
}

export type BeatReason =
  | 'ok'
  | 'not_staff'
  | 'mobile'
  | 'not_configured'
  | 'no_location'
  | 'low_accuracy'
  | 'out_of_range';

export interface HeartbeatInput {
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export interface TodayStatus {
  minutesToday: number;
  congToday: number;
  fullMinutes: number;
}

export interface HeartbeatResult extends TodayStatus {
  counted: boolean;
  reason: BeatReason;
  distanceM: number | null;
}

export interface MyTodayStatus extends TodayStatus {
  configured: boolean;
}

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
