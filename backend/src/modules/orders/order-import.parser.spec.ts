import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseOrderWorkbook } from './order-import.parser.js';

describe('order-import.parser', () => {
  it('đọc tiêu đề hai tầng với ô gộp "VỊ TRÍ", chữ hoa/thường lẫn lộn, cột tiền chứa rác và thiếu cột Ghi chú', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    // Dòng 1: Tiêu đề tầng 1 (VỊ TRÍ ở cột 9..12)
    const row1 = sheet.getRow(1);
    row1.values = [
      'NGÀY VÀO SỐ', // col 1
      'NV', // col 2
      'TÊN KHÁCH', // col 3
      'SỐ ĐIỆN THOẠI', // col 4
      'TUYẾN ĐI', // col 5
      'GiỜ ĐI', // col 6
      'NGÀY KHỞI HÀNH', // col 7
      'LOẠI HÌNH', // col 8
      'VỊ TRÍ', // col 9 (gộp 9-12)
      '', // col 10
      '', // col 11
      '', // col 12
      'GIÁ NHẬP', // col 13
      'GIÁ BÁN', // col 14
      'THÀNH TIỀN xvip', // col 15
      'ĐÃ CỌC', // col 16
      'NHỜ THU', // col 17
      'LÃI', // col 18
      'ĐỐI TÁC', // col 19
    ];
    sheet.mergeCells(1, 9, 1, 12);

    // Dòng 2: Tiêu đề tầng 2 (ĐẦU, GIỮA, CUỐI, SỐ GHẾ ở cột 9..12)
    const row2 = sheet.getRow(2);
    row2.getCell(9).value = 'ĐẦU';
    row2.getCell(10).value = 'GIỮA';
    row2.getCell(11).value = 'CUỐI';
    row2.getCell(12).value = 'SỐ GHẾ';

    // Dòng 3: Dữ liệu đơn hàng, cột tiền chứa chữ rác, không có cột Ghi chú
    const row3 = sheet.getRow(3);
    row3.values = [
      '15/10/2026', // col 1: entryDate
      'admin_nv', // col 2: NV (bị bỏ qua)
      'nguyễn văn mạnh', // col 3: customer
      '0912345678', // col 4: phone
      'Hà Nội - Hải Phòng', // col 5: route
      '08h30', // col 6: time
      '16/10/2026', // col 7: date
      'xe limousine', // col 8: vehicle
      1, // col 9: front
      2, // col 10: middle
      0, // col 11: back
      3, // col 12: seats
      'chưa nhập giá', // col 13: costPrice rác -> bỏ qua
      '250k rác', // col 14: sellPrice rác -> bỏ qua
      '#VALUE!', // col 15: thành tiền xvip -> bỏ qua
      'không cọc', // col 16: deposit rác -> bỏ qua
      'chưa rõ', // col 17: cod rác -> bỏ qua
      'lãi cao', // col 18: commission rác -> bỏ qua
      'hải phòng travel', // col 19: partner
    ];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseOrderWorkbook(buffer);

    expect(rows).toHaveLength(1);
    const order = rows[0];

    expect(order.rowNumber).toBe(3);
    expect(order.errors).toHaveLength(0);
    expect(order.customerName).toBe('Nguyễn Văn Mạnh');
    expect(order.phone).toBe('0912345678');
    expect(order.routeName).toBe('Hà Nội - Hải Phòng');
    expect(order.departureTime).toBe('08:30');
    expect(order.departureDate).toBe('2026-10-16');
    expect(order.entryDate).toBe('2026-10-15');
    expect(order.vehicleType).toBe('Xe Limousine');
    expect(order.partner).toBe('Hải Phòng Travel');

    // Ghế nhận đúng từ dòng 2
    expect(order.seatFront).toBe(1);
    expect(order.seatMiddle).toBe(2);
    expect(order.seatBack).toBe(0);
    expect(order.seatCount).toBe(3);

    // 13 cột cần thiết: các cột không đọc được gán mặc định an toàn
    expect(order.costPrice).toBe(0);
    expect(order.sellPrice).toBe(0);
    expect(order.deposit).toBe(0);
    expect(order.collectOnDelivery).toBe(0);
    expect(order.commission).toBe(0);
    expect(order.staffName).toBeUndefined();
    expect(order.pickupPoint).toBeUndefined();
    expect(order.dropoffPoint).toBeUndefined();
    expect(order.note).toBeUndefined();
    expect(order.cancelled).toBe(false);
  });

  it('tiêu đề một tầng (cách cũ) vẫn chạy bình thường khi dòng dưới là dữ liệu', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    sheet.getRow(1).values = [
      'Số điện thoại',
      'Tuyến đi',
      'Ngày khởi hành',
      'Giờ đi',
      'Số ghế',
      'Tên khách',
      'Ghi chú',
    ];

    sheet.getRow(2).values = [
      '0987654321',
      'Hà Nội - Sa Pa',
      '20/10/2026',
      '07:00',
      2,
      'trần thị bích',
      'Đón tại ngã tư',
    ];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseOrderWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[0].customerName).toBe('Trần Thị Bích');
    expect(rows[0].phone).toBe('0987654321');
    expect(rows[0].routeName).toBe('Hà Nội - Sa Pa');
    expect(rows[0].seatCount).toBe(2);
    expect(rows[0].note).toBe('Đón tại ngã tư');
  });

  it('báo lỗi đúng khi dòng thiếu toàn bộ số ghế (cả số ghế và đầu/giữa/cuối đều bằng 0 hoặc trống)', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    sheet.getRow(1).values = [
      'Số điện thoại',
      'Tuyến đi',
      'Ngày khởi hành',
      'Giờ đi',
      'Số ghế',
      'Đầu',
      'Giữa',
      'Cuối',
    ];

    sheet.getRow(2).values = [
      '0912345678',
      'Hà Nội - Hải Phòng',
      '2026-10-16',
      '09:00',
      0,
      0,
      0,
      0,
    ];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseOrderWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toContain('thiếu số ghế (hoặc đầu/giữa/cuối)');
  });

  it('tiêu đề hai tầng nằm dưới dòng tiêu đề lớn của sổ vẫn nhận đủ cột số ghế', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');

    sheet.getRow(1).values = ['SỔ NHẬT KÝ THÁNG 10'];
    sheet.getRow(2).values = [
      'Số điện thoại',
      'Tuyến đi',
      'Ngày khởi hành',
      'Giờ đi',
      'Vị trí',
    ];
    sheet.getRow(3).getCell(5).value = 'Đầu';
    sheet.getRow(3).getCell(6).value = 'Giữa';
    sheet.getRow(3).getCell(7).value = 'Cuối';
    sheet.getRow(3).getCell(8).value = 'Số ghế';
    sheet.getRow(4).values = ['0912345678', 'Hà Nội - Hải Phòng', '2026-10-16', '09:00', 1, 0, 0, 1];

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const rows = await parseOrderWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].seatFront).toBe(1);
    expect(rows[0].seatCount).toBe(1);
  });
});
