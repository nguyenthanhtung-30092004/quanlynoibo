import { describe, expect, it } from 'vitest';
import { parseOrderText } from './parse-order-text';

describe('parseOrderText', () => {
  it('đọc đoạn tin nhắn đặt vé viết tay', () => {
    const text = `14h ngày 11/10
0912345678 lê anh/ Nguyễn Văn Luân
đón ks alacar
trả đường tròn điềm thụy phú bình tn
2 ghế`;
    expect(parseOrderText(text, 2026)).toEqual({
      departureTime: '14:00',
      departureDate: '2026-10-11',
      phone: '0912345678',
      customerName: 'lê anh/ Nguyễn Văn Luân',
      pickupPoint: 'ks alacar',
      dropoffPoint: 'đường tròn điềm thụy phú bình tn',
      seatCount: 2,
    });
  });

  it('đọc được nội dung do nút Sao chép tạo ra', () => {
    const text = `13:30 ngày 05/11/2026
Hoàng Phương - 0827352345
Đón: Bến xe Mỹ Đình
Trả: Hạ Long
3 ghế
1 ghế đầu + 2 ghế cuối`;
    expect(parseOrderText(text, 2026)).toEqual({
      departureTime: '13:30',
      departureDate: '2026-11-05',
      phone: '0827352345',
      customerName: 'Hoàng Phương',
      pickupPoint: 'Bến xe Mỹ Đình',
      dropoffPoint: 'Hạ Long',
      seatCount: 3,
      seatFront: 1,
      seatBack: 2,
    });
  });

  it('chuẩn hóa số điện thoại có dấu cách, +84; bỏ ô không đọc được', () => {
    expect(parseOrderText('+84 912 345 678 An', 2026)).toEqual({
      phone: '0912345678',
      customerName: 'An',
    });
    expect(parseOrderText('', 2026)).toEqual({});
    expect(parseOrderText('chào bạn', 2026)).toEqual({ customerName: 'chào bạn' });
  });

  it('bỏ qua ngày giờ không hợp lệ', () => {
    expect(parseOrderText('32/13 25h', 2026)).toEqual({});
  });

  it('đọc số ghế theo vị trí viết gọn, không cần chữ "ghế"', () => {
    expect(parseOrderText('2 đầu 1 cuối', 2026)).toEqual({ seatFront: 2, seatBack: 1 });
    expect(parseOrderText('đầu 2 giữa 1', 2026)).toEqual({ seatFront: 2, seatMiddle: 1 });
    expect(parseOrderText('0912345678 An\n2 đầu 1 cuối', 2026)).toEqual({
      phone: '0912345678',
      customerName: 'An',
      seatFront: 2,
      seatBack: 1,
    });
  });
});
