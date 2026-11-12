import { describe, expect, it } from 'vitest';
import { CabinKind, type CabinLine } from '../entities/order.entity.js';
import { cabinLinesWithDeposit, cabinTotals, describeCabinLines, sortCabinLines } from './order.mapper.js';

const double: CabinLine = { kind: CabinKind.DOUBLE, quantity: 1, costPrice: 700_000, sellPrice: 900_000, deposit: 200_000 };
const single: CabinLine = { kind: CabinKind.SINGLE, quantity: 2, costPrice: 800_000, sellPrice: 1_000_000, deposit: 300_000 };

describe('cabin lines', () => {
  it('sắp cabin đơn, cabin đơn tầng 1, cabin đôi; không có dòng thì trả null', () => {
    const floor1: CabinLine = { kind: CabinKind.SINGLE_FLOOR1, quantity: 1, costPrice: 0, sellPrice: 0, deposit: 0 };
    expect(sortCabinLines([double, floor1, single])?.map((l) => l.kind)).toEqual([
      CabinKind.SINGLE,
      CabinKind.SINGLE_FLOOR1,
      CabinKind.DOUBLE,
    ]);
    expect(sortCabinLines([double, single])?.map((l) => l.kind)).toEqual([
      CabinKind.SINGLE,
      CabinKind.DOUBLE,
    ]);
    expect(sortCabinLines([])).toBeNull();
    expect(sortCabinLines(null)).toBeNull();
  });

  it('tổng số ghế, giá nhập, giá bán bằng tổng các dòng; cọc cộng thẳng từng dòng (không nhân số lượng)', () => {
    expect(cabinTotals([single, double])).toEqual({
      seatCount: 3,
      // đơn giá x số lượng: 2 x 800k + 1 x 700k, 2 x 1M + 1 x 900k
      costPrice: 2_300_000,
      sellPrice: 2_900_000,
      // 300k (cọc cả dòng cabin đơn) + 200k (cọc cả dòng cabin đôi)
      deposit: 500_000,
    });
  });

  it('mô tả dòng cabin cho lịch sử', () => {
    expect(describeCabinLines([double, single])).toBe('Cabin Đơn x2; Cabin Đôi x1');
    expect(describeCabinLines(null)).toBeNull();
  });
});

describe('cabinLinesWithDeposit', () => {
  it('dòng đã có cọc riêng: giữ nguyên cọc từng dòng', () => {
    expect(cabinLinesWithDeposit([double, single], 500_000)?.map((l) => l.deposit)).toEqual([300_000, 200_000]);
  });

  it('vé cũ (dòng chưa có trường cọc): cọc chung của vé dồn vào dòng đầu, tổng cọc không đổi', () => {
    const legacy = [double, single].map(({ deposit: _d, ...l }) => l) as CabinLine[];
    const out = cabinLinesWithDeposit(legacy, 500_000)!;
    expect(out.map((l) => [l.kind, l.deposit])).toEqual([
      [CabinKind.SINGLE, 500_000],
      [CabinKind.DOUBLE, 0],
    ]);
    expect(cabinTotals(out).deposit).toBe(500_000);
  });

  it('không có dòng nào thì trả null', () => {
    expect(cabinLinesWithDeposit(null, 100_000)).toBeNull();
    expect(cabinLinesWithDeposit([], 100_000)).toBeNull();
  });
});
