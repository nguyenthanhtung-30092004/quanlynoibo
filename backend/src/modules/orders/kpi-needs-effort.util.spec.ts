import { describe, expect, it } from 'vitest';
import { pickNeedsEffort, type StaffTally } from './kpi-needs-effort.util.js';

const tally = (staffId: number, total: number, seats: number): StaffTally => ({
  staffId,
  fullName: `NV ${staffId}`,
  total,
  seats,
});
const person = (id: number) => ({ id, fullName: `NV ${id}` });

describe('pickNeedsEffort', () => {
  const roster = [1, 2, 3, 4, 5, 6].map(person);
  // 1, 2, 3 là bục vinh danh; 4 bán 5 vé; 5 bán 2 vé; 6 chưa có đơn nào
  const ranking = [tally(1, 20, 30), tally(2, 15, 25), tally(3, 10, 20), tally(4, 4, 5), tally(5, 1, 2)];
  const podium = new Set([1, 2, 3]);

  it('top 1 là người ít vé nhất, kể cả người chưa có đơn nào', () => {
    const result = pickNeedsEffort(roster, ranking, podium);
    expect(result.map((r) => r.staffId)).toEqual([6, 5, 4]);
    expect(result[0]).toMatchObject({ total: 0, seats: 0 });
  });

  it('người đã lên bục vinh danh không xuất hiện, hai mục không trùng nhau', () => {
    const ids = pickNeedsEffort(roster, ranking, podium).map((r) => r.staffId);
    for (const id of podium) expect(ids).not.toContain(id);
  });

  it('bằng vé thì ai ít đơn hơn đứng trước', () => {
    const tied = [tally(1, 9, 9), tally(4, 3, 4), tally(5, 1, 4), tally(6, 2, 4)];
    const result = pickNeedsEffort([1, 4, 5, 6].map(person), tied, new Set([1]));
    expect(result.map((r) => r.staffId)).toEqual([5, 6, 4]);
  });

  it('chỉ lấy tối đa 3 người', () => {
    expect(pickNeedsEffort(roster, ranking, new Set())).toHaveLength(3);
  });

  it('cả kỳ không ai bán được vé thì không có gì để so sánh', () => {
    expect(pickNeedsEffort(roster, [], new Set())).toEqual([]);
    expect(pickNeedsEffort(roster, [tally(1, 3, 0)], new Set())).toEqual([]);
  });

  it('chỉ tính người đã chấm công vào, người chưa quẹt thì chưa tính', () => {
    // 6 chưa có đơn nào nhưng chưa chấm công vào nên không bị gọi là siêu lười; 5 và 4 đã vào làm
    const result = pickNeedsEffort(roster, ranking, podium, new Set(), new Set([4, 5]));
    expect(result.map((r) => r.staffId)).toEqual([5, 4]);
  });

  it('người đã chấm công vào mà chưa có đơn nào vẫn được tính, là người ít nhất', () => {
    const result = pickNeedsEffort(roster, ranking, podium, new Set(), new Set([4, 5, 6]));
    expect(result.map((r) => r.staffId)).toEqual([6, 5, 4]);
  });

  it('chưa ai chấm công vào thì không có danh sách', () => {
    expect(pickNeedsEffort(roster, ranking, podium, new Set(), new Set())).toEqual([]);
  });

  it('Admin lọc theo nhân viên thì chỉ xét những người đó', () => {
    const result = pickNeedsEffort(roster, ranking, podium, new Set([4, 5]));
    expect(result.map((r) => r.staffId)).toEqual([5, 4]);
  });
});
