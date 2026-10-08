import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  toInternationalPhone,
  type MessageProvider,
  type OutgoingMessage,
} from './message.types.js';

const ENDPOINT = 'https://rest.esms.vn/MainService.svc/json/Send_zns_bulk_v4_post_json/';

type ParamKey = keyof OutgoingMessage['params'];

/** Tên tham số trong ESMS_ZALO_PARAMS -> giá trị lấy từ đơn */
const PARAM_ALIAS: Record<string, ParamKey> = {
  customer_name: 'customerName',
  route: 'route',
  departure_time: 'departureTime',
  departure_date: 'departureDate',
};

const ERROR_HINT: Record<string, string> = {
  '101': 'sai ApiKey hoặc SecretKey',
  '789': 'mẫu tin (TempID) chưa được cấu hình cho tài khoản eSMS này',
};

/**
 * Gửi tin Zalo ZNS qua eSMS (https://developers.esms.vn), nên KHÔNG phải tự làm
 * mới access token của Zalo.
 *
 * Điều kiện: Official Account (OA) đã liên kết với eSMS và mẫu ZNS đã được duyệt.
 *
 * Biến môi trường:
 *  - ESMS_API_KEY, ESMS_SECRET_KEY  (dùng chung với SMS)
 *  - ESMS_ZALO_OAID    ID của Zalo OA
 *  - ESMS_ZALO_TEMPID  ID mẫu ZNS đã duyệt
 *  - ESMS_ZALO_PARAMS  thứ tự các biến trong mẫu, ngăn cách bằng dấu phẩy. Chọn trong:
 *                      customer_name, route, departure_time, departure_date
 *                      (mặc định: customer_name,route,departure_time,departure_date)
 *  - ESMS_SANDBOX      true = thử nghiệm, không gửi thật và không tính phí
 *
 * ZNS chỉ gửi theo mẫu đã duyệt, không gửi chữ tự do. Mã 100 chỉ xác nhận eSMS đã
 * NHẬN yêu cầu, chưa chắc Zalo đã chuyển tới khách.
 */
@Injectable()
export class ZaloZnsProvider implements MessageProvider {
  readonly channel = MessageChannel.ZALO;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>('ESMS_API_KEY') &&
      !!this.config.get<string>('ESMS_SECRET_KEY') &&
      !!this.config.get<string>('ESMS_ZALO_OAID') &&
      !!this.config.get<string>('ESMS_ZALO_TEMPID')
    );
  }

  async send({ phone, params }: OutgoingMessage): Promise<void> {
    const order = (
      this.config.get<string>('ESMS_ZALO_PARAMS') ??
      'customer_name,route,departure_time,departure_date'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const values = order.map((name) => {
      const key = PARAM_ALIAS[name];
      if (!key) {
        throw new BadGatewayException(
          `ESMS_ZALO_PARAMS có tên không hợp lệ: "${name}". Chỉ dùng: ${Object.keys(PARAM_ALIAS).join(', ')}.`,
        );
      }
      return params[key];
    });

    const body: Record<string, unknown> = {
      ApiKey: this.config.getOrThrow<string>('ESMS_API_KEY'),
      SecretKey: this.config.getOrThrow<string>('ESMS_SECRET_KEY'),
      OAID: this.config.getOrThrow<string>('ESMS_ZALO_OAID'),
      TempID: this.config.getOrThrow<string>('ESMS_ZALO_TEMPID'),
      Data: [{ Phone: toInternationalPhone(phone), Params: values }],
    };
    if (this.config.get<string>('ESMS_SANDBOX') === 'true') body.Sandbox = '1';

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được eSMS. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as {
      CodeResult?: string;
      ErrorMessage?: string;
    } | null;
    const code = json?.CodeResult;

    if (!res.ok || code !== '100') {
      const reason = (code && ERROR_HINT[code]) || json?.ErrorMessage;
      throw new BadGatewayException(
        `Gửi Zalo qua eSMS thất bại (mã ${code ?? res.status})${reason ? `: ${reason}` : ''}.`,
      );
    }
  }
}
