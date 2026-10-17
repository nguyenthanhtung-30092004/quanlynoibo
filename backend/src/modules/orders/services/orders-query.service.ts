import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Partner } from '../../partners/entities/partner.entity.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import { OrderHistory } from '../entities/order-history.entity.js';
import type { OrderFilterDto, QueryOrdersDto } from '../dto/query-orders.dto.js';
import { OrderFilterBuilder } from '../filters/order-filter.builder.js';
import { toOrderView } from '../mappers/order.mapper.js';
import { findUnlistedPartners, type UnlistedPartnerSummary } from '../order-partner.util.js';

const ACTIVITY_DAYS = 7;

@Injectable()
export class OrdersQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly historyRepository: Repository<OrderHistory>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  private cachedPartners: { data: Partner[]; expiresAt: number } | null = null;
  private readonly MASTER_DATA_TTL_MS = 30_000;

  async getCachedPartners(): Promise<Partner[]> {
    const now = Date.now();
    if (this.cachedPartners && this.cachedPartners.expiresAt > now) {
      return this.cachedPartners.data;
    }
    const data = await this.partnerRepository.find({ select: { id: true, name: true } });
    this.cachedPartners = { data, expiresAt: now + this.MASTER_DATA_TTL_MS };
    return data;
  }

  buildListQuery(
    filter: OrderFilterDto,
    actor: JwtPayload,
  ): SelectQueryBuilder<Order> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.createdBy', 'staff')
      .addSelect(['staff.id', 'staff.fullName'])
      .leftJoin('order.route', 'route')
      .addSelect(['route.id', 'route.name']);

    return OrderFilterBuilder.apply(qb, filter, actor);
  }

  async findAll(query: QueryOrdersDto, actor: JwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Các join đều là nhiều-một nên dùng offset/limit (không bị TypeORM chèn thêm DISTINCT id như skip/take)
    // Tìm kiếm: xếp theo ngày xe chạy từ gần nhất (mới) đến xa nhất (cũ); xem thường: theo thời điểm tạo đơn
    const searching = !!query.search?.trim();
    const listQb = this.buildListQuery(query, actor);
    if (searching) {
      listQb
        .orderBy('order.departureDate', 'DESC')
        .addOrderBy('order.departureTime', 'DESC')
        .addOrderBy('order.id', 'DESC');
    } else {
      listQb.orderBy('order.createdAt', 'DESC').addOrderBy('order.id', 'DESC');
    }
    const [items, total] = await Promise.all([
      listQb
        .offset((page - 1) * limit)
        .limit(limit)
        .getMany(),
      this.buildListQuery(query, actor).getCount(),
    ]);

    return { items: items.map((o) => toOrderView(o)), total, page, limit };
  }

  async findOne(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor, true);
    return toOrderView(order);
  }

  /**
   * Staff chỉ sửa/hủy được đơn của chính mình (trả 404 để không lộ sự tồn tại);
   * `readOnly` cho phép xem chi tiết đơn của nhân viên khác (kết quả tìm kiếm).
   */
  async findEntity(
    id: number,
    actor: JwtPayload,
    readOnly = false,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { createdBy: true, route: true },
      select: {
        createdBy: { id: true, fullName: true },
        route: { id: true, name: true },
      },
    });
    if (
      !order ||
      (!readOnly && actor.role !== UserRole.ADMIN && order.createdById !== actor.sub)
    ) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${id}".`);
    }
    return order;
  }

  /**
   * Nhân viên không được thấy các lần chỉnh sửa (UPDATE) do Admin thực hiện;
   * vẫn thấy chỉnh sửa của nhân viên khác và mọi thao tác còn lại (tạo, hủy, gửi tin).
   */
  hideAdminEdits(qb: SelectQueryBuilder<OrderHistory>, actor: JwtPayload) {
    if (actor.role === UserRole.ADMIN) return;
    qb.andWhere(
      `NOT (h.action = 'UPDATE' AND h.actorId IN (SELECT adm.id FROM users adm WHERE adm.role = :adminRole))`,
      { adminRole: UserRole.ADMIN },
    );
  }

  /** Lịch sử thao tác của một đơn (mới nhất trước) */
  async history(id: number, actor: JwtPayload) {
    await this.findEntity(id, actor, true);
    const qb = this.historyRepository
      .createQueryBuilder('h')
      .where('h.orderId = :id', { id });
    this.hideAdminEdits(qb, actor);
    return qb.orderBy('h.createdAt', 'DESC').addOrderBy('h.id', 'DESC').getMany();
  }

  /**
   * Hoạt động gần đây trên đơn (cho chuông thông báo): ai tạo / sửa / hủy / gửi tin.
   * Admin thấy tất cả; nhân viên chỉ thấy hoạt động trên đơn của mình.
   */
  async activity(actor: JwtPayload, limit = 30) {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
    const qb = this.historyRepository
      .createQueryBuilder('h')
      .innerJoin(Order, 'o', 'o.id = h.orderId')
      .where('h.createdAt >= :since', { since });
    if (actor.role !== UserRole.ADMIN) {
      qb.andWhere('o.createdById = :uid', { uid: actor.sub });
    }
    this.hideAdminEdits(qb, actor);
    const rows = await qb.orderBy('h.createdAt', 'DESC').addOrderBy('h.id', 'DESC').limit(limit).getMany();
    if (rows.length === 0) return [];

    const orders = await this.orderRepository.find({
      where: { id: In([...new Set(rows.map((r) => r.orderId))]) },
      relations: { route: true },
      select: {
        id: true,
        customerName: true,
        phone: true,
        departureTime: true,
        departureDate: true,
        route: { id: true, name: true },
      },
    });
    const byId = new Map(orders.map((o) => [o.id, o]));
    return rows.map((r) => {
      const o = byId.get(r.orderId);
      return {
        id: r.id,
        orderId: r.orderId,
        action: r.action,
        actorId: r.actorId,
        actorName: r.actorName,
        summary: r.summary,
        createdAt: r.createdAt,
        customerName: o?.customerName ?? null,
        routeName: o?.route?.name ?? null,
        departureTime: o?.departureTime ?? null,
        departureDate: o?.departureDate ?? null,
      };
    });
  }

  /** Danh sách đối tác lạ trên đơn còn hiệu lực không khớp bảng đối tác (chỉ Admin) */
  async unlistedPartners(): Promise<UnlistedPartnerSummary[]> {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.cancelledAt IS NULL')
      .andWhere('order.partner IS NOT NULL')
      .andWhere("TRIM(order.partner) != ''")
      .select(['order.id', 'order.partner'])
      .getMany();

    const partners = await this.getCachedPartners();
    return findUnlistedPartners(orders, partners);
  }
}
