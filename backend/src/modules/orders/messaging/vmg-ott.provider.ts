import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  toInternationalPhone,
  type MessageProvider,
  type OutgoingMessage,
  type SendResult,
} from './message.types.js';

const DEFAULT_URL = 'https://api-ott.brandsms.vn/api/ott/send';

type ParamKey = keyof OutgoingMessage['params'];

const PARAM_ALIAS: Record<string, ParamKey> = {
  customer_name: 'customerName',
  route: 'route',
  departure_time: 'departureTime',
  departure_date: 'departureDate',
};

interface OttResponse {
  errorCode?: string;
  errorMessage?: string;
  referentId?: string;
  messages?: { errorCode?: string; errorMessage?: string; referentId?: string }[];
}

/**
 * Gửi tin Zalo (OTT) qua VMG: POST https://api-ott.brandsms.vn/api/ott/send, serviceType = 1.
 *
 * Biến môi trường (dùng thêm VMG_TOKEN, VMG_BRANDNAME của SMS):
 *  - VMG_ZALO_TEMPLATE_ID  templateId VMG cấp cho mẫu Zalo
 *  - VMG_ZALO_PARAMS       cặp "tên_tham_số_trong_mẫu=biến", ví dụ
 *                          param1=customer_name,param2=route,param3=departure_time,param4=departure_date
 *                          (biến: customer_name, route, departure_time, departure_date)
 *  - VMG_OTT_URL           mặc định https://api-ott.brandsms.vn/api/ott/send
 */
@Injectable()
export class VmgOttProvider implements MessageProvider {
  readonly channel = MessageChannel.ZALO;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>('VMG_TOKEN') &&
      !!this.config.get<string>('VMG_BRANDNAME') &&
      !!this.config.get<string>('VMG_ZALO_TEMPLATE_ID')
    );
  }

  async send({ phone, params }: OutgoingMessage): Promise<SendResult> {
    const templateData: Record<string, string> = {};
    for (const pair of (this.config.get<string>('VMG_ZALO_PARAMS') ?? '').split(',')) {
      const [name, alias] = pair.split('=').map((s) => s.trim());
      if (!name || !alias) continue;
      const key = PARAM_ALIAS[alias];
      if (!key) {
        throw new BadGatewayException(
          `VMG_ZALO_PARAMS có biến không hợp lệ: "${alias}". Chỉ dùng: ${Object.keys(PARAM_ALIAS).join(', ')}.`,
        );
      }
      templateData[name] = params[key];
    }

    let res: Response;
    try {
      res = await fetch(this.config.get<string>('VMG_OTT_URL')?.trim() || DEFAULT_URL, {
        method: 'POST',
        headers: {
          token: this.config.getOrThrow<string>('VMG_TOKEN').trim(),
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          from: this.config.getOrThrow<string>('VMG_BRANDNAME').trim(),
          type: 1,
          serviceType: 1,
          messages: [
            {
              to: toInternationalPhone(phone),
              requestID: '',
              scheduled: '',
              templateId: this.config.getOrThrow<string>('VMG_ZALO_TEMPLATE_ID').trim(),
              useUnicode: 1,
              templateData,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được VMG. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as OttResponse | null;
    const item = json?.messages?.[0];
    // Mã chung khác 000 => cả lô thất bại; 000 thì xét mã của từng tin
    const code = json?.errorCode !== '000' ? json?.errorCode : item?.errorCode;
    if (!res.ok || code !== '000') {
      const reason = item?.errorMessage || json?.errorMessage;
      throw new BadGatewayException(
        `Gửi Zalo qua VMG thất bại (mã ${code ?? res.status})${reason ? `: ${reason}` : ''}.`,
      );
    }
    return { referentId: item?.referentId ?? json?.referentId };
  }
}
