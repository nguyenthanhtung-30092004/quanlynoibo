import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageChannel,
  removeDiacritics,
  toLocalPhone,
  type MessageProvider,
  type SendResult,
  type OutgoingMessage,
} from './message.types.js';

const DEFAULT_BASE_URL = 'https://api.brandsms.vn/api';

const ERROR_HINT: Record<string, string> = {
  '001': 'dữ liệu gửi không hợp lệ',
  '100': 'token không hợp lệ',
  '101': 'tài khoản bị khóa',
  '102': 'tài khoản không đúng',
  '103': 'tài khoản không có quyền',
  '304': 'tin bị lặp (cùng nội dung tới cùng số trong 5 phút)',
  '904': 'Brandname không hợp lệ',
  '005': 'số điện thoại nhận không hợp lệ',
  '007': 'nội dung chứa từ khóa bị chặn',
  '008': 'nội dung chứa ký tự unicode',
  '009': 'nội dung có ký tự không hợp lệ (GSM 03.38)',
  '010': 'độ dài nội dung không hợp lệ',
  '011': 'nội dung không khớp với mẫu tin đã khai báo',
  '012': 'tài khoản không được phân gửi tới nhà mạng này',
  '013': 'số điện thoại nằm trong danh sách cấm gửi',
  '014': 'tài khoản không đủ tiền',
  '015': 'tài khoản không đủ tin để gửi',
  '801': 'mẫu tin chưa được thiết lập',
  '802': 'tài khoản chưa được thiết lập profile',
  '803': 'tài khoản chưa được thiết lập giá',
  '804': 'đường gửi tin chưa được thiết lập',
  '999': 'lỗi hệ thống VMG, thử lại sau',
};

interface VmgResponse {
  errorCode?: string;
  errorMessage?: string;
  referentId?: string;
}

/**
 * Gửi SMS Brandname CSKH qua VMG (https://brandsms.vn), API: SMSBrandname/SendSMS.
 *
 * Biến môi trường:
 *  - VMG_TOKEN       token VMG cấp (bắt buộc)
 *  - VMG_BRANDNAME   Brandname đã đăng ký (bắt buộc)
 *  - VMG_BASE_URL    mặc định https://api.brandsms.vn/api
 *
 * Lưu ý của VMG: IP máy chủ gọi API phải được khai báo với VMG; nội dung tin phải
 * khớp mẫu tin đã khai báo (mã 011 nếu lệch). Tin bỏ dấu (useUnicode = 0).
 */
@Injectable()
export class VmgProvider implements MessageProvider {
  readonly channel = MessageChannel.SMS;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      !!this.config.get<string>('VMG_TOKEN') && !!this.config.get<string>('VMG_BRANDNAME')
    );
  }

  async send({ phone, content }: OutgoingMessage): Promise<SendResult> {
    const baseUrl = (this.config.get<string>('VMG_BASE_URL')?.trim() || DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/SMSBrandname/SendSMS`, {
        method: 'POST',
        headers: {
          token: this.config.getOrThrow<string>('VMG_TOKEN').trim(),
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          to: toLocalPhone(phone),
          type: 1,
          from: this.config.getOrThrow<string>('VMG_BRANDNAME').trim(),
          message: removeDiacritics(content),
          scheduled: '',
          requestId: '',
          useUnicode: 0,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được VMG. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as VmgResponse | VmgResponse[] | null;
    const result = Array.isArray(json) ? json[0] : json;

    if (!res.ok || !result || result.errorCode !== '000') {
      const code = result?.errorCode;
      const reason = (code && ERROR_HINT[code]) || result?.errorMessage;
      throw new BadGatewayException(
        `VMG từ chối gửi tin${code ? ` (mã ${code})` : ` (HTTP ${res.status})`}${reason ? `: ${reason}` : ''}.`,
      );
    }
    return { referentId: result.referentId };
  }

  /**
   * Tra trạng thái tin theo referentId (programCode).
   * 0 = chờ báo cáo, 1 = thành công, 2 = thất bại.
   */
  async checkStatus(referentId: string): Promise<{ status: number | null }> {
    const reportUrl =
      this.config.get<string>('VMG_REPORT_URL')?.trim() ||
      'https://report-api.brandsms.vn/api/Brandname/ReportDetailSend';
    let res: Response;
    try {
      res = await fetch(reportUrl, {
        method: 'POST',
        headers: {
          Token: this.config.getOrThrow<string>('VMG_TOKEN').trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ programCode: referentId }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được VMG để tra trạng thái.');
    }
    const json = (await res.json().catch(() => null)) as {
      data?: { status?: number }[];
    } | null;
    return { status: json?.data?.[0]?.status ?? null };
  }
}
