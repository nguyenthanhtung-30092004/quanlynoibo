import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GOODS_VEHICLE_TYPE, Order } from '../entities/order.entity.js';
import { MessageChannel, PaymentRequiredException, toLocalPhone } from '../messaging/message.types.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { buildBookingSms } from '../sms/sms-template.js';
import { getBusinessDate, isReminderDue, startOfNextBusinessDay } from '../order-time-lock.js';

/** Quét mỗi 30 giây nên khách nhận tin lệch tối đa 30 giây so với mốc 1,5 tiếng trước giờ đi */
const CHECK_INTERVAL_MS = 30_000;

/** Báo lỗi hệ thống (hết tiền, token...) tối đa 10 phút một lần cho đỡ đầy log */
const WARN_EVERY_MS = 10 * 60 * 1000;

/** Zalo -124: access token hết hạn là lỗi chung, không phải lỗi của riêng khách */
const SYSTEM_ERROR_CODE = -124;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'lỗi không xác định';
}

/**
 * Lỗi của riêng khách này (vd số không có Zalo, mã -118) thì đánh dấu đã thử và bỏ qua.
 * Lỗi chung (mất mạng, hết tiền, token, chưa cấu hình) thì để đó, tick sau thử lại.
 */
export function isCustomerSpecificFailure(err: unknown): boolean {
  if (err instanceof PaymentRequiredException) return false;
  const match = /^Gửi Zalo thất bại \(mã (-?\d+)\)/.exec(errorText(err));
  return !!match && Number(match[1]) !== SYSTEM_ERROR_CODE;
}

/**
 * Nhắc khách qua Zalo trước giờ khởi hành 1,5 tiếng, theo giờ đi trong vé (cùng SĐT của vé đó).
 * Mỗi vé chỉ nhắc một lần (cột reminderSentAt). Không dùng thư viện lên lịch: một vòng lặp nhẹ là đủ,
 * giống tự chấm ra ở chấm công, và khởi động lại máy chủ vẫn nhắc bù được các chuyến còn trong khung 1,5 tiếng.
 *
 * Chỉ chạy khi đã khai báo mẫu nhắc ZALO_REMINDER_TEMPLATE_ID. Không tự chuyển sang SMS (chỉ nhắc bằng Zalo).
 */
@Injectable()
export class OrdersReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastWarnAt = 0;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.runOnce();
      if (sent > 0) this.logger.log(`Đã nhắc ${sent} khách qua Zalo trước giờ khởi hành 1,5 tiếng`);
    } catch (err) {
      this.logger.error(`Không nhắc được khách: ${errorText(err)}`);
    } finally {
      this.running = false;
    }
  }

  private warn(text: string) {
    const now = Date.now();
    if (now - this.lastWarnAt < WARN_EVERY_MS) return;
    this.lastWarnAt = now;
    this.logger.warn(text);
  }

  /** @returns số khách đã nhắc thành công trong lần quét này */
  async runOnce(now: Date = new Date()): Promise<number> {
    if (!this.messaging.isReminderReady()) return 0;

    // Khung 1,5 tiếng có thể vắt qua nửa đêm (chuyến 00:30 nhắc từ 23:00) nên lấy cả hôm nay và ngày mai
    const today = getBusinessDate(now);
    const tomorrow = getBusinessDate(startOfNextBusinessDay(today));
    const candidates = await this.orderRepository
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.route', 'route')
      .where('o.departureDate IN (:...dates)', { dates: [today, tomorrow] })
      .andWhere('o.cancelledAt IS NULL')
      .andWhere('o.reminderSentAt IS NULL')
      .andWhere('(o.vehicleType IS NULL OR o.vehicleType <> :goods)', { goods: GOODS_VEHICLE_TYPE })
      .orderBy('o.id', 'ASC')
      .getMany();

    const due = candidates.filter((o) => isReminderDue(o.departureDate, o.departureTime, now));
    // Một người đặt nhiều vé cùng chuyến thì chỉ nhắc một tin
    const seen = new Set<string>();
    let sent = 0;

    for (const order of due) {
      // Giành quyền nhắc trước khi gửi để hai lần quét chồng nhau không gửi trùng
      const claim = await this.orderRepository.update(
        { id: order.id, reminderSentAt: IsNull() },
        { reminderSentAt: now },
      );
      if (!claim.affected) continue;

      const key = [toLocalPhone(order.phone), order.routeId, order.departureDate, order.departureTime].join('|');
      if (seen.has(key)) {
        await this.orderRepository.update(order.id, { reminderError: 'Trùng chuyến với vé khác cùng SĐT, đã nhắc ở vé kia' });
        continue;
      }
      seen.add(key);

      const [year, month, day] = order.departureDate.split('-');
      try {
        const { dryRun } = await this.messaging.send(MessageChannel.ZALO, {
          phone: order.phone,
          zaloTemplate: 'reminder',
          content: buildBookingSms({
            route: order.route.name,
            departureTime: order.departureTime,
            departureDate: order.departureDate,
          }),
          params: {
            customerName: order.customerName ?? '',
            phone: order.phone,
            route: order.route.name,
            departureTime: order.departureTime,
            departureDate: `${day}/${month}/${year}`,
            bookingCode: `XV${order.id}`,
            pickupPoint: order.pickupPoint ?? '',
            dropoffPoint: order.dropoffPoint ?? '',
            seatCount: '',
          },
        });
        if (dryRun) {
          await this.orderRepository.update(order.id, { reminderError: 'Chế độ chạy thử (sandbox), chưa gửi thật' });
        } else {
          sent += 1;
        }
      } catch (err) {
        if (isCustomerSpecificFailure(err)) {
          await this.orderRepository.update(order.id, { reminderError: errorText(err).slice(0, 255) });
          continue;
        }
        // Lỗi chung: trả lại quyền nhắc và dừng lượt này, 30 giây sau thử lại
        await this.orderRepository.update(order.id, { reminderSentAt: null });
        this.warn(`Chưa nhắc được khách qua Zalo, sẽ thử lại: ${errorText(err)}`);
        break;
      }
    }
    return sent;
  }
}
