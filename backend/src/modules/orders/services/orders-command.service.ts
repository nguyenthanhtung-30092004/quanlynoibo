import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Partner } from '../../partners/entities/partner.entity.js';
import { Route } from '../../routes/entities/route.entity.js';
import { User, UserRole } from '../../users/entities/user.entity.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { UpdateOrderDto } from '../dto/update-order.dto.js';
import { Order } from '../entities/order.entity.js';
import {
  OrderChange,
  OrderHistory,
  OrderHistoryAction,
} from '../entities/order-history.entity.js';
import {
  getBusinessDate,
  isOrderCreationLocked,
} from '../order-time-lock.js';
import { matchCanonicalPartner } from '../order-partner.util.js';
import {
  resolveSeats,
  seatsOf,
  titleCaseName,
  TRACKED_FIELDS,
} from '../mappers/order.mapper.js';
import { OrdersQueryService } from './orders-query.service.js';
import { OrdersReportService } from './orders-report.service.js';
import { OrdersColumnValuesService } from './orders-column-values.service.js';

@Injectable()
export class OrdersCommandService {
  private readonly logger = new Logger(OrdersCommandService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly historyRepository: Repository<OrderHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    private readonly queryService: OrdersQueryService,
    private readonly reportService: OrdersReportService,
    private readonly columnValuesService: OrdersColumnValuesService,
  ) {}

  private readonly usableRouteCache = new Map<number, { usable: boolean; expiresAt: number }>();
  private readonly MASTER_DATA_TTL_MS = 30_000;

  clearReportsAndFilterCache(): void {
    this.reportService.clearCache();
    this.columnValuesService.clearCache();
  }

  async assertRouteUsable(routeId: number) {
    const now = Date.now();
    const cached = this.usableRouteCache.get(routeId);
    if (cached && cached.expiresAt > now) {
      if (!cached.usable) {
        throw new BadRequestException(
          'Tuyến đi không tồn tại hoặc đã ngừng hoạt động.',
        );
      }
      return;
    }
    const route = await this.routeRepository.findOne({
      where: { id: routeId },
      select: { id: true, isActive: true },
    });
    const usable = !!route && route.isActive;
    this.usableRouteCache.set(routeId, { usable, expiresAt: now + this.MASTER_DATA_TTL_MS });
    if (!usable) {
      throw new BadRequestException(
        'Tuyến đi không tồn tại hoặc đã ngừng hoạt động.',
      );
    }
  }

  /**
   * Tạo đơn. Nhân viên chỉ tạo được từ 04h30 đến 22h30 (giờ VN), Admin không bị khóa.
   * Ngày vào sổ và nhân viên được điền tự động.
   */
  async create(
    dto: CreateOrderDto,
    actor: JwtPayload,
    options: { entryDate?: string } = {},
  ) {
    if (actor.role !== UserRole.ADMIN && isOrderCreationLocked()) {
      throw new ForbiddenException(
        'Nhân viên chỉ được tạo đơn từ 04h30 đến 22h30. Khung giờ này đang khóa theo quy chế nội bộ.',
      );
    }

    // Staff luôn tạo đơn cho chính mình; chỉ Admin được chỉ định nhân viên khác
    let ownerId = actor.sub;
    if (dto.staffId !== undefined && dto.staffId !== actor.sub) {
      if (actor.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Bạn chỉ được tạo đơn cho chính mình.');
      }
      const owner = await this.userRepository.findOne({
        where: { id: dto.staffId, isActive: true },
      });
      if (!owner) {
        throw new BadRequestException(
          'Nhân viên phụ trách không tồn tại hoặc đã bị khóa.',
        );
      }
      ownerId = owner.id;
    }

    await this.assertRouteUsable(dto.routeId);

    let canonicalPartner: string | null = null;
    if (dto.partner && dto.partner.trim()) {
      const allPartners = await this.queryService.getCachedPartners();
      const matched = matchCanonicalPartner(dto.partner, allPartners);
      if (matched === undefined) {
        throw new BadRequestException(
          `Đối tác "${dto.partner}" không có trong danh sách. Hãy chọn đối tác có sẵn.`,
        );
      }
      canonicalPartner = matched;
    }

    const costPrice = dto.costPrice ?? 0;
    const sellPrice = dto.sellPrice ?? 0;

    const seats = resolveSeats(dto);
    if (seats.seatCount + seats.seatFront + seats.seatMiddle + seats.seatBack < 1) {
      throw new BadRequestException('Nhập số ghế hoặc ghế đầu/giữa/cuối (ít nhất 1).');
    }

    const saved = await this.orderRepository.save(
      this.orderRepository.create({
        entryDate: options.entryDate ?? getBusinessDate(),
        createdById: ownerId,
        customerName: titleCaseName(dto.customerName) || null,
        phone: dto.phone,
        routeId: dto.routeId,
        departureTime: dto.departureTime,
        departureDate: dto.departureDate,
        vehicleType: dto.vehicleType || null,
        seatZone: null,
        ...seats,
        costPrice,
        sellPrice,
        deposit: dto.deposit ?? 0,
        collectOnDelivery: dto.collectOnDelivery ?? 0,
        commission: dto.commission ?? 0,
        partner: canonicalPartner,
        pickupPoint: dto.pickupPoint || null,
        dropoffPoint: dto.dropoffPoint || null,
        note: dto.note || null,
      }),
    );
    await this.record(saved.id, 'CREATE', actor, { summary: 'Tạo đơn' });
    this.clearReportsAndFilterCache();
    return this.queryService.findOne(saved.id, actor);
  }

  async update(id: number, dto: UpdateOrderDto, actor: JwtPayload) {
    const order = await this.queryService.findEntity(id, actor);
    if (order.cancelledAt) {
      throw new BadRequestException('Vé đã hủy, không thể sửa.');
    }

    if (dto.routeId !== undefined && dto.routeId !== order.routeId) {
      await this.assertRouteUsable(dto.routeId);
    }

    let nextPartner = order.partner;
    if (dto.partner !== undefined) {
      const currentPartnerRaw = order.partner ? order.partner.trim() : null;
      const newPartnerRaw =
        dto.partner && dto.partner.trim() ? dto.partner.trim() : null;
      if (newPartnerRaw !== currentPartnerRaw) {
        if (!newPartnerRaw) {
          nextPartner = null;
        } else {
          const allPartners = await this.queryService.getCachedPartners();
          const matched = matchCanonicalPartner(newPartnerRaw, allPartners);
          if (matched === undefined) {
            throw new BadRequestException(
              `Đối tác "${dto.partner}" không có trong danh sách. Hãy chọn đối tác có sẵn.`,
            );
          }
          nextPartner = matched;
        }
      }
    }

    const nextSeats = resolveSeats(dto, order);
    if (nextSeats.seatCount + nextSeats.seatFront + nextSeats.seatMiddle + nextSeats.seatBack < 1) {
      throw new BadRequestException('Nhập số ghế hoặc ghế đầu/giữa/cuối (ít nhất 1).');
    }

    const next = {
      customerName:
        dto.customerName !== undefined
          ? titleCaseName(dto.customerName) || null
          : order.customerName,
      phone: dto.phone ?? order.phone,
      routeId: dto.routeId ?? order.routeId,
      departureTime: dto.departureTime ?? order.departureTime,
      departureDate: dto.departureDate ?? order.departureDate,
      vehicleType:
        dto.vehicleType !== undefined
          ? dto.vehicleType || null
          : order.vehicleType,
      ...nextSeats,
      costPrice: dto.costPrice ?? order.costPrice,
      sellPrice: dto.sellPrice ?? order.sellPrice,
      deposit: dto.deposit ?? order.deposit,
      collectOnDelivery: dto.collectOnDelivery ?? order.collectOnDelivery,
      partner: nextPartner,
      pickupPoint:
        dto.pickupPoint !== undefined
          ? dto.pickupPoint || null
          : order.pickupPoint,
      dropoffPoint:
        dto.dropoffPoint !== undefined
          ? dto.dropoffPoint || null
          : order.dropoffPoint,
      note: dto.note !== undefined ? dto.note || null : order.note,
    };

    const nextCommission = dto.commission ?? order.commission;
    await this.orderRepository.update(order.id, {
      ...next,
      commission: nextCommission,
    });

    // Ghi lịch sử: chỉ những trường thật sự đổi
    const newRoute =
      next.routeId !== order.routeId
        ? await this.routeRepository.findOne({ where: { id: next.routeId } })
        : null;
    const before: Record<string, string | number | null> = {
      ...seatsOf(order),
      customerName: order.customerName,
      phone: order.phone,
      routeName: order.route?.name ?? null,
      departureTime: order.departureTime,
      departureDate: order.departureDate,
      partner: order.partner,
      vehicleType: order.vehicleType,
      seatCount: order.seatCount,
      pickupPoint: order.pickupPoint,
      dropoffPoint: order.dropoffPoint,
      sellPrice: order.sellPrice,
      costPrice: order.costPrice,
      deposit: order.deposit,
      collectOnDelivery: order.collectOnDelivery,
      commission: order.commission,
      note: order.note,
    };
    const after: Record<string, string | number | null> = {
      ...before,
      ...next,
      commission: nextCommission,
      routeName: newRoute ? newRoute.name : before.routeName,
    };

    const changes: OrderChange[] = [];
    for (const { key, label } of TRACKED_FIELDS) {
      const from = before[key] ?? null;
      const to = after[key] ?? null;
      if ((from ?? '') !== (to ?? '')) changes.push({ field: key, label, from, to });
    }
    if (changes.length > 0) {
      await this.record(order.id, 'UPDATE', actor, { changes });
    }
    this.clearReportsAndFilterCache();
    return this.queryService.findOne(order.id, actor);
  }

  /** Hủy vé (khách không đặt nữa): giữ lại đơn nhưng không tính vào doanh thu */
  async cancel(id: number, actor: JwtPayload, reason?: string) {
    const order = await this.queryService.findEntity(id, actor);
    if (order.cancelledAt) {
      throw new BadRequestException('Vé này đã được hủy trước đó.');
    }
    const why = reason?.trim() || null;
    await this.orderRepository.update(order.id, { cancelledAt: new Date(), cancelReason: why });
    await this.record(order.id, 'CANCEL', actor, {
      summary: why ? `Hủy vé: ${why}`.slice(0, 250) : 'Hủy vé (khách không đặt nữa)',
    });
    this.clearReportsAndFilterCache();
    return this.queryService.findOne(order.id, actor);
  }

  async remove(id: number, actor: JwtPayload) {
    const order = await this.queryService.findEntity(id, actor);
    await this.orderRepository.delete(order.id);
    await this.historyRepository.delete({ orderId: order.id });
    this.clearReportsAndFilterCache();
  }

  /** Ghi một dòng lịch sử; lỗi ghi lịch sử không được làm hỏng thao tác chính */
  async record(
    orderId: number,
    action: OrderHistoryAction,
    actor: JwtPayload,
    detail: { summary?: string; changes?: OrderChange[] } = {},
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
          changes: detail.changes ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(`Không ghi được lịch sử đơn #${orderId}: ${(err as Error).message}`);
    }
  }
}
