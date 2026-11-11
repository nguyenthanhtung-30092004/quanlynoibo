import type { TicketCompareRow } from './ticket-compare.parser.js';

/** Thông tin hiển thị của một vé cụ thể, để biết "vé nào" chứ không chỉ con số */
export interface TicketDetail {
  quantity: number;
  route?: string;
  departure?: string;
  ticketId?: string;
}

export interface PhoneDiff {
  phone: string;
  customerName?: string;
  /** Tổng số vé của số điện thoại này trong file A (0 nếu không có) */
  countA: number;
  /** Tổng số vé của số điện thoại này trong file B (0 nếu không có) */
  countB: number;
  /** countA - countB: dương là file A nhiều hơn, âm là file B nhiều hơn */
  delta: number;
  /** Từng vé của SĐT này trong file A (rỗng nếu SĐT không có ở file A) */
  ticketsA: TicketDetail[];
  /** Từng vé của SĐT này trong file B (rỗng nếu SĐT không có ở file B) */
  ticketsB: TicketDetail[];
}

export interface TicketCompareResult {
  totalPhonesA: number;
  totalPhonesB: number;
  totalTicketsA: number;
  totalTicketsB: number;
  /** Số điện thoại khớp hoàn toàn (có ở cả 2 file, số vé bằng nhau) */
  matchedPhones: number;
  /** Số điện thoại chỉ có ở file A, sắp theo SĐT */
  onlyInA: PhoneDiff[];
  /** Số điện thoại chỉ có ở file B, sắp theo SĐT */
  onlyInB: PhoneDiff[];
  /** Số điện thoại có ở cả 2 file nhưng lệch số vé, sắp theo SĐT */
  mismatched: PhoneDiff[];
}

interface Grouped {
  quantity: number;
  customerName?: string;
  rows: TicketCompareRow[];
}

/**
 * Gộp danh sách vé theo số điện thoại: cộng dồn số lượng vé của cùng một SĐT, đồng thời giữ lại
 * từng dòng vé gốc để sau này hiển thị chi tiết "vé nào" khi SĐT đó bị lệch.
 * Một lượt duyệt O(n), dùng Map nên không cần sắp xếp trước.
 */
function groupByPhone(rows: TicketCompareRow[]): Map<string, Grouped> {
  const map = new Map<string, Grouped>();
  for (const row of rows) {
    const existing = map.get(row.phone);
    if (existing) {
      existing.quantity += row.quantity;
      existing.customerName ??= row.customerName;
      existing.rows.push(row);
    } else {
      map.set(row.phone, { quantity: row.quantity, customerName: row.customerName, rows: [row] });
    }
  }
  return map;
}

const toDetail = (row: TicketCompareRow): TicketDetail => ({
  quantity: row.quantity,
  route: row.route,
  departure: row.departure,
  ticketId: row.ticketId,
});

const byPhone = (a: PhoneDiff, b: PhoneDiff) => a.phone.localeCompare(b.phone);

/**
 * So sánh 2 file vé theo số điện thoại: SĐT nào chỉ có ở 1 file, và SĐT nào có ở cả 2 file
 * nhưng số vé khác nhau - kèm chi tiết từng vé (tuyến, ngày giờ, mã vé nếu có) để biết đúng
 * vé nào, không chỉ con số. Không cần sắp xếp danh sách vé gốc trước khi so - xem ghi chú ở
 * `groupByPhone`: nhóm bằng Map (tra cứu O(1)) rẻ hơn sort (O(n log n)) mà cho đúng kết quả
 * cần (tổng số vé theo từng SĐT), vì thứ tự các vé trong file không có ý nghĩa gì ở đây.
 */
export function compareTicketCounts(rowsA: TicketCompareRow[], rowsB: TicketCompareRow[]): TicketCompareResult {
  const mapA = groupByPhone(rowsA);
  const mapB = groupByPhone(rowsB);

  const onlyInA: PhoneDiff[] = [];
  const onlyInB: PhoneDiff[] = [];
  const mismatched: PhoneDiff[] = [];
  let matchedPhones = 0;
  let totalTicketsA = 0;
  let totalTicketsB = 0;

  for (const [phone, a] of mapA) {
    totalTicketsA += a.quantity;
    const b = mapB.get(phone);
    if (!b) {
      onlyInA.push({
        phone,
        customerName: a.customerName,
        countA: a.quantity,
        countB: 0,
        delta: a.quantity,
        ticketsA: a.rows.map(toDetail),
        ticketsB: [],
      });
    } else if (a.quantity !== b.quantity) {
      mismatched.push({
        phone,
        customerName: a.customerName ?? b.customerName,
        countA: a.quantity,
        countB: b.quantity,
        delta: a.quantity - b.quantity,
        ticketsA: a.rows.map(toDetail),
        ticketsB: b.rows.map(toDetail),
      });
    } else {
      matchedPhones++;
    }
  }
  for (const [phone, b] of mapB) {
    totalTicketsB += b.quantity;
    if (!mapA.has(phone)) {
      onlyInB.push({
        phone,
        customerName: b.customerName,
        countA: 0,
        countB: b.quantity,
        delta: -b.quantity,
        ticketsA: [],
        ticketsB: b.rows.map(toDetail),
      });
    }
  }

  return {
    totalPhonesA: mapA.size,
    totalPhonesB: mapB.size,
    totalTicketsA,
    totalTicketsB,
    matchedPhones,
    onlyInA: onlyInA.sort(byPhone),
    onlyInB: onlyInB.sort(byPhone),
    mismatched: mismatched.sort(byPhone),
  };
}
