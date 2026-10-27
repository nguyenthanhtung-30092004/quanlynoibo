import { describe, expect, it } from 'vitest';
import { monthRangeOf, pickNeedsEffort } from './kpi-needs-effort.util.js';

const tally = (staffId: number, total: number, seats: number) => ({ staffId, total, seats });
const person = (id: number) => ({ id, fullName: `NV ${id}` });

describe('pickNeedsEffort', () => {
  const roster = [1, 2, 3, 4, 5, 6].map(person);
  // 1, 2, 3 bán nhiều; 4 bán 5 vé; 5 bán 2 vé; 6 chưa có đơn nào trong tháng
  const monthly = [tally(1, 20, 30), tally(2, 15, 25), tally(3, 10, 20), tally(4, 4, 5), tally(5, 1, 2)];

  it('top 1 là người ít vé nhất, kể cả người chưa có đơn nào trong tháng', () => {
    const result = pickNeedsEffort(roster, monthly);
    expect(result.map((r) => r.staffId)).toEqual([6, 5, 4]);
    expect(result[0]).toMatchObject({ total: 0, seats: 0 });
  });

  it('bằng vé thì ai ít đơn hơn đứng trước', () => {
    const tied = [tally(1, 9, 9), tally(4, 3, 4), tally(5, 1, 4), tally(6, 2, 4)];
    const result = pickNeedsEffort([1, 4, 5, 6].map(person), tied);
    expect(result.map((r) => r.staffId)).toEqual([5, 6, 4]);
  });

  it('chỉ lấy tối đa 3 người', () => {
    expect(pickNeedsEffort(roster, monthly)).toHaveLength(3);
  });

  it('cả tháng không ai bán được vé thì không có gì để so sánh', () => {
    expect(pickNeedsEffort(roster, [])).toEqual([]);
    expect(pickNeedsEffort(roster, [tally(1, 3, 0)])).toEqual([]);
  });

  it('chỉ có người trong danh sách nhân viên đang hoạt động', () => {
    // 99 đã nghỉ (có đơn trong tháng nhưng không còn trong danh sách) thì không được xuất hiện
    const result = pickNeedsEffort([person(1), person(2)], [tally(99, 1, 1), tally(1, 5, 5)]);
    expect(result.map((r) => r.staffId)).toEqual([2, 1]);
  });
});

describe('monthRangeOf', () => {
  it('lấy ngày đầu và ngày cuối của tháng chứa ngày đã cho', () => {
    expect(monthRangeOf('2026-10-27')).toEqual({ month: '2026-10', from: '2026-10-01', to: '2026-10-31' });
    expect(monthRangeOf('2026-09-05')).toEqual({ month: '2026-09', from: '2026-09-01', to: '2026-09-30' });
  });

  it('tháng 2 năm nhuận và không nhuận', () => {
    expect(monthRangeOf('2028-02-10').to).toBe('2028-02-29');
    expect(monthRangeOf('2026-02-10').to).toBe('2026-02-28');
  });

  it('nhận cả dạng YYYY-MM', () => {
    expect(monthRangeOf('2026-12')).toEqual({ month: '2026-12', from: '2026-12-01', to: '2026-12-31' });
  });
});
