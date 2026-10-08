import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  removeDiacritics,
  toInternationalPhone,
  type MessageProvider,
  type OutgoingMessage,
} from './message.types.js';

const BASE = 'https://rest.esms.vn/MainService.svc/json';
/** Tin brandname / chăm sóc khách hàng (SmsType 2): POST, cần Brandname + mẫu tin đã đăng ký */
const POST_ENDPOINT = `${BASE}/SendMultipleMessage_V4_post_json/`;
/** Tin đầu số cố định giá rẻ (SmsType 8): GET, không cần Brandname và mẫu tin */
const GET_ENDPOINT = `${BASE}/SendMultipleMessage_V4_get`;

interface EsmsResponse {
  CodeResult?: string;
  ErrorMessage?: string;
}

/** Mã lỗi thường gặp của eSMS, dịch ra để người dùng biết cần làm gì */
const ERROR_HINT: Record<string, string> = {
  '101': 'sai ApiKey hoặc SecretKey',
  '104': 'Brandname không tồn tại hoặc chưa đăng ký',
  '124': 'yêu cầu bị trùng',
  '146': 'mẫu tin chăm sóc khách hàng chưa được đăng ký với eSMS',
};

/**
 * Gửi SMS qua eSMS (https://developers.esms.vn).
 *
 * Biến môi trường:
 *  - ESMS_API_KEY, ESMS_SECRET_KEY  (bắt buộc)
 *  - ESMS_BRANDNAME  tên thương hiệu đã đăng ký. Có thì gửi tin brandname (SmsType 2),
 *                    bỏ trống thì gửi tin đầu số cố định (SmsType 8, không cần đăng ký gì thêm)
 *  - ESMS_SMS_TYPE   ghi đè loại tin nếu cần (mặc định tự chọn theo ESMS_BRANDNAME)
 *  - ESMS_UNICODE    true = gửi có dấu (đắt hơn); mặc định false = bỏ dấu
 *  - ESMS_SANDBOX    true = thử nghiệm: eSMS không gửi tới điện thoại và không tính phí
 *
 * Lưu ý: mã 100 chỉ xác nhận eSMS đã NHẬN yêu cầu, chưa chắc tin đã tới máy khách.
 */
@Injectable()
export class EsmsProvider implements MessageProvider {
  readonly channel = MessageChannel.SMS;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ESMS_API_KEY') && !!this.config.get<string>('ESMS_SECRET_KEY');
  }

  async send({ phone, content }: OutgoingMessage): Promise<void> {
    const unicode = this.config.get<string>('ESMS_UNICODE') === 'true';
    const sandbox = this.config.get<string>('ESMS_SANDBOX') === 'true';
    const brandname = this.config.get<string>('ESMS_BRANDNAME')?.trim();
    const smsType = this.config.get<string>('ESMS_SMS_TYPE')?.trim() || (brandname ? '2' : '8');

    const fields: Record<string, string> = {
      ApiKey: this.config.getOrThrow<string>('ESMS_API_KEY'),
      SecretKey: this.config.getOrThrow<string>('ESMS_SECRET_KEY'),
      Phone: toInternationalPhone(phone),
      Content: unicode ? content : removeDiacritics(content),
      SmsType: smsType,
      IsUnicode: unicode ? '1' : '0',
    };
    if (sandbox) fields.Sandbox = '1';

    let res: Response;
    try {
      if (smsType === '8') {
        // Đầu số cố định: eSMS chỉ hỗ trợ GET, không dùng Brandname
        res = await fetch(`${GET_ENDPOINT}?${new URLSearchParams(fields)}`, {
          signal: AbortSignal.timeout(15_000),
        });
      } else {
        if (brandname) fields.Brandname = brandname;
        res = await fetch(POST_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fields),
          signal: AbortSignal.timeout(15_000),
        });
      }
    } catch {
      throw new BadGatewayException('Không kết nối được eSMS. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as EsmsResponse | null;
    const code = json?.CodeResult;

    if (!res.ok || code !== '100') {
      const reason = (code && ERROR_HINT[code]) || json?.ErrorMessage;
      throw new BadGatewayException(
        `eSMS từ chối gửi tin (mã ${code ?? res.status})${reason ? `: ${reason}` : ''}.`,
      );
    }
  }
}
