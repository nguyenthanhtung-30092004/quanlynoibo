export interface LeaveConfig {
  /** Số người nghỉ tối đa cho các ngày đầu tuần (T2-T5) */
  earlyMax: number;
  /** Số người nghỉ tối đa cho các ngày cuối tuần (T6, T7, CN) */
  lateMax: number;
}

export interface LeavePerson {
  requestId: number;
  userId: number;
  fullName: string;
}

export interface LeaveDay {
  day: string;
  limit: number;
  /** Admin đã chỉnh riêng giới hạn của ngày này */
  customLimit: boolean;
  count: number;
  mine: boolean;
  /** Những người đã đăng ký nghỉ ngày này */
  people: LeavePerson[];
}

export interface LeaveMonth {
  month: string;
  today: string;
  config: LeaveConfig;
  days: LeaveDay[];
}
