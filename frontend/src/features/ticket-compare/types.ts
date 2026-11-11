export interface TicketDetail {
  quantity: number;
  route?: string;
  departure?: string;
  ticketId?: string;
}

export interface PhoneDiff {
  phone: string;
  customerName?: string;
  countA: number;
  countB: number;
  delta: number;
  ticketsA: TicketDetail[];
  ticketsB: TicketDetail[];
}

export interface TicketCompareResult {
  totalPhonesA: number;
  totalPhonesB: number;
  totalTicketsA: number;
  totalTicketsB: number;
  matchedPhones: number;
  onlyInA: PhoneDiff[];
  onlyInB: PhoneDiff[];
  mismatched: PhoneDiff[];
  cancelledCountA: number;
  cancelledCountB: number;
}
