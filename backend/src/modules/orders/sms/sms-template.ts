export interface SmsTemplateInput {
  route: string;
  departureTime: string;
  /** YYYY-MM-DD */
  departureDate: string;
}

/**
 * Mẫu tin nhắn: tự điền chuyến, giờ và ngày vào mẫu.
 * Phải khớp mẫu đã khai báo với VMG (sau khi bỏ dấu): "Quy Khach Dat Thanh Cong Chuyen Xe...
 * Quy Khach Luu Lai SDT... De... Tran Trong!". Lệch chữ hoa/thường hay dấu câu sẽ bị lỗi 011.
 */
export function buildBookingSms({
  route,
  departureTime,
  departureDate,
}: SmsTemplateInput): string {
  const [year, month, day] = departureDate.split('-');
  return (
    `Quý Khách Đặt Thành Công Chuyến Xe ${route} ${departureTime} ` +
    `ngày ${day}/${month}/${year}. Quý Khách Lưu Lại SĐT Tổng Đài 1900 1977. ` +
    `Để Tiện Đặt Xe Cho Chuyến Sau.Trân Trọng!`
  );
}
