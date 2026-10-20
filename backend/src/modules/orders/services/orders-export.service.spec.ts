import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../../users/entities/user.entity.js';
import { CabinKind, Order } from '../entities/order.entity.js';
import { cabinTotals } from '../mappers/order.mapper.js';
import { OrdersExportService } from './orders-export.service.js';

const base = {
  entryDate: '2026-10-19',
  createdBy: { fullName: 'Nhân viên A' },
  customerName: 'Khách',
  phone: '0912345678',
  route: { name: 'Hà Nội - Cẩm Phả' },
  departureTime: '08:00',
  departureDate: '2026-10-20',
  vehicleType: 'Xe Limousine',
  cabinLines: null,
  vehicleCount: 0,
  seatFront: 0,
  seatMiddle: 0,
  seatBack: 0,
  seatZone: null,
  seatCount: 0,
  costPrice: 0,
  sellPrice: 0,
  deposit: 0,
  collectOnDelivery: 0,
  commission: 0,
  partner: null,
  note: null,
  cancelledAt: null,
};

/** Đơn cabin đủ 3 loại: giá là đơn giá 1 cabin, tổng và hoa hồng tính từ các dòng */
const cabinLines = [
  { kind: CabinKind.SINGLE, quantity: 2, costPrice: 800_000, sellPrice: 1_000_000 },
  { kind: CabinKind.DOUBLE, quantity: 1, costPrice: 700_000, sellPrice: 900_000 },
  { kind: CabinKind.SINGLE_FLOOR1, quantity: 3, costPrice: 500_000, sellPrice: 650_000 },
];
const cabin = cabinTotals(cabinLines);

const cabinOrder = {
  ...base,
  id: 1,
  vehicleType: 'Xe Cabin',
  cabinLines,
  seatCount: cabin.seatCount,
  costPrice: cabin.costPrice,
  sellPrice: cabin.sellPrice,
  deposit: 500_000,
  commission: cabin.sellPrice - cabin.costPrice,
};
const normalOrder = {
  ...base,
  id: 2,
  seatCount: 2,
  costPrice: 300_000,
  sellPrice: 400_000,
  commission: 20_000,
};
const cancelledOrder = {
  ...base,
  id: 3,
  seatCount: 5,
  costPrice: 111_000,
  sellPrice: 999_000,
  deposit: 100_000,
  commission: 77_000,
  cancelledAt: new Date(),
};
const privateOrder = {
  ...base,
  id: 4,
  vehicleType: 'Xe Riêng',
  vehicleCount: 2,
  seatCount: 0,
  costPrice: 800_000,
  sellPrice: 1_000_000,
  commission: 50_000,
};

async function exportRows(orders: unknown[]) {
  const query = {
    orderBy() {
      return this;
    },
    take() {
      return this;
    },
    getMany: async () => orders,
  };
  const service = new OrdersExportService(
    { findOne: async () => ({ id: 1, fullName: 'Admin' }) } as never,
    { buildListQuery: () => query, getCachedPartners: async () => [] } as never,
  );
  const buffer = await service.exportExcel({} as never, {
    sub: 1,
    username: 'admin',
    role: UserRole.ADMIN,
  } as never);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.getWorksheet('Nhật ký vé')!;
}

describe('xuất Excel: tiền và tách dòng', () => {
  it('tổng đơn cabin = đơn giá x số lượng; hoa hồng = tổng bán - tổng nhập', () => {
    expect(cabin).toEqual({ seatCount: 6, costPrice: 3_800_000, sellPrice: 4_850_000 });
    expect(cabinOrder.commission).toBe(1_050_000);
  });

  it('đơn cabin tách 3 dòng, tiền cọc/hoa hồng chỉ ở dòng đầu, tổng các dòng khớp đơn', async () => {
    const sheet = await exportRows([cabinOrder]);
    const rows = [5, 6, 7].map((r) => sheet.getRow(r));
    const col = (name: string) => {
      const header = sheet.getRow(4);
      for (let c = 1; c <= header.cellCount; c++) if (header.getCell(c).value === name) return c;
      throw new Error(`Không thấy cột ${name}`);
    };
    expect(rows.map((r) => r.getCell(col('LOẠI HÌNH')).value)).toEqual([
      'Cabin Đơn',
      'Cabin Đơn Tầng 1',
      'Cabin Đôi',
    ]);
    expect(rows.map((r) => r.getCell(col('SỐ GHẾ')).value)).toEqual([2, 3, 1]);
    // cột tiền ghi theo nghìn đồng: giá trị trong ô là 1.600 chứ không phải 1.600.000
    // dòng cabin ghi đơn giá 1 cabin (không nhân số lượng)
    expect(rows.map((r) => r.getCell(col('GIÁ NHẬP')).value)).toEqual([800, 500, 700]);
    expect(rows.map((r) => r.getCell(col('GIÁ BÁN')).value)).toEqual([1_000, 650, 900]);
    expect(rows.map((r) => r.getCell(col('ĐÃ CỌC')).value)).toEqual([500, 0, 0]);
    expect(rows.map((r) => r.getCell(col('HOA HỒNG')).value)).toEqual([1_050, 0, 0]);
    // STT giống nhau vì cùng một đơn
    expect(new Set(rows.map((r) => r.getCell(1).value)).size).toBe(1);
    // cả 3 dòng đều nền vàng vì đơn đã cọc
    for (const r of rows) {
      expect(r.getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFFFF176' } });
    }
    // tổng cột khớp tổng của đơn
    const total = sheet.getRow(8);
    const result = (name: string) => {
      const v = total.getCell(col(name)).value;
      // cột giá ở đơn cabin là số cố định, các cột khác là công thức có result
      return typeof v === 'number' ? v : (v as { result: number }).result;
    };
    expect(result('SỐ GHẾ')).toBe(cabinOrder.seatCount);
    expect(result('GIÁ NHẬP')).toBe(cabinOrder.costPrice / 1000);
    expect(result('GIÁ BÁN')).toBe(cabinOrder.sellPrice / 1000);
    expect(result('ĐÃ CỌC')).toBe(cabinOrder.deposit / 1000);
    expect(result('HOA HỒNG')).toBe(cabinOrder.commission / 1000);
  });

  it('dòng TỔNG bỏ vé đã hủy, xe riêng không tính ghế, vé hủy chữ đỏ nền trắng và còn border', async () => {
    const sheet = await exportRows([cabinOrder, normalOrder, cancelledOrder, privateOrder]);
    // 3 dòng cabin + thường + hủy + xe riêng = 6 dòng, dòng TỔNG là dòng 11
    const total = sheet.getRow(11);
    const header = sheet.getRow(4);
    const col = (name: string) => {
      for (let c = 1; c <= header.cellCount; c++) if (header.getCell(c).value === name) return c;
      throw new Error(`Không thấy cột ${name}`);
    };
    const result = (name: string) => {
      const v = total.getCell(col(name)).value;
      // cột giá ở đơn cabin là số cố định, các cột khác là công thức có result
      return typeof v === 'number' ? v : (v as { result: number }).result;
    };
    expect(result('SỐ GHẾ')).toBe(6 + 2 + 0);
    expect(result('GIÁ NHẬP')).toBe((3_800_000 + 300_000 + 800_000) / 1000);
    expect(result('GIÁ BÁN')).toBe((4_850_000 + 400_000 + 1_000_000) / 1000);
    expect(result('ĐÃ CỌC')).toBe(500);
    expect(result('HOA HỒNG')).toBe((1_050_000 + 20_000 + 50_000) / 1000);

    const cancelledRow = sheet.getRow(9);
    expect(cancelledRow.getCell(2).value).toBe('ĐÃ HỦY');
    for (const c of [2, 5, 15]) {
      const cell = cancelledRow.getCell(c);
      expect(cell.fill).toMatchObject({ fgColor: { argb: 'FFFFFFFF' } });
      expect(cell.font).toMatchObject({ color: { argb: 'FFB91C1C' } });
      expect(cell.border?.top?.style).toBe('thin');
      expect(cell.border?.bottom?.style).toBe('thin');
    }
    // xe riêng ghi kèm số xe, cột số ghế để trống
    const privateRow = sheet.getRow(10);
    expect(privateRow.getCell(col('LOẠI HÌNH')).value).toBe('Xe Riêng x2');
    expect(privateRow.getCell(col('SỐ GHẾ')).value).toBe('');
  });

  it('17.000 đ được ghi là 17 (giá trị thật trong ô), số lẻ nghìn giữ nguyên', async () => {
    const sheet = await exportRows([
      { ...normalOrder, costPrice: 17_000, sellPrice: 17_500, deposit: 1_000, commission: 500 },
    ]);
    const header = sheet.getRow(4);
    const col = (name: string) => {
      for (let c = 1; c <= header.cellCount; c++) if (header.getCell(c).value === name) return c;
      throw new Error(name);
    };
    const row = sheet.getRow(5);
    expect(row.getCell(col('GIÁ NHẬP')).value).toBe(17);
    expect(row.getCell(col('GIÁ NHẬP')).numFmt).toBe('#,##0');
    expect(row.getCell(col('GIÁ BÁN')).value).toBe(17.5);
    expect(row.getCell(col('GIÁ BÁN')).numFmt).toBe('#,##0.###');
    expect(row.getCell(col('ĐÃ CỌC')).value).toBe(1);
    expect(row.getCell(col('HOA HỒNG')).value).toBe(0.5);
  });
});
