import { describe, expect, it } from 'vitest';
import { compareTicketCounts } from './ticket-compare.util.js';
import type { TicketCompareRow } from './ticket-compare.parser.js';

const row = (phone: string, quantity = 1, extra: Partial<TicketCompareRow> = {}): TicketCompareRow => ({
  phone,
  quantity,
  ...extra,
});

describe('compareTicketCounts', () => {
  it('phone có ở cả 2 file với cùng tổng số vé -> khớp, không xuất hiện trong các danh sách lệch', () => {
    const result = compareTicketCounts([row('0901111111')], [row('0901111111')]);
    expect(result.matchedPhones).toBe(1);
    expect(result.onlyInA).toEqual([]);
    expect(result.onlyInB).toEqual([]);
    expect(result.mismatched).toEqual([]);
  });

  it('phone chỉ có ở file A -> vào onlyInA với countB = 0 và danh sách vé của file A', () => {
    const result = compareTicketCounts([row('0901111111', 2, { route: 'HN-HP' })], []);
    expect(result.onlyInA).toEqual([
      {
        phone: '0901111111',
        customerName: undefined,
        countA: 2,
        countB: 0,
        delta: 2,
        ticketsA: [{ quantity: 2, route: 'HN-HP', departure: undefined, ticketId: undefined }],
        ticketsB: [],
      },
    ]);
    expect(result.onlyInB).toEqual([]);
  });

  it('phone chỉ có ở file B -> vào onlyInB với countA = 0 và danh sách vé của file B', () => {
    const result = compareTicketCounts([], [row('0901111111', 3)]);
    expect(result.onlyInB[0]).toMatchObject({ phone: '0901111111', countA: 0, countB: 3, delta: -3 });
    expect(result.onlyInB[0].ticketsB).toHaveLength(1);
    expect(result.onlyInB[0].ticketsA).toEqual([]);
  });

  it('cùng 1 phone xuất hiện nhiều dòng trong 1 file -> cộng dồn số lượng trước khi so (1 vé + 1 vé = 2 vé)', () => {
    const result = compareTicketCounts(
      [row('0901111111', 1), row('0901111111', 1)],
      [row('0901111111', 2)],
    );
    expect(result.matchedPhones).toBe(1);
    expect(result.mismatched).toEqual([]);
  });

  it('cùng phone nhưng tổng số vé khác nhau -> vào mismatched kèm delta đúng dấu và đủ chi tiết vé 2 bên', () => {
    const result = compareTicketCounts(
      [row('0901111111', 2, { route: 'HN-HP', ticketId: 'V1' })],
      [row('0901111111', 1, { route: 'HN-HP' })],
    );
    expect(result.mismatched).toHaveLength(1);
    const diff = result.mismatched[0];
    expect(diff).toMatchObject({ phone: '0901111111', countA: 2, countB: 1, delta: 1 });
    expect(diff.ticketsA).toEqual([{ quantity: 2, route: 'HN-HP', departure: undefined, ticketId: 'V1' }]);
    expect(diff.ticketsB).toEqual([{ quantity: 1, route: 'HN-HP', departure: undefined, ticketId: undefined }]);
  });

  it('giữ lại tên khách để hiển thị, ưu tiên tên từ file A nếu cả 2 đều có', () => {
    const result = compareTicketCounts(
      [row('0901111111', 1, { customerName: 'Nguyễn Văn A' })],
      [row('0901111111', 2, { customerName: 'Tên khác ở file B' })],
    );
    expect(result.mismatched[0].customerName).toBe('Nguyễn Văn A');
  });

  it('tổng hợp đúng số SĐT và tổng số vé của từng file', () => {
    const result = compareTicketCounts(
      [row('0901111111', 2), row('0902222222', 1)],
      [row('0901111111', 2)],
    );
    expect(result.totalPhonesA).toBe(2);
    expect(result.totalPhonesB).toBe(1);
    expect(result.totalTicketsA).toBe(3);
    expect(result.totalTicketsB).toBe(2);
  });

  it('kết quả được sắp theo số điện thoại tăng dần để dễ dò theo file gốc', () => {
    const result = compareTicketCounts(
      [row('0909999999'), row('0901111111')],
      [],
    );
    expect(result.onlyInA.map((d) => d.phone)).toEqual(['0901111111', '0909999999']);
  });
});
