export interface TicketDetail {
  quantity: number;
  route?: string;
  departure?: string;
  ticketId?: string;
  /** Tiền cọc / đã thu của dòng vé (đồng) */
  deposit?: number;
}

export interface PhoneDiff {
  phone: string;
  /** Ngày khởi hành YYYY-MM-DD khi so theo ngày */
  day?: string;
  customerName?: string;
  countA: number;
  countB: number;
  delta: number;
  /** Tổng cọc / đã thu (đồng) ở file A, file B và chênh lệch A - B */
  depositA: number;
  depositB: number;
  depositDelta: number;
  ticketsA: TicketDetail[];
  ticketsB: TicketDetail[];
}

export interface TicketCompareResult {
  totalPhonesA: number;
  totalPhonesB: number;
  totalTicketsA: number;
  totalTicketsB: number;
  totalDepositA: number;
  totalDepositB: number;
  /** true: so theo cặp SĐT + ngày khởi hành; false: chỉ theo SĐT (một file thiếu cột ngày) */
  comparedByDay: boolean;
  matchedPhones: number;
  onlyInA: PhoneDiff[];
  onlyInB: PhoneDiff[];
  /** Có ở cả 2 file nhưng lệch số vé */
  ticketMismatched: PhoneDiff[];
  /** Có ở cả 2 file nhưng lệch tiền cọc (cặp lệch cả hai thì có ở cả 2 danh sách) */
  depositMismatched: PhoneDiff[];
  cancelledCountA: number;
  cancelledCountB: number;
  /** Tổng hợp theo từng ngày khởi hành */
  byDay: DaySummary[];
}

export interface DaySummary {
  /** YYYY-MM-DD; rỗng = không đọc được ngày */
  day: string;
  ticketsA: number;
  ticketsB: number;
  depositA: number;
  depositB: number;
  /** Số SĐT lệch số vé trong ngày */
  ticketDiffPhones: number;
  /** Số SĐT lệch tiền cọc trong ngày */
  depositDiffPhones: number;
}
