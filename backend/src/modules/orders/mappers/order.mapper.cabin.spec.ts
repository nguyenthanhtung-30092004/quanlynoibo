import { describe, expect, it } from 'vitest';
import { CabinKind, type CabinLine } from '../entities/order.entity.js';
import { cabinTotals, describeCabinLines, sortCabinLines } from './order.mapper.js';

const double: CabinLine = { kind: CabinKind.DOUBLE, quantity: 1, costPrice: 700_000, sellPrice: 900_000 };
const single: CabinLine = { kind: CabinKind.SINGLE, quantity: 2, costPrice: 800_000, sellPrice: 1_000_000 };

describe('cabin lines', () => {
  it('sắp cabin đơn, cabin đơn tầng 1, cabin đôi; không có dòng thì trả null', () => {
    const floor1: CabinLine = { kind: CabinKind.SINGLE_FLOOR1, quantity: 1, costPrice: 0, sellPrice: 0 };
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

  it('tổng số ghế, giá nhập, giá bán bằng tổng các dòng', () => {
    expect(cabinTotals([single, double])).toEqual({
      seatCount: 3,
      // đơn giá x số lượng: 2 x 800k + 1 x 700k, 2 x 1M + 1 x 900k
      costPrice: 2_300_000,
      sellPrice: 2_900_000,
    });
  });

  it('mô tả dòng cabin cho lịch sử', () => {
    expect(describeCabinLines([double, single])).toBe('Cabin Đơn x2; Cabin Đôi x1');
    expect(describeCabinLines(null)).toBeNull();
  });
});
