import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  removeDiacritics,
  toInternationalPhone,
  type MessageProvider,
  type OutgoingMessage,
} from './message.types.js';

const ENDPOINT = 'https://api.speedsms.vn/index.php/sms/send';

const ERROR_HINT: Record<string, string> = {
  '007': 'IP của máy chủ đang bị khóa/chưa được phép',
  '008': 'tài khoản bị khóa',
  '009': 'tài khoản chưa được phép dùng API',
  '101': 'thiếu hoặc sai tham số',
  '105': 'số điện thoại không hợp lệ',
  '113': 'nội dung quá dài',
  '300': 'không đủ số dư tài khoản',
  '500': 'lỗi phía SpeedSMS, thử lại sau',
};

interface SpeedSmsResponse {
  status?: string;
  code?: string;
  message?: string;
  data?: { tranId?: number; totalSMS?: number; totalPrice?: number };
}

/**
 * Gửi SMS qua SpeedSMS (https://speedsms.vn/sms-api-service/).
 *
 * Biến môi trường:
 *  - SPEEDSMS_TOKEN    access token (connect.speedsms.vn > Settings > Profile)
 *  - SPEEDSMS_TYPE     loại tin: 2 = đầu số ngẫu nhiên (không cần Brandname, mặc định),
 *                      3 = Brandname đã đăng ký, 4 = Brandname mặc định (Verify/Notify),
 *                      5 = gửi bằng app Android
 *  - SPEEDSMS_SENDER   tên Brandname (loại 3, 4) hoặc mã thiết bị (loại 5); loại 2 để trống
 *  - SPEEDSMS_UNICODE  true = gửi có dấu (mỗi tin ít ký tự hơn, có thể đắt hơn); mặc định bỏ dấu
 */
@Injectable()
export class SpeedSmsProvider implements MessageProvider {
  readonly channel = MessageChannel.SMS;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('SPEEDSMS_TOKEN');
  }

  async send({ phone, content }: OutgoingMessage): Promise<void> {
    const unicode = this.config.get<string>('SPEEDSMS_UNICODE') === 'true';
    const sender = this.config.get<string>('SPEEDSMS_SENDER')?.trim();

    const query = new URLSearchParams({
      'access-token': this.config.getOrThrow<string>('SPEEDSMS_TOKEN'),
      to: toInternationalPhone(phone),
      content: unicode ? content : removeDiacritics(content),
      type: this.config.get<string>('SPEEDSMS_TYPE')?.trim() || '2',
    });
    if (sender) query.set('sender', sender);

    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?${query}`, {
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được SpeedSMS. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as SpeedSmsResponse | null;

    if (!res.ok || json?.status !== 'success') {
      const code = json?.code;
      const message = json?.message;
      // Lỗi "sender not found": tài khoản chưa có tên người gửi (Brandname/đầu số) được bật cho loại tin này
      const reason =
        (code && ERROR_HINT[code]) ||
        (message === 'sender not found'
          ? 'tài khoản chưa có tên người gửi (sender) được bật cho loại tin này. Vào SpeedSMS đăng ký/kích hoạt sender hoặc liên hệ hỗ trợ'
          : message);
      throw new BadGatewayException(
        `SpeedSMS từ chối gửi tin${code ? ` (mã ${code})` : ''}${reason ? `: ${reason}` : ''}.`,
      );
    }
  }
}
