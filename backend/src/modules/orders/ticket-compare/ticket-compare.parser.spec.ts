import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseTicketWorkbook } from './ticket-compare.parser.js';

async function workbookBuffer(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parseTicketWorkbook', () => {
  it('đọc được file dạng nhà xe tự xuất (cột Số điện thoại + Số lượng + Trạng thái vé)', async () => {
    const buffer = await workbookBuffer([
      ['Mã vé', 'Tuyến', 'Số lượng', 'Tên người đi', 'Số điện thoại', 'Trạng thái vé'],
      ['V1', 'THÁI BÌNH - HÀ NỘI', 1, 'Nguyễn Văn A', '0355790076', 'Đã thanh toán'],
      ['V2', 'HÀ NỘI - THÁI BÌNH', 1, 'Trần Thị B', '0915190188', 'Giữ chỗ ưu tiên'],
    ]);
    const { rows, cancelledCount } = await parseTicketWorkbook(buffer);
    expect(cancelledCount).toBe(0);
    expect(rows).toEqual([
      {
        phone: '0355790076',
        quantity: 1,
        customerName: 'Nguyễn Văn A',
        route: 'THÁI BÌNH - HÀ NỘI',
        departure: undefined,
        ticketId: 'V1',
      },
      {
        phone: '0915190188',
        quantity: 1,
        customerName: 'Trần Thị B',
        route: 'HÀ NỘI - THÁI BÌNH',
        departure: undefined,
        ticketId: 'V2',
      },
    ]);
  });

  it('đọc được file dạng nội bộ (cột TÊN KHÁCH, SỐ ĐiỆN THOẠI, SỐ GHế) và cộng đúng số ghế', async () => {
    const buffer = await workbookBuffer([
      ['TÊN KHÁCH', ' SỐ ĐiỆN THOẠI', 'TUYẾN ĐI', 'SỐ GHế '],
      ['thanh', 968152988, 'Hà Nội - Thái Bình', 1],
      ['c thu nhài', '0375948661', 'Thái Bình - Hà Nội', 4],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    // SĐT dạng số bị mất số 0 đầu (968152988) phải được bù lại thành 0968152988
    expect(rows).toEqual([
      { phone: '0968152988', quantity: 1, customerName: 'thanh', route: 'Hà Nội - Thái Bình' },
      { phone: '0375948661', quantity: 4, customerName: 'c thu nhài', route: 'Thái Bình - Hà Nội' },
    ]);
  });

  it('vé "đã hủy" bị loại khỏi kết quả và được đếm riêng vào cancelledCount', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Số lượng', 'Trạng thái vé'],
      ['0901111111', 1, 'Đã thanh toán'],
      ['0902222222', 1, 'Đã hủy'],
    ]);
    const { rows, cancelledCount } = await parseTicketWorkbook(buffer);
    expect(rows.map((r) => r.phone)).toEqual(['0901111111']);
    expect(cancelledCount).toBe(1);
  });

  it('dòng không có số điện thoại (dòng TỔNG, dòng hoa hồng cuối bảng) bị bỏ qua', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Số lượng'],
      ['0901111111', 1],
      [null, 'hoa hồng'],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    expect(rows).toHaveLength(1);
  });

  it('file không có cột số lượng -> mỗi dòng mặc định tính là 1 vé', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Tên khách'],
      ['0901111111', 'A'],
      ['0901111111', 'A lần 2'],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    expect(rows.every((r) => r.quantity === 1)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('file có cột "Chuyến" gộp sẵn ngày giờ -> lấy nguyên văn làm departure', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Chuyến'],
      ['0901111111', '22-10-2026 15:30'],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    expect(rows[0].departure).toBe('22-10-2026 15:30');
  });

  it('file có cột ngày khởi hành + giờ đi riêng -> ghép lại thành "dd/mm/yyyy hh:mm"', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Ngày khởi hành', 'Giờ đi'],
      ['0901111111', '2026-10-04', '5h40'],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    expect(rows[0].departure).toBe('04/10/2026 05:40');
  });

  it('file không có cột số điện thoại -> báo lỗi rõ ràng', async () => {
    const buffer = await workbookBuffer([
      ['Tên khách', 'Tuyến'],
      ['A', 'Hà Nội - Thái Bình'],
    ]);
    await expect(parseTicketWorkbook(buffer)).rejects.toThrow(/Số điện thoại/);
  });
});
