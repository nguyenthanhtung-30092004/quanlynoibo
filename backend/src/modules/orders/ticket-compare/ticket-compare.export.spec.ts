import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildCompareWorkbook, displayName, sheetName } from './ticket-compare.export.js';

const result = {
  totalPhonesA: 10,
  totalPhonesB: 9,
  totalTicketsA: 25,
  totalTicketsB: 22,
  matchedPhones: 7,
  cancelledCountA: 2,
  cancelledCountB: 0,
  onlyInA: [
    {
      phone: '0912345678',
      customerName: 'Nguyễn Văn A',
      countA: 2,
      countB: 0,
      delta: 2,
      ticketsA: [{ quantity: 2, route: 'Hà Nội - Sapa', departure: '21:00 04/10/2026' }],
      ticketsB: [],
    },
  ],
  onlyInB: [
    { phone: '0987654321', customerName: '=HACK()', countA: 0, countB: 1, delta: -1, ticketsA: [], ticketsB: [{ quantity: 1, ticketId: 'VX1' }] },
  ],
  mismatched: [
    {
      phone: '0901111222',
      customerName: 'Trần B',
      countA: 3,
      countB: 1,
      delta: 2,
      ticketsA: [{ quantity: 1 }, { quantity: 2, route: 'Hà Nội - Hà Giang' }],
      ticketsB: [{ quantity: 1 }],
    },
  ],
};

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  return wb;
}

describe('buildCompareWorkbook', () => {
  it('mỗi nhóm một sheet, tên sheet kèm số lượng, Tổng quan đứng đầu', async () => {
    const wb = await load(await buildCompareWorkbook(result, { a: 'Nội bộ T10', b: 'Nhà xe T10' }));
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng quan',
      'Lệch số vé (1)',
      'Có ở A, thiếu ở B (1)',
      'Có ở B, thiếu ở A (1)',
    ]);
  });

  it('Tổng quan: tên 2 file, thẻ số liệu, ghi chú vé hủy và mục lục bấm sang sheet', async () => {
    const sheet = (await load(await buildCompareWorkbook(result, { a: 'Nội bộ T10', b: 'Nhà xe T10' }))).getWorksheet('Tổng quan')!;
    expect(sheet.getCell(1, 1).value).toBe('BÁO CÁO ĐỐI CHIẾU VÉ NHÀ XE');
    expect(sheet.getCell(4, 2).value).toBe('Nội bộ T10');
    expect(sheet.getCell(5, 2).value).toBe('Nhà xe T10');
    // SĐT khớp, lệch số vé, có ở A thiếu ở B, có ở B thiếu ở A, tổng vé A, tổng vé B
    expect([1, 2, 3, 4, 5, 6].map((c) => sheet.getCell(8, c).value)).toEqual([7, 1, 1, 1, 25, 22]);
    expect(String(sheet.getCell(9, 1).value)).toContain('Đã bỏ qua vé hủy: 2 ở file A');
    expect(sheet.getCell(12, 1).value).toEqual({ text: 'Lệch số vé (1)', hyperlink: "#'Lệch số vé (1)'!A1" });
  });

  it('sheet Lệch số vé: đủ cột hai bên, chênh lệch có dấu, chi tiết mỗi vé một dòng', async () => {
    const sheet = (await load(await buildCompareWorkbook(result, { a: 'A', b: 'B' }))).getWorksheet('Lệch số vé (1)')!;
    expect(sheet.getRow(4).values).toEqual(
      expect.arrayContaining(['SỐ ĐIỆN THOẠI', 'VÉ FILE A', 'VÉ FILE B', 'CHI TIẾT VÉ FILE A', 'CHI TIẾT VÉ FILE B']),
    );
    expect(sheet.getRow(5).values).toEqual(expect.arrayContaining([1, '0901111222', 'Trần B', 3, 1, '+2']));
    expect(sheet.getCell(5, 7).value).toBe('1 vé\n2 vé · Hà Nội - Hà Giang');
  });

  it('sheet một bên chỉ có cột của bên đó; tên bắt đầu bằng "=" không thành công thức', async () => {
    const wb = await load(await buildCompareWorkbook(result, { a: 'A', b: 'B' }));
    const onlyA = wb.getWorksheet('Có ở A, thiếu ở B (1)')!;
    expect(onlyA.getRow(4).cellCount).toBe(5);
    expect(onlyA.getCell(4, 4).value).toBe('SỐ VÉ FILE A');
    expect(onlyA.getCell(5, 2).value).toBe('0912345678');
    expect(onlyA.getCell(5, 5).value).toBe('2 vé · Hà Nội - Sapa · 21:00 04/10/2026');
    const onlyB = wb.getWorksheet('Có ở B, thiếu ở A (1)')!;
    expect(onlyB.getCell(4, 4).value).toBe('SỐ VÉ FILE B');
    expect(onlyB.getCell(5, 3).value).toBe("'=HACK()");
    expect(onlyB.getCell(5, 5).value).toBe('1 vé · Mã VX1');
  });

  it('nhóm rỗng vẫn có sheet và báo không có số điện thoại nào', async () => {
    const wb = await load(await buildCompareWorkbook({ ...result, mismatched: [] }, { a: 'A', b: 'B' }));
    expect(wb.getWorksheet('Lệch số vé (0)')!.getCell(5, 1).value).toBe('Không có số điện thoại nào trong nhóm này.');
  });

  it('sheetName cắt còn 31 ký tự và bỏ ký tự Excel cấm', () => {
    expect(sheetName('Có ở A, thiếu ở B', 177)).toBe('Có ở A, thiếu ở B (177)');
    expect(sheetName('a/b:c?'.repeat(10), 5).length).toBeLessThanOrEqual(31);
    expect(sheetName('a/b:c?', 1)).toBe('abc (1)');
  });

  it('displayName bỏ đuôi file, rỗng thì dùng tên mặc định', () => {
    expect(displayName('XVIP THANG 10.xlsx', 'File A')).toBe('XVIP THANG 10');
    expect(displayName(undefined, 'File B')).toBe('File B');
  });
});
