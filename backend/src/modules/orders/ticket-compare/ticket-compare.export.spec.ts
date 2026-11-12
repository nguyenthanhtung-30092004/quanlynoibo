import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildCompareWorkbook, displayName } from './ticket-compare.export.js';

const result = {
  totalPhonesA: 10,
  totalPhonesB: 9,
  totalTicketsA: 25,
  totalTicketsB: 22,
  matchedPhones: 7,
  cancelledCountA: 2,
  cancelledCountB: 0,
  onlyInA: [
    { phone: '0912345678', customerName: 'Nguyễn Văn A', countA: 2, countB: 0, delta: 2, ticketsA: [{ quantity: 2, route: 'Hà Nội - Sapa', departure: '21:00 04/10/2026' }], ticketsB: [] },
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
  return wb.worksheets[0];
}

describe('buildCompareWorkbook', () => {
  it('có tiêu đề, tên 2 file, thẻ tổng quan và bảng chia nhóm theo màu', async () => {
    const sheet = await load(await buildCompareWorkbook(result, { a: 'Nội bộ T10', b: 'Nhà xe T10' }));
    expect(sheet.getCell(1, 1).value).toBe('BÁO CÁO ĐỐI CHIẾU VÉ NHÀ XE');
    expect(String(sheet.getCell(2, 1).value)).toContain('File A: Nội bộ T10');
    expect(String(sheet.getCell(2, 1).value)).toContain('File B: Nhà xe T10');
    // thẻ số liệu: SĐT khớp, chỉ có ở A, chỉ có ở B, lệch số vé, tổng vé A, tổng vé B
    expect([1, 3, 4, 5, 8, 9].map((c) => sheet.getCell(5, c).value)).toEqual([7, 1, 1, 1, 25, 22]);
    expect(String(sheet.getCell(6, 1).value)).toContain('Đã bỏ qua vé hủy: 2 ở file A');

    // Nhóm "Lệch số vé" đứng đầu, rồi "Chỉ có ở A", "Chỉ có ở B"; STT chạy liên tục
    expect(sheet.getCell(9, 1).value).toBe('LỆCH SỐ VÉ  (1 SĐT)');
    expect(sheet.getRow(10).values).toEqual(
      expect.arrayContaining([1, '0901111222', 'Trần B', 'Lệch số vé', 3, 1, '+2']),
    );
    // Chi tiết vé: mỗi vé một dòng trong ô
    expect(sheet.getCell(10, 8).value).toBe('1 vé\n2 vé · Hà Nội - Hà Giang');
    expect(sheet.getCell(11, 1).value).toBe('CHỈ CÓ Ở FILE A  (1 SĐT)');
    expect(sheet.getCell(12, 2).value).toBe('0912345678');
    expect(sheet.getCell(12, 9).value).toBe('—');
    expect(sheet.getCell(13, 1).value).toBe('CHỈ CÓ Ở FILE B  (1 SĐT)');
    expect(sheet.getCell(14, 1).value).toBe(3);
    expect(sheet.getCell(14, 7).value).toBe('-1');
    // Tên bắt đầu bằng "=" không bị Excel hiểu là công thức
    expect(sheet.getCell(14, 3).value).toBe("'=HACK()");
  });

  it('không có chênh lệch thì báo hai file khớp hoàn toàn', async () => {
    const empty = { ...result, onlyInA: [], onlyInB: [], mismatched: [], cancelledCountA: 0 };
    const sheet = await load(await buildCompareWorkbook(empty, { a: 'A', b: 'B' }));
    expect(sheet.getCell(9, 1).value).toBe('Hai file khớp hoàn toàn, không có số điện thoại nào chênh lệch.');
  });

  it('displayName bỏ đuôi file, rỗng thì dùng tên mặc định', () => {
    expect(displayName('XVIP THANG 10.xlsx', 'File A')).toBe('XVIP THANG 10');
    expect(displayName(undefined, 'File B')).toBe('File B');
  });
});
