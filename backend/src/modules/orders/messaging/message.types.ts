/** Kênh gửi tin cho khách */
export enum MessageChannel {
  SMS = 'SMS',
  ZALO = 'ZALO',
}

export interface OutgoingMessage {
  /** SĐT khách, dạng 0xxxxxxxxx hoặc +84xxxxxxxxx */
  phone: string;
  /** Nội dung đầy đủ (dùng cho SMS) */
  content: string;
  /** Tham số điền vào mẫu tin (dùng cho Zalo ZNS) */
  params: {
    customerName: string;
    route: string;
    departureTime: string;
    /** DD/MM/YYYY */
    departureDate: string;
  };
}

/** Kết quả nhà cung cấp trả về (nếu có) để tra trạng thái sau này */
export interface SendResult {
  referentId?: string;
}

export interface MessageProvider {
  readonly channel: MessageChannel;
  /** Đã có đủ khóa cấu hình để gửi thật chưa */
  isConfigured(): boolean;
  /** Ném lỗi nếu nhà cung cấp từ chối */
  send(message: OutgoingMessage): Promise<SendResult | void>;
}

/** 0912345678 / +84912345678 -> 84912345678 */
export function toInternationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84')) return digits;
  return `84${digits.replace(/^0/, '')}`;
}

/** +84912345678 / 84912345678 / 0912345678 -> 0912345678 (dạng nội địa, eSMS dùng cho SMS) */
export function toLocalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84')) return `0${digits.slice(2)}`;
  return digits.startsWith('0') ? digits : `0${digits}`;
}

/** Bỏ dấu tiếng Việt (SMS không dùng unicode rẻ hơn và ít lỗi hiển thị hơn) */
export function removeDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}
