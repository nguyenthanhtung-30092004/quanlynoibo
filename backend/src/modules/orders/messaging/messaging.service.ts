import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EsmsProvider } from './esms.provider.js';
import {
  MessageChannel,
  type MessageProvider,
  type OutgoingMessage,
} from './message.types.js';
import { SpeedSmsProvider } from './speedsms.provider.js';
import { VmgOttProvider } from './vmg-ott.provider.js';
import { VmgProvider } from './vmg.provider.js';
import { ZaloZnsProvider } from './zalo-zns.provider.js';

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  [MessageChannel.SMS]: 'SMS',
  [MessageChannel.ZALO]: 'Zalo',
};

/**
 * Chọn nhà cung cấp theo kênh người dùng bấm (SMS hoặc Zalo) rồi gửi.
 *
 * Kênh SMS dùng nhà cung cấp theo biến SMS_PROVIDER: "vmg", "speedsms" hoặc "esms" (mặc định).
 * Kênh Zalo gửi qua eSMS ZNS.
 *
 * Chưa có khóa cấu hình thì KHÔNG gửi và báo lỗi rõ ràng, trừ khi bật
 * MESSAGING_DRY_RUN=true (chế độ thử: chỉ ghi log, không gửi, không đánh dấu đã gửi).
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger('Messaging');

  constructor(
    private readonly config: ConfigService,
    private readonly esms: EsmsProvider,
    private readonly speedsms: SpeedSmsProvider,
    private readonly vmg: VmgProvider,
    private readonly vmgOtt: VmgOttProvider,
    private readonly zalo: ZaloZnsProvider,
  ) {}

  /** Đọc cấu hình mỗi lần gửi để đổi nhà cung cấp chỉ cần sửa .env */
  private providerFor(channel: MessageChannel): MessageProvider {
    if (channel === MessageChannel.ZALO) {
      return this.config.get<string>('ZALO_PROVIDER')?.trim().toLowerCase() === 'vmg'
        ? this.vmgOtt
        : this.zalo;
    }
    const name = this.config.get<string>('SMS_PROVIDER')?.trim().toLowerCase();
    if (name === 'vmg') return this.vmg;
    return name === 'speedsms' ? this.speedsms : this.esms;
  }

  /** Tra trạng thái tin SMS VMG theo referentId */
  checkVmgStatus(referentId: string) {
    return this.vmg.checkStatus(referentId);
  }

  /** @returns dryRun = true nếu chỉ chạy thử, chưa gửi thật */
  async send(
    channel: MessageChannel,
    message: OutgoingMessage,
  ): Promise<{ dryRun: boolean; referentId?: string }> {
    const provider = this.providerFor(channel);

    if (provider.isConfigured()) {
      const result = await provider.send(message);
      // eSMS Sandbox: eSMS nhận yêu cầu nhưng không gửi tới điện thoại, nên coi là chạy thử
      // (không đánh dấu đơn là "đã gửi").
      const esmsSandbox =
        (provider === this.esms || provider === this.zalo) &&
        this.config.get<string>('ESMS_SANDBOX') === 'true';
      return { dryRun: esmsSandbox, referentId: result?.referentId };
    }

    if (this.config.get<string>('MESSAGING_DRY_RUN') === 'true') {
      this.logger.warn(
        `[CHẠY THỬ - KHÔNG GỬI THẬT] ${CHANNEL_LABEL[channel]} tới ${message.phone}: ${message.content}`,
      );
      return { dryRun: true };
    }

    throw new ServiceUnavailableException(
      `Chưa cấu hình gửi ${CHANNEL_LABEL[channel]}. Hãy điền khóa của nhà cung cấp trong backend/.env (xem .env.example).`,
    );
  }
}
