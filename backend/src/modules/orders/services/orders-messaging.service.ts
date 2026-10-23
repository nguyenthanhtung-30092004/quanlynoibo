import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { User } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import { OrderHistory } from '../entities/order-history.entity.js';
import { MessageChannel, PaymentRequiredException } from '../messaging/message.types.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { buildBookingSms } from '../sms/sms-template.js';
import { toOrderView } from '../mappers/order.mapper.js';
import { OrdersQueryService } from './orders-query.service.js';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'lỗi không xác định';
}

@Injectable()
export class OrdersMessagingService {
  private readonly logger = new Logger(OrdersMessagingService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly historyRepository: Repository<OrderHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly messaging: MessagingService,
    private readonly queryService: OrdersQueryService,
  ) {}

  /** Ghi một dòng lịch sử; lỗi ghi lịch sử không được làm hỏng thao tác chính */
  async record(
    orderId: number,
    action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'SEND_MESSAGE',
    actor: JwtPayload,
    detail: { summary?: string } = {},
  ) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: actor.sub },
        select: { id: true, fullName: true },
      });
      await this.historyRepository.save(
        this.historyRepository.create({
          orderId,
          action,
          actorId: actor.sub,
          actorName: user?.fullName ?? actor.username ?? '',
          summary: detail.summary ?? null,
          changes: null,
        }),
      );
    } catch (err) {
      this.logger.error(`Không ghi được lịch sử đơn #${orderId}: ${(err as Error).message}`);
    }
  }

  /**
   * Gửi tin nhắn 1 chạm cho khách theo mẫu của đơn, qua kênh được chọn
   * (SMS hoặc Zalo). Chế độ chạy thử (dryRun) thì không gửi và không đánh dấu đã gửi.
   *
   * Chọn Zalo mà Zalo không gửi được (khách không có Zalo, token hết hạn, lỗi mạng,
   * chưa cấu hình...) thì tự gửi SMS thay thế; `fallbackReason` là lý do Zalo thất bại.
   * Riêng lỗi hết tiền (PaymentRequiredException) thì báo lỗi, không chuyển SMS.
   */
  async sendMessage(id: number, channel: MessageChannel, actor: JwtPayload) {
    const order = await this.queryService.findEntity(id, actor);
    const [year, month, day] = order.departureDate.split('-');
    const seats =
      order.seatCount > 0
        ? order.seatCount
        : order.seatFront + order.seatMiddle + order.seatBack;

    const message = {
      phone: order.phone,
      content: buildBookingSms({
        route: order.route.name,
        departureTime: order.departureTime,
        departureDate: order.departureDate,
      }),
      params: {
        customerName: order.customerName ?? '',
        route: order.route.name,
        departureTime: order.departureTime,
        departureDate: `${day}/${month}/${year}`,
        bookingCode: `XV${order.id}`,
        pickupPoint: order.pickupPoint ?? '',
        dropoffPoint: order.dropoffPoint ?? '',
        seatCount: seats > 0 ? String(seats) : '',
      },
    };

    let usedChannel = channel;
    let fallbackReason: string | null = null;
    let sent: { dryRun: boolean; referentId?: string };
    try {
      sent = await this.messaging.send(channel, message);
    } catch (err) {
      // Hết tiền thì báo luôn, không tự đổi sang kênh khác
      if (channel !== MessageChannel.ZALO || err instanceof PaymentRequiredException) throw err;
      fallbackReason = errorText(err);
      this.logger.warn(`Đơn #${order.id}: Zalo không gửi được (${fallbackReason}), chuyển sang SMS.`);
      try {
        sent = await this.messaging.send(MessageChannel.SMS, message);
        usedChannel = MessageChannel.SMS;
      } catch (smsErr) {
        throw new BadGatewayException(
          `Zalo không gửi được (${fallbackReason}) và gửi SMS dự phòng cũng thất bại (${errorText(smsErr)}).`,
        );
      }
    }
    const { dryRun, referentId } = sent;

    if (!dryRun) {
      await this.orderRepository.update(order.id, {
        smsSent: true,
        smsSentAt: new Date(),
        messageChannel: usedChannel,
        messageRefId: referentId ?? null,
        messageStatus: null,
      });
    }
    const label = usedChannel === MessageChannel.ZALO ? 'Zalo' : 'SMS';
    await this.record(order.id, 'SEND_MESSAGE', actor, {
      summary: fallbackReason
        ? `Zalo không gửi được (${fallbackReason}), đã tự gửi SMS cho khách${dryRun ? ' (chạy thử, chưa gửi thật)' : ''}`
        : `Gửi ${label} cho khách${dryRun ? ' (chạy thử, chưa gửi thật)' : ''}`,
    });
    return {
      order: await this.queryService.findOne(order.id, actor),
      dryRun,
      channel: usedChannel,
      fallbackReason,
    };
  }

  /** Tra trạng thái tin đã gửi (VMG) và lưu lại */
  async messageStatus(id: number, actor: JwtPayload) {
    const order = await this.queryService.findEntity(id, actor);
    if (!order.messageRefId) {
      throw new BadRequestException('Đơn này chưa có mã tham chiếu tin nhắn để tra trạng thái.');
    }
    const { status } = await this.messaging.checkVmgStatus(order.messageRefId);
    if (status !== null) {
      await this.orderRepository.update(order.id, { messageStatus: status });
    }
    return { status };
  }

  /** Callback VMG: status 1/2 = đã tới nhà mạng, -1/-2 = thất bại, còn lại = đang chờ */
  async applyCallback(referentId: string, status: number) {
    const mapped = status === 1 || status === 2 ? 1 : status === -1 || status === -2 ? 2 : 0;
    await this.orderRepository.update({ messageRefId: referentId }, { messageStatus: mapped });
  }
}
