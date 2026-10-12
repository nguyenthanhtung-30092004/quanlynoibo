import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  toInternationalPhone,
  type MessageProvider,
  type OutgoingMessage,
} from './message.types.js';
import { ZaloTokenService } from './zalo-token.service.js';

const ENDPOINT = 'https://business.openapi.zalo.me/message/template';

type ParamKey = keyof OutgoingMessage['params'];

/** Giá trị lấy từ đơn, dùng trong ZALO_TEMPLATE_PARAMS */
const PARAM_ALIAS: Record<string, ParamKey> = {
  customer_name: 'customerName',
  route: 'route',
  departure_time: 'departureTime',
  departure_date: 'departureDate',
};

const DEFAULT_PARAMS =
  'customer_name=customer_name,route=route,departure_time=departure_time,departure_date=departure_date';

const ERROR_HINT: Record<number, string> = {
  [-124]: 'access token không hợp lệ hoặc đã hết hạn',
};

/**
 * Gửi tin Zalo ZNS thẳng qua API Zalo (https://business.openapi.zalo.me/message/template),
 * gửi theo số điện thoại, khách không cần quan tâm OA.
 *
 * Điều kiện: OA đã xác thực, tài khoản ZBA có tiền, mẫu ZNS đã duyệt, ứng dụng đã liên kết OA.
 *
 * Biến môi trường:
 *  - ZALO_APP_ID, ZALO_APP_SECRET  khóa ứng dụng ở developers.zalo.me
 *  - ZALO_REFRESH_TOKEN            refresh token cấp lần đầu (sau đó hệ thống tự lưu cặp mới)
 *  - ZALO_TEMPLATE_ID              ID mẫu ZNS đã duyệt
 *  - ZALO_TEMPLATE_PARAMS          "tên biến trong mẫu=giá trị lấy từ đơn", ngăn cách bằng dấu phẩy.
 *                                  Giá trị chọn trong: customer_name, route, departure_time,
 *                                  departure_date (mặc định: mỗi biến trùng tên với giá trị)
 *  - ZALO_SANDBOX                  true = chế độ development, không tính phí, chỉ gửi được cho
 *                                  quản trị viên của OA
 */
@Injectable()
export class ZaloZnsProvider implements MessageProvider {
  readonly channel = MessageChannel.ZALO;

  constructor(
    private readonly config: ConfigService,
    private readonly tokens: ZaloTokenService,
  ) {}

  isConfigured(): boolean {
    return this.tokens.hasCredentials() && !!this.config.get<string>('ZALO_TEMPLATE_ID');
  }

  async send({ phone, params }: OutgoingMessage): Promise<void> {
    const templateData: Record<string, string> = {};
    for (const pair of (this.config.get<string>('ZALO_TEMPLATE_PARAMS') || DEFAULT_PARAMS).split(',')) {
      if (!pair.trim()) continue;
      const [name, alias] = pair.split('=').map((s) => s.trim());
      const key = PARAM_ALIAS[alias];
      if (!name || !key) {
        throw new BadGatewayException(
          `ZALO_TEMPLATE_PARAMS có mục không hợp lệ: "${pair.trim()}". Dạng đúng: tên_biến=giá_trị, giá trị chỉ dùng: ${Object.keys(PARAM_ALIAS).join(', ')}.`,
        );
      }
      templateData[name] = params[key];
    }

    const body: Record<string, unknown> = {
      phone: toInternationalPhone(phone),
      template_id: this.config.getOrThrow<string>('ZALO_TEMPLATE_ID').trim(),
      template_data: templateData,
    };
    if (this.config.get<string>('ZALO_SANDBOX') === 'true') body.mode = 'development';

    const accessToken = await this.tokens.getAccessToken();

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', access_token: accessToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được Zalo. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as {
      error?: number;
      message?: string;
    } | null;

    if (!res.ok || json?.error !== 0) {
      const code = json?.error;
      const reason = (code !== undefined && ERROR_HINT[code]) || json?.message;
      throw new BadGatewayException(
        `Gửi Zalo thất bại (mã ${code ?? res.status})${reason ? `: ${reason}` : ''}.`,
      );
    }
  }
}
