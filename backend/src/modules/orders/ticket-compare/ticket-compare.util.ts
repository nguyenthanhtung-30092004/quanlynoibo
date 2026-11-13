import type { TicketCompareRow } from './ticket-compare.parser.js';

/** Thông tin hiển thị của một vé cụ thể, để biết "vé nào" chứ không chỉ con số */
export interface TicketDetail {
  quantity: number;
  route?: string;
  departure?: string;
  ticketId?: string;
  /** Tiền cọc / đã thu của dòng vé này (đồng); 0 nếu không có */
  deposit?: number;
}

export interface PhoneDiff {
  phone: string;
  /** Ngày khởi hành YYYY-MM-DD khi so theo ngày; không có khi một trong hai file thiếu cột ngày */
  day?: string;
  customerName?: string;
  /** Tổng số vé của số điện thoại này trong file A (0 nếu không có) */
  countA: number;
  /** Tổng số vé của số điện thoại này trong file B (0 nếu không có) */
  countB: number;
  /** countA - countB: dương là file A nhiều hơn, âm là file B nhiều hơn */
  delta: number;
  /** Tổng tiền cọc / đã thu ở file A (đồng) */
  depositA: number;
  /** Tổng tiền cọc / đã thu ở file B (đồng) */
  depositB: number;
  /** depositA - depositB */
  depositDelta: number;
  /** Từng vé của SĐT này trong file A (rỗng nếu SĐT không có ở file A) */
  ticketsA: TicketDetail[];
  /** Từng vé của SĐT này trong file B (rỗng nếu SĐT không có ở file B) */
  ticketsB: TicketDetail[];
}

/** Tổng hợp một ngày khởi hành: số vé, tiền cọc hai bên và số SĐT bị lệch trong ngày */
export interface DaySummary {
  /** YYYY-MM-DD; chuỗi rỗng = dòng không đọc được ngày */
  day: string;
  ticketsA: number;
  ticketsB: number;
  depositA: number;
  depositB: number;
  /** Số SĐT lệch số vé trong ngày (kể cả SĐT chỉ có ở 1 bên) */
  ticketDiffPhones: number;
  /** Số SĐT lệch tiền cọc trong ngày (kể cả SĐT chỉ có ở 1 bên mà có cọc) */
  depositDiffPhones: number;
}

export interface TicketCompareResult {
  totalPhonesA: number;
  totalPhonesB: number;
  totalTicketsA: number;
  totalTicketsB: number;
  totalDepositA: number;
  totalDepositB: number;
  /** true khi cả 2 file có ngày khởi hành: so theo cặp SĐT + ngày; false thì chỉ so theo SĐT */
  comparedByDay: boolean;
  /** Số cặp SĐT (+ ngày) khớp hoàn toàn: có ở cả 2 file, số vé và tiền cọc bằng nhau */
  matchedPhones: number;
  /** Chỉ có ở file A, sắp theo ngày rồi SĐT */
  onlyInA: PhoneDiff[];
  /** Chỉ có ở file B, sắp theo ngày rồi SĐT */
  onlyInB: PhoneDiff[];
  /** Có ở cả 2 file nhưng lệch số vé, sắp theo ngày rồi SĐT */
  ticketMismatched: PhoneDiff[];
  /** Có ở cả 2 file nhưng lệch tiền cọc, sắp theo ngày rồi SĐT (một cặp lệch cả vé lẫn cọc có ở cả 2 nhóm) */
  depositMismatched: PhoneDiff[];
  /** Tổng hợp theo từng ngày khởi hành (rỗng khi không so theo ngày), sắp theo ngày */
  byDay: DaySummary[];
}

interface Grouped {
  phone: string;
  day?: string;
  quantity: number;
  deposit: number;
  customerName?: string;
  rows: TicketCompareRow[];
}

/**
 * Gộp danh sách vé theo khóa (SĐT, hoặc SĐT + ngày khởi hành): cộng dồn số vé và tiền cọc, đồng thời giữ lại
 * từng dòng vé gốc để hiển thị chi tiết "vé nào" khi bị lệch. Một lượt duyệt O(n) bằng Map, không cần sắp xếp.
 */
function groupRows(rows: TicketCompareRow[], byDay: boolean): Map<string, Grouped> {
  const map = new Map<string, Grouped>();
  for (const row of rows) {
    const day = byDay ? (row.day ?? '') : undefined;
    const key = byDay ? `${row.phone}|${day}` : row.phone;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.deposit += row.deposit ?? 0;
      existing.customerName ??= row.customerName;
      existing.rows.push(row);
    } else {
      map.set(key, {
        phone: row.phone,
        day,
        quantity: row.quantity,
        deposit: row.deposit ?? 0,
        customerName: row.customerName,
        rows: [row],
      });
    }
  }
  return map;
}

const toDetail = (row: TicketCompareRow): TicketDetail => ({
  quantity: row.quantity,
  route: row.route,
  departure: row.departure,
  ticketId: row.ticketId,
  deposit: row.deposit ?? 0,
});

const byDayThenPhone = (a: PhoneDiff, b: PhoneDiff) =>
  (a.day ?? '').localeCompare(b.day ?? '') || a.phone.localeCompare(b.phone);

function diffOf(a: Grouped | undefined, b: Grouped | undefined): PhoneDiff {
  const g = (a ?? b)!;
  const countA = a?.quantity ?? 0;
  const countB = b?.quantity ?? 0;
  const depositA = a?.deposit ?? 0;
  const depositB = b?.deposit ?? 0;
  return {
    phone: g.phone,
    ...(g.day !== undefined ? { day: g.day } : {}),
    customerName: a?.customerName ?? b?.customerName,
    countA,
    countB,
    delta: countA - countB,
    depositA,
    depositB,
    depositDelta: depositA - depositB,
    ticketsA: a?.rows.map(toDetail) ?? [],
    ticketsB: b?.rows.map(toDetail) ?? [],
  };
}

/**
 * So sánh 2 file vé. Khi cả 2 file đều có ngày khởi hành thì so theo cặp SĐT + ngày (cùng một khách đi
 * nhiều ngày không bị bù trừ lẫn nhau), không thì so theo SĐT. Mỗi cặp: chỉ có ở 1 file, hoặc có ở cả 2
 * nhưng lệch số vé / lệch tiền cọc. Kèm chi tiết từng vé và bảng tổng hợp theo ngày khởi hành.
 */
export function compareTicketCounts(rowsA: TicketCompareRow[], rowsB: TicketCompareRow[]): TicketCompareResult {
  const comparedByDay = rowsA.some((r) => r.day) && rowsB.some((r) => r.day);
  const mapA = groupRows(rowsA, comparedByDay);
  const mapB = groupRows(rowsB, comparedByDay);

  const onlyInA: PhoneDiff[] = [];
  const onlyInB: PhoneDiff[] = [];
  const ticketMismatched: PhoneDiff[] = [];
  const depositMismatched: PhoneDiff[] = [];
  let matchedPhones = 0;

  for (const [key, a] of mapA) {
    const b = mapB.get(key);
    if (!b) {
      onlyInA.push(diffOf(a, undefined));
      continue;
    }
    const ticketOff = a.quantity !== b.quantity;
    const depositOff = a.deposit !== b.deposit;
    if (!ticketOff && !depositOff) {
      matchedPhones++;
      continue;
    }
    const diff = diffOf(a, b);
    if (ticketOff) ticketMismatched.push(diff);
    if (depositOff) depositMismatched.push(diff);
  }
  for (const [key, b] of mapB) {
    if (!mapA.has(key)) onlyInB.push(diffOf(undefined, b));
  }

  const sum = (rows: TicketCompareRow[], f: (r: TicketCompareRow) => number) => rows.reduce((n, r) => n + f(r), 0);

  // Tổng hợp theo ngày khởi hành
  const days = new Map<string, DaySummary>();
  if (comparedByDay) {
    const at = (day: string) => {
      let d = days.get(day);
      if (!d) {
        d = { day, ticketsA: 0, ticketsB: 0, depositA: 0, depositB: 0, ticketDiffPhones: 0, depositDiffPhones: 0 };
        days.set(day, d);
      }
      return d;
    };
    for (const r of rowsA) {
      const d = at(r.day ?? '');
      d.ticketsA += r.quantity;
      d.depositA += r.deposit ?? 0;
    }
    for (const r of rowsB) {
      const d = at(r.day ?? '');
      d.ticketsB += r.quantity;
      d.depositB += r.deposit ?? 0;
    }
    const diffs = new Set([...onlyInA, ...onlyInB, ...ticketMismatched, ...depositMismatched]);
    for (const diff of diffs) {
      const d = at(diff.day ?? '');
      if (diff.delta !== 0) d.ticketDiffPhones++;
      if (diff.depositDelta !== 0) d.depositDiffPhones++;
    }
  }

  return {
    totalPhonesA: new Set(rowsA.map((r) => r.phone)).size,
    totalPhonesB: new Set(rowsB.map((r) => r.phone)).size,
    totalTicketsA: sum(rowsA, (r) => r.quantity),
    totalTicketsB: sum(rowsB, (r) => r.quantity),
    totalDepositA: sum(rowsA, (r) => r.deposit ?? 0),
    totalDepositB: sum(rowsB, (r) => r.deposit ?? 0),
    comparedByDay,
    matchedPhones,
    onlyInA: onlyInA.sort(byDayThenPhone),
    onlyInB: onlyInB.sort(byDayThenPhone),
    ticketMismatched: ticketMismatched.sort(byDayThenPhone),
    depositMismatched: depositMismatched.sort(byDayThenPhone),
    // Dòng không đọc được ngày ("") xếp cuối
    byDay: [...days.values()].sort((x, y) => (x.day || '9999').localeCompare(y.day || '9999')),
  };
}
