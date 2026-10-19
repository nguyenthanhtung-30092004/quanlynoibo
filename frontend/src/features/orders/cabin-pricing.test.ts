import { describe, expect, it } from 'vitest';
import {
  cabinCommission,
  cabinFromLines,
  cabinTotals,
  perVehicle,
  privateCommission,
  privateTotals,
} from './cabin-pricing';

const lines = [
  { kind: 'SINGLE' as const, quantity: 2, costPrice: 800_000, sellPrice: 1_000_000 },
  { kind: 'DOUBLE' as const, quantity: 1, costPrice: 700_000, sellPrice: 900_000 },
  { kind: 'SINGLE_FLOOR1' as const, quantity: 3, costPrice: 500_000, sellPrice: 650_000 },
];

describe('cabin pricing', () => {
  it('điền cả 3 loại: hoa hồng là tổng lãi của 3 dòng', () => {
    const cabin = cabinFromLines(lines);
    expect(cabinTotals(cabin)).toEqual({ seatCount: 6, costPrice: 3_800_000, sellPrice: 4_850_000 });
    // 2 x 200k + 1 x 200k + 3 x 150k
    expect(cabinCommission(cabin)).toBe(1_050_000);
  });

  it('điền 2 loại: chỉ cộng 2 dòng đó', () => {
    expect(cabinCommission(cabinFromLines([lines[0], lines[1]]))).toBe(600_000);
  });

  it('điền 1 loại: chỉ lãi của dòng đó', () => {
    expect(cabinCommission(cabinFromLines([lines[2]]))).toBe(450_000);
  });

  it('dòng trống số lượng thì không được tính dù đã nhập giá', () => {
    const cabin = cabinFromLines([{ ...lines[0], quantity: 0 }, lines[1]]);
    expect(cabinCommission(cabin)).toBe(200_000);
    expect(cabinTotals(cabin).seatCount).toBe(1);
  });

  it('bán thấp hơn nhập: dòng lỗ trừ vào tổng, tổng âm thì hoa hồng là 0', () => {
    const loss = { kind: 'SINGLE' as const, quantity: 1, costPrice: 900_000, sellPrice: 800_000 };
    expect(cabinCommission(cabinFromLines([loss, lines[1]]))).toBe(100_000); // 200k - 100k
    expect(cabinCommission(cabinFromLines([loss]))).toBe(0);
  });

  it('chưa nhập gì thì mọi số là 0', () => {
    expect(cabinTotals(cabinFromLines(null))).toEqual({ seatCount: 0, costPrice: 0, sellPrice: 0 });
    expect(cabinCommission(cabinFromLines(null))).toBe(0);
  });
});

describe('xe riêng', () => {
  it('tổng = đơn giá x số xe, hoa hồng = (bán - nhập) x số xe', () => {
    expect(privateTotals(3, 800_000, 1_000_000)).toEqual({ costPrice: 2_400_000, sellPrice: 3_000_000 });
    expect(privateCommission(3, 800_000, 1_000_000)).toBe(600_000);
  });

  it('chưa nhập số xe thì tổng và hoa hồng là 0', () => {
    expect(privateTotals(0, 800_000, 1_000_000)).toEqual({ costPrice: 0, sellPrice: 0 });
    expect(privateCommission(0, 800_000, 1_000_000)).toBe(0);
  });

  it('bán thấp hơn nhập thì hoa hồng là 0, không âm', () => {
    expect(privateCommission(2, 900_000, 800_000)).toBe(0);
  });

  it('đơn giá 1 xe của đơn đã lưu = tổng / số xe', () => {
    expect(perVehicle(3_000_000, 3)).toBe(1_000_000);
    expect(perVehicle(1_000_000, 0)).toBe(1_000_000);
  });
});
