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
    expect(result.onlyInA).toMatchObject([]);
    expect(result.onlyInB).toMatchObject([]);
    expect(result.ticketMismatched).toMatchObject([]);
    expect(result.depositMismatched).toMatchObject([]);
  });

  it('phone chỉ có ở file A -> vào onlyInA với countB = 0 và danh sách vé của file A', () => {
    const result = compareTicketCounts([row('0901111111', 2, { route: 'HN-HP' })], []);
    expect(result.onlyInA).toMatchObject([
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
    expect(result.onlyInB).toMatchObject([]);
  });

  it('phone chỉ có ở file B -> vào onlyInB với countA = 0 và danh sách vé của file B', () => {
    const result = compareTicketCounts([], [row('0901111111', 3)]);
    expect(result.onlyInB[0]).toMatchObject({ phone: '0901111111', countA: 0, countB: 3, delta: -3 });
    expect(result.onlyInB[0].ticketsB).toHaveLength(1);
    expect(result.onlyInB[0].ticketsA).toMatchObject([]);
  });

  it('cùng 1 phone xuất hiện nhiều dòng trong 1 file -> cộng dồn số lượng trước khi so (1 vé + 1 vé = 2 vé)', () => {
    const result = compareTicketCounts(
      [row('0901111111', 1), row('0901111111', 1)],
      [row('0901111111', 2)],
    );
    expect(result.matchedPhones).toBe(1);
    expect(result.ticketMismatched).toMatchObject([]);
    expect(result.depositMismatched).toMatchObject([]);
  });

  it('cùng phone nhưng tổng số vé khác nhau -> vào mismatched kèm delta đúng dấu và đủ chi tiết vé 2 bên', () => {
    const result = compareTicketCounts(
      [row('0901111111', 2, { route: 'HN-HP', ticketId: 'V1' })],
      [row('0901111111', 1, { route: 'HN-HP' })],
    );
    expect(result.ticketMismatched).toHaveLength(1);
    const diff = result.ticketMismatched[0];
    expect(diff).toMatchObject({ phone: '0901111111', countA: 2, countB: 1, delta: 1 });
    expect(diff.ticketsA).toMatchObject([{ quantity: 2, route: 'HN-HP', departure: undefined, ticketId: 'V1' }]);
    expect(diff.ticketsB).toMatchObject([{ quantity: 1, route: 'HN-HP', departure: undefined, ticketId: undefined }]);
  });

  it('giữ lại tên khách để hiển thị, ưu tiên tên từ file A nếu cả 2 đều có', () => {
    const result = compareTicketCounts(
      [row('0901111111', 1, { customerName: 'Nguyễn Văn A' })],
      [row('0901111111', 2, { customerName: 'Tên khác ở file B' })],
    );
    expect(result.ticketMismatched[0].customerName).toBe('Nguyễn Văn A');
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
    expect(result.onlyInA.map((d) => d.phone)).toMatchObject(['0901111111', '0909999999']);
  });
});

describe('so theo ngày khởi hành và tiền cọc', () => {
  it('cả 2 file có ngày: so theo cặp SĐT + ngày, cùng khách khác ngày không bù trừ', () => {
    const a = [row('0901', 1, { day: '2026-10-01' }), row('0901', 1, { day: '2026-10-02' })];
    const b = [row('0901', 2, { day: '2026-10-01' })];
    const r = compareTicketCounts(a, b);
    expect(r.comparedByDay).toBe(true);
    // Theo SĐT thì 2 = 2 (khớp), nhưng theo ngày: 01/10 lệch 1 vé, 02/10 chỉ có ở A
    expect(r.ticketMismatched).toMatchObject([{ phone: '0901', day: '2026-10-01', countA: 1, countB: 2, delta: -1 }]);
    expect(r.onlyInA).toMatchObject([{ phone: '0901', day: '2026-10-02', countA: 1 }]);
    expect(r.matchedPhones).toBe(0);
  });

  it('cùng số vé nhưng khác tiền cọc -> chỉ vào nhóm lệch cọc, không vào nhóm lệch vé', () => {
    const r = compareTicketCounts(
      [row('0901', 1, { day: '2026-10-01', deposit: 260_000 })],
      [row('0901', 1, { day: '2026-10-01', deposit: 0 })],
    );
    expect(r.depositMismatched).toMatchObject([{ delta: 0, depositA: 260_000, depositB: 0, depositDelta: 260_000 }]);
    expect(r.ticketMismatched).toEqual([]);
  });

  it('cọc của nhóm khách ghi vào SĐT khác nhau nhưng tổng cọc chuyến bằng nhau -> không tính lệch cọc', () => {
    const trip = { day: '2026-10-10', route: 'Hà Nội - Hải Phòng' };
    const r = compareTicketCounts(
      [row('0903454850', 3, { ...trip, deposit: 260_000 })],
      [row('0903454850', 1, { ...trip, deposit: 0 }), row('0983509898', 1, { ...trip, deposit: 260_000 })],
    );
    expect(r.depositMismatched).toEqual([]);
    expect(r.ticketMismatched).toMatchObject([{ phone: '0903454850', delta: 2 }]);
    expect(r.byDay[0]).toMatchObject({ depositDiffPhones: 0 });
  });

  it('tổng cọc của chuyến lệch thật -> vẫn báo lệch cọc', () => {
    const trip = { day: '2026-10-10', route: 'Hà Nội - Hải Phòng' };
    const r = compareTicketCounts(
      [row('0901', 1, { ...trip, deposit: 260_000 })],
      [row('0901', 1, { ...trip, deposit: 200_000 })],
    );
    expect(r.depositMismatched).toMatchObject([{ depositDelta: 60_000 }]);
    expect(r.byDay[0]).toMatchObject({ depositDiffPhones: 1 });
  });

  it('lệch cả số vé lẫn tiền cọc -> có ở cả 2 nhóm', () => {
    const r = compareTicketCounts(
      [row('0901', 2, { day: '2026-10-01', deposit: 300_000 })],
      [row('0901', 1, { day: '2026-10-01', deposit: 150_000 })],
    );
    expect(r.ticketMismatched).toMatchObject([{ delta: 1 }]);
    expect(r.depositMismatched).toMatchObject([{ depositDelta: 150_000 }]);
  });

  it('khớp cả số vé lẫn tiền cọc -> khớp hoàn toàn', () => {
    const r = compareTicketCounts(
      [row('0901', 2, { day: '2026-10-01', deposit: 100_000 })],
      [row('0901', 1, { day: '2026-10-01', deposit: 60_000 }), row('0901', 1, { day: '2026-10-01', deposit: 40_000 })],
    );
    expect(r.matchedPhones).toBe(1);
    expect(r.ticketMismatched).toEqual([]);
    expect(r.depositMismatched).toEqual([]);
  });

  it('bảng theo ngày: cộng vé, cọc hai bên và đếm SĐT lệch của từng ngày', () => {
    const r = compareTicketCounts(
      [row('0901', 1, { day: '2026-10-02', deposit: 200_000 }), row('0902', 2, { day: '2026-10-01' })],
      [row('0901', 1, { day: '2026-10-02', deposit: 200_000 }), row('0903', 1, { day: '2026-10-01', deposit: 50_000 })],
    );
    expect(r.byDay).toEqual([
      { day: '2026-10-01', ticketsA: 2, ticketsB: 1, depositA: 0, depositB: 50_000, ticketDiffPhones: 2, depositDiffPhones: 1 },
      { day: '2026-10-02', ticketsA: 1, ticketsB: 1, depositA: 200_000, depositB: 200_000, ticketDiffPhones: 0, depositDiffPhones: 0 },
    ]);
    expect(r.totalDepositA).toBe(200_000);
    expect(r.totalDepositB).toBe(250_000);
  });

  it('một file không có ngày -> chỉ so theo SĐT như trước, không có bảng theo ngày', () => {
    const r = compareTicketCounts([row('0901', 1, { day: '2026-10-01' })], [row('0901', 1)]);
    expect(r.comparedByDay).toBe(false);
    expect(r.matchedPhones).toBe(1);
    expect(r.byDay).toEqual([]);
  });
});
