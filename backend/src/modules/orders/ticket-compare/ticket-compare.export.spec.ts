import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildCompareWorkbook, displayName, sheetName, vnDay } from './ticket-compare.export.js';
import type { TicketCompareResponse } from './ticket-compare.service.js';

const diff = (o: Partial<TicketCompareResponse['onlyInA'][number]>) => ({
  phone: '',
  countA: 0,
  countB: 0,
  delta: 0,
  depositA: 0,
  depositB: 0,
  depositDelta: 0,
  ticketsA: [],
  ticketsB: [],
  ...o,
});

const result: TicketCompareResponse = {
  totalPhonesA: 10,
  totalPhonesB: 9,
  totalTicketsA: 25,
  totalTicketsB: 22,
  totalDepositA: 430_000,
  totalDepositB: 170_000,
  comparedByDay: true,
  matchedPhones: 7,
  cancelledCountA: 2,
  cancelledCountB: 0,
  onlyInA: [
    diff({
      phone: '0912345678',
      day: '2026-10-04',
      customerName: 'Nguyễn Văn A',
      countA: 2,
      delta: 2,
      depositA: 260_000,
      depositDelta: 260_000,
      ticketsA: [{ quantity: 2, route: 'Hà Nội - Sapa', departure: '21:00 04/10/2026', deposit: 260_000 }],
    }),
  ],
  onlyInB: [
    diff({ phone: '0987654321', day: '2026-10-05', customerName: '=HACK()', countB: 1, delta: -1, ticketsB: [{ quantity: 1, ticketId: 'VX1' }] }),
  ],
  mismatched: [
    diff({
      phone: '0901111222',
      day: '2026-10-01',
      customerName: 'Trần B',
      countA: 3,
      countB: 1,
      delta: 2,
      depositA: 170_000,
      depositB: 170_000,
      ticketsA: [{ quantity: 1, deposit: 170_000 }, { quantity: 2, route: 'Hà Nội - Hà Giang' }],
      ticketsB: [{ quantity: 1, deposit: 170_000 }],
    }),
  ],
  byDay: [
    { day: '2026-10-01', ticketsA: 10, ticketsB: 8, depositA: 170_000, depositB: 170_000, diffPhones: 1 },
    { day: '2026-10-04', ticketsA: 15, ticketsB: 14, depositA: 260_000, depositB: 0, diffPhones: 2 },
  ],
};

async function load(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  return wb;
}

describe('buildCompareWorkbook', () => {
  it('so theo ngày: có sheet Theo ngày, mỗi nhóm một sheet, tên sheet kèm số lượng', async () => {
    const wb = await load(await buildCompareWorkbook(result, { a: 'Nội bộ T10', b: 'Nhà xe T10' }));
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng quan',
      'Theo ngày (2)',
      'Lệch vé hoặc cọc (1)',
      'Có ở A, thiếu ở B (1)',
      'Có ở B, thiếu ở A (1)',
    ]);
  });

  it('không so được theo ngày thì không có sheet Theo ngày và không có cột ngày', async () => {
    const wb = await load(await buildCompareWorkbook({ ...result, comparedByDay: false, byDay: [] }, { a: 'A', b: 'B' }));
    expect(wb.worksheets.map((s) => s.name)).not.toContain('Theo ngày (0)');
    expect(wb.getWorksheet('Lệch vé hoặc cọc (1)')!.getCell(4, 2).value).toBe('SỐ ĐIỆN THOẠI');
  });

  it('Tổng quan: tên 2 file, thẻ vé, thẻ cọc và chênh lệch cọc, mục lục bấm sang sheet', async () => {
    const sheet = (await load(await buildCompareWorkbook(result, { a: 'Nội bộ T10', b: 'Nhà xe T10' }))).getWorksheet('Tổng quan')!;
    expect(sheet.getCell(4, 2).value).toBe('Nội bộ T10');
    expect(sheet.getCell(5, 2).value).toBe('Nhà xe T10');
    expect([1, 2, 3, 4, 5, 6].map((c) => sheet.getCell(8, c).value)).toEqual([7, 1, 1, 1, 25, 22]);
    expect([1, 2, 3, 4].map((c) => sheet.getCell(11, c).value)).toEqual([430_000, 170_000, 260_000, 3]);
    expect(String(sheet.getCell(13, 1).value)).toContain('Đã bỏ qua vé hủy: 2 ở file A');
    expect(sheet.getCell(16, 1).value).toEqual({ text: 'Theo ngày (2)', hyperlink: "#'Theo ngày (2)'!A1" });
  });

  it('sheet Theo ngày: mỗi ngày một dòng, chênh vé / chênh cọc có dấu, dòng TỔNG ở cuối', async () => {
    const sheet = (await load(await buildCompareWorkbook(result, { a: 'A', b: 'B' }))).getWorksheet('Theo ngày (2)')!;
    expect((sheet.getRow(5).values as unknown[]).slice(1)).toEqual(['01/10/2026', 10, 8, 2, 170_000, 170_000, 0, 1]);
    expect((sheet.getRow(6).values as unknown[]).slice(1)).toEqual(['04/10/2026', 15, 14, 1, 260_000, 0, 260_000, 2]);
    expect((sheet.getRow(7).values as unknown[]).slice(1)).toEqual(['TỔNG', 25, 22, 3, 430_000, 170_000, 260_000, 3]);
  });

  it('sheet Lệch vé hoặc cọc: có ngày, vé và cọc hai bên, chi tiết vé kèm cọc', async () => {
    const sheet = (await load(await buildCompareWorkbook(result, { a: 'A', b: 'B' }))).getWorksheet('Lệch vé hoặc cọc (1)')!;
    expect((sheet.getRow(5).values as unknown[]).slice(1, 11)).toEqual([
      1,
      '01/10/2026',
      '0901111222',
      'Trần B',
      3,
      1,
      2,
      170_000,
      170_000,
      0,
    ]);
    expect(sheet.getCell(5, 11).value).toBe('1 vé · Cọc 170.000\n2 vé · Hà Nội - Hà Giang');
  });

  it('sheet một bên chỉ có cột của bên đó; tên bắt đầu bằng "=" không thành công thức', async () => {
    const wb = await load(await buildCompareWorkbook(result, { a: 'A', b: 'B' }));
    const onlyA = wb.getWorksheet('Có ở A, thiếu ở B (1)')!;
    expect((onlyA.getRow(4).values as unknown[]).slice(1)).toEqual([
      'STT',
      'NGÀY\nKHỞI HÀNH',
      'SỐ ĐIỆN THOẠI',
      'TÊN KHÁCH',
      'SỐ VÉ\nFILE A',
      'CỌC\nFILE A',
      'CHI TIẾT VÉ FILE A',
    ]);
    expect((onlyA.getRow(5).values as unknown[]).slice(1, 7)).toEqual([1, '04/10/2026', '0912345678', 'Nguyễn Văn A', 2, 260_000]);
    const onlyB = wb.getWorksheet('Có ở B, thiếu ở A (1)')!;
    expect(onlyB.getCell(5, 4).value).toBe("'=HACK()");
    expect(onlyB.getCell(5, 7).value).toBe('1 vé · Mã VX1');
  });

  it('nhóm rỗng vẫn có sheet và báo không có số điện thoại nào', async () => {
    const wb = await load(await buildCompareWorkbook({ ...result, mismatched: [] }, { a: 'A', b: 'B' }));
    expect(wb.getWorksheet('Lệch vé hoặc cọc (0)')!.getCell(5, 1).value).toBe('Không có số điện thoại nào trong nhóm này.');
  });

  it('sheetName cắt còn 31 ký tự và bỏ ký tự Excel cấm; vnDay đổi ngày sang dd/mm/yyyy', () => {
    expect(sheetName('Có ở A, thiếu ở B', 177)).toBe('Có ở A, thiếu ở B (177)');
    expect(sheetName('a/b:c?'.repeat(10), 5).length).toBeLessThanOrEqual(31);
    expect(sheetName('a/b:c?', 1)).toBe('abc (1)');
    expect(vnDay('2026-10-04')).toBe('04/10/2026');
    expect(vnDay(undefined)).toBe('Không rõ ngày');
  });

  it('displayName bỏ đuôi file, rỗng thì dùng tên mặc định', () => {
    expect(displayName('XVIP THANG 10.xlsx', 'File A')).toBe('XVIP THANG 10');
    expect(displayName(undefined, 'File B')).toBe('File B');
  });
});
