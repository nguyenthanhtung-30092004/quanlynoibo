export interface SmsTemplateInput {
  route: string;
  departureTime: string;
  /** YYYY-MM-DD */
  departureDate: string;
}

/** Mẫu tin nhắn theo đặc tả: tự điền chuyến, giờ và ngày vào mẫu */
export function buildBookingSms({
  route,
  departureTime,
  departureDate,
}: SmsTemplateInput): string {
  const [year, month, day] = departureDate.split('-');
  return (
    `Thông tin: Quý khách đặt hàng thành công chuyến xe ${route} ${departureTime} ` +
    `ngày ${day}/${month}/${year}. Quý khách lưu lại SĐT Tổng đài 1900 1977. ` +
    `Để tiện đặt xe cho lần sau. Trân Trọng!`
  );
}
