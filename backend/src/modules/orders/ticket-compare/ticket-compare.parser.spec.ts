import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { depositScale, parseDeposit, parseTicketWorkbook } from './ticket-compare.parser.js';

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
    expect(rows).toMatchObject([
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
    expect(rows).toMatchObject([
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
    expect(rows.map((r) => r.phone)).toMatchObject(['0901111111']);
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

describe('file đối chiếu công nợ nhà xe (nhiều sheet, cột Ngày / SDT / Đã thu tiền)', () => {
  it('bỏ qua sheet không có cột SĐT, đọc gộp các sheet có SĐT; lấy ngày và tiền đã thu', async () => {
    const wb = new ExcelJS.Workbook();
    const pivot = wb.addWorksheet('Sheet1');
    pivot.addRow(['Row Labels', 'Sum of Đã thu tiền']);
    pivot.addRow(['01/10/2026', 270000]);
    const header = ['Ngày', 'Giờ đi', 'Xe', 'Khách hàng', 'SDT', 'Tuyến', 'Tổng số vé', 'Tổng số vé', 'Thành tiền', 'Phụ thu', 'Thành tiền', 'Đã thu tiền'];
    const khach = wb.addWorksheet('Vé khách');
    khach.addRow(['BẢNG CHI TIẾT ĐỐI CHIẾU CÔNG NỢ']);
    khach.addRow(header);
    khach.addRow(['01/10/2026', '05:00', '15H', 'Lan', '0869406881', 'Hải Phòng - Hà Nội', 1, 0, 260000, 0, 260000, 0]);
    khach.addRow(['Số còn lại thanh toán', '', '', '', '', '', '', '', 11092500]);
    // Dòng tổng tiền có số lọt vào cột SĐT: không phải số điện thoại nên bị bỏ
    khach.addRow(['Số còn lại thanh toán TM', '', '', '', 11092500]);
    const hang = wb.addWorksheet('Vé Hàng');
    hang.addRow(header);
    hang.addRow(['07/10/2026', '11:00', '29G', 'GỬI GIẤY TỜ', '0382218267', 'Hà Nội - Hải Phòng', 1, 1, 170000, 0, 170000, 170000]);
    const { rows } = await parseTicketWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(rows).toMatchObject([
      { phone: '0869406881', day: '2026-10-01', quantity: 1, deposit: 0 },
      { phone: '0382218267', day: '2026-10-07', quantity: 1, deposit: 170000 },
    ]);
  });

  it('file nội bộ: lấy NGÀY KHỞI HÀNH và ĐÃ CỌC (nghìn đồng quy ra đồng)', async () => {
    const buffer = await workbookBuffer([
      ['NGÀY VÀO SỐ', 'TÊN KHÁCH', ' SỐ ĐiỆN THOẠI', 'NGÀY KHỞI HÀNH ', 'SỐ GHế ', 'ĐÃ CỌC '],
      [new Date(Date.UTC(2026, 8, 30)), 'huệ', 934337344, new Date(Date.UTC(2026, 9, 1)), 2, 260],
    ]);
    const { rows } = await parseTicketWorkbook(buffer);
    expect(rows).toMatchObject([{ phone: '0934337344', day: '2026-10-01', quantity: 2, deposit: 260000 }]);
  });

  it('cột "Chuyến" gộp ngày giờ cũng lấy được ngày khởi hành', async () => {
    const buffer = await workbookBuffer([
      ['Số điện thoại', 'Chuyến'],
      ['0355790076', '22-10-2026 15:30'],
    ]);
    expect((await parseTicketWorkbook(buffer)).rows[0].day).toBe('2026-10-22');
  });
});

describe('parseDeposit và đơn vị tiền', () => {
  it('đọc đúng số trong ô: số, chữ có dấu chấm, chữ có "k"', () => {
    expect(parseDeposit(170)).toBe(170);
    expect(parseDeposit(170000)).toBe(170000);
    expect(parseDeposit('170.000')).toBe(170000);
    expect(parseDeposit('250k')).toBe(250000);
    expect(parseDeposit(null)).toBe(0);
    expect(parseDeposit(0)).toBe(0);
    expect(parseDeposit('abc')).toBe(0);
  });

  it('cả file đều nhỏ hơn 20.000 -> nghìn đồng (kể cả 1000 = 1 triệu); có số lớn -> đồng', () => {
    expect(depositScale([170, 260, 1000, 0])).toBe(1000);
    expect(depositScale([170000, 1000000])).toBe(1);
    expect(depositScale([0, 0])).toBe(1);
  });

  it('file nội bộ cọc 1000 (nghìn đồng) đọc ra 1.000.000đ', async () => {
    const buffer = await workbookBuffer([
      ['SỐ ĐIỆN THOẠI', 'NGÀY KHỞI HÀNH', 'ĐÃ CỌC'],
      ['0986588288', '31/10/2026', 1000],
      ['0912345678', '31/10/2026', 170],
    ]);
    expect((await parseTicketWorkbook(buffer)).rows.map((r) => r.deposit)).toEqual([1000000, 170000]);
  });
});
