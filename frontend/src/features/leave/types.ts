export interface LeaveConfig {
  /** Số người nghỉ tối đa cho các ngày đầu tuần (T2-T5) */
  earlyMax: number;
  /** Số người nghỉ tối đa cho các ngày cuối tuần (T6, T7, CN) */
  lateMax: number;
}

export interface LeavePerson {
  /** null với người hệ thống tự ghi nhận nghỉ đột xuất (không có lượt đăng ký để hủy) */
  requestId: number | null;
  userId: number;
  fullName: string;
  /** Nghỉ đột xuất: Admin đăng ký hộ cho nhân viên báo nghỉ ngay trong ngày, hoặc hệ thống tự ghi nhận */
  urgent: boolean;
  /** Không quẹt máy chấm công và chưa đăng ký nghỉ nên hệ thống tự ghi nhận nghỉ đột xuất */
  auto: boolean;
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
  /** Số ngày nghỉ tối đa mỗi người trong một tháng; vượt thì cảnh báo */
  quota: number;
  days: LeaveDay[];
}

export interface LeaveHistoryEntry {
  id: number;
  action: 'REGISTER' | 'CANCEL' | 'URGENT';
  /** Người được nghỉ */
  userName: string;
  actorId: number | null;
  /** Người thao tác (có thể là Admin hủy hộ) */
  actorName: string;
  createdAt: string;
}
