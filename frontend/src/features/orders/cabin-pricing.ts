import { CABIN_KINDS, type CabinKind, type CabinLine } from './types';

/** Số lượng, giá nhập, giá bán (đơn giá 1 cabin) cho từng loại cabin */
export type CabinState = Record<CabinKind, { quantity: number; costPrice: number; sellPrice: number }>;

export function cabinFromLines(lines: CabinLine[] | null | undefined): CabinState {
  const out: CabinState = {
    SINGLE: { quantity: 0, costPrice: 0, sellPrice: 0 },
    SINGLE_FLOOR1: { quantity: 0, costPrice: 0, sellPrice: 0 },
    DOUBLE: { quantity: 0, costPrice: 0, sellPrice: 0 },
  };
  for (const l of lines ?? []) {
    out[l.kind] = { quantity: l.quantity, costPrice: l.costPrice, sellPrice: l.sellPrice };
  }
  return out;
}

/** Tổng số ghế, tổng giá nhập, tổng giá bán = đơn giá x số lượng của từng dòng */
export function cabinTotals(cabin: CabinState) {
  return CABIN_KINDS.reduce(
    (acc, k) => {
      const quantity = Number(cabin[k].quantity) || 0;
      return {
        seatCount: acc.seatCount + quantity,
        costPrice: acc.costPrice + (Number(cabin[k].costPrice) || 0) * quantity,
        sellPrice: acc.sellPrice + (Number(cabin[k].sellPrice) || 0) * quantity,
      };
    },
    { seatCount: 0, costPrice: 0, sellPrice: 0 },
  );
}

/** Hoa hồng xe cabin = (giá bán - giá nhập) x số lượng của từng dòng, cộng lại; không âm */
export function cabinCommission(cabin: CabinState): number {
  const t = cabinTotals(cabin);
  return Math.max(0, t.sellPrice - t.costPrice);
}

/** Xe riêng: giá nhập, giá bán nhập theo 1 xe; tổng đơn = đơn giá x số xe */
export function privateTotals(vehicleCount: number, unitCost: number, unitSell: number) {
  const count = Number(vehicleCount) || 0;
  return {
    costPrice: (Number(unitCost) || 0) * count,
    sellPrice: (Number(unitSell) || 0) * count,
  };
}

/** Hoa hồng xe riêng = (giá bán - giá nhập) x số xe; không âm */
export function privateCommission(vehicleCount: number, unitCost: number, unitSell: number): number {
  const t = privateTotals(vehicleCount, unitCost, unitSell);
  return Math.max(0, t.sellPrice - t.costPrice);
}

/** Đơn giá 1 xe của đơn đã lưu = tổng / số xe (làm tròn); chưa có số xe thì giữ nguyên tổng */
export function perVehicle(total: number, vehicleCount: number): number {
  return vehicleCount > 0 ? Math.round(total / vehicleCount) : total;
}
