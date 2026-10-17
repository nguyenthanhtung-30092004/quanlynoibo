import { SelectQueryBuilder } from 'typeorm';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import type { OrderFilterDto } from '../dto/query-orders.dto.js';
import { escapeLike, seatColumnExpr } from '../mappers/order.mapper.js';

export class OrderFilterBuilder {
  /**
   * Áp dụng toàn bộ điều kiện lọc và phân quyền vào QueryBuilder của Order.
   * Đây là MỘT nơi duy nhất dựng WHERE để dùng thống nhất cho List, ColumnValues, Export, KPI.
   */
  static apply(
    qb: SelectQueryBuilder<Order>,
    filter: OrderFilterDto,
    actor: JwtPayload,
    /** Id các tuyến có tên khớp filter.search (xem OrdersQueryService.findSearchRouteIds) */
    searchRouteIds: number[] = [],
  ): SelectQueryBuilder<Order> {
    if (actor.role === UserRole.ADMIN) {
      if (filter.staffId !== undefined) {
        qb.andWhere('order.createdById = :staffId', { staffId: filter.staffId });
      }
      if (filter.staffIds?.length) {
        qb.andWhere('order.createdById IN (:...staffIds)', { staffIds: filter.staffIds });
      }
    } else if (!filter.search?.trim()) {
      // Quyền truy cập do server quyết định, bỏ qua staffId client gửi lên.
      // Khi tìm kiếm thì nhân viên được xem vé phù hợp của cả nhân viên khác.
      qb.andWhere('order.createdById = :uid', { uid: actor.sub });
    }

    if (filter.activeOnly) {
      qb.andWhere('order.cancelledAt IS NULL');
    }
    if (filter.depositOnly) {
      qb.andWhere('order.deposit > 0');
    }
    if (filter.routeId !== undefined) {
      qb.andWhere('order.routeId = :routeId', { routeId: filter.routeId });
    }
    if (filter.routeIds?.length) {
      qb.andWhere('order.routeId IN (:...routeIds)', { routeIds: filter.routeIds });
    }
    if (filter.dateFrom) {
      qb.andWhere('order.entryDate >= :from', { from: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere('order.entryDate <= :to', { to: filter.dateTo });
    }
    if (filter.departureFrom) {
      qb.andWhere('order.departureDate >= :depFrom', { depFrom: filter.departureFrom });
    }
    if (filter.departureTo) {
      qb.andWhere('order.departureDate <= :depTo', { depTo: filter.departureTo });
    }
    if (filter.partner?.trim()) {
      const p = filter.partner.trim().toLowerCase();
      if (p === 'xvip') {
        qb.andWhere('(order.partner IS NULL OR TRIM(order.partner) = \'\' OR LOWER(order.partner) = \'xvip\')');
      } else {
        qb.andWhere('LOWER(order.partner) = LOWER(:partner)', { partner: filter.partner.trim() });
      }
    }
    if (filter.partners?.length) {
      const lowerPartners = filter.partners.map((p) => p.toLowerCase());
      const hasXvip = lowerPartners.includes('xvip');
      const realPartners = lowerPartners.filter((p) => p !== 'xvip');

      if (hasXvip && realPartners.length > 0) {
        qb.andWhere(
          '(LOWER(order.partner) IN (:...partners) OR order.partner IS NULL OR TRIM(order.partner) = \'\' OR LOWER(order.partner) = \'xvip\')',
          { partners: realPartners },
        );
      } else if (hasXvip) {
        qb.andWhere('(order.partner IS NULL OR TRIM(order.partner) = \'\' OR LOWER(order.partner) = \'xvip\')');
      } else {
        qb.andWhere('LOWER(order.partner) IN (:...partners)', {
          partners: realPartners,
        });
      }
    }

    // Bộ lọc cột Excel
    if (filter.customerNames?.length) {
      const lowerNames = filter.customerNames.map((n) => n.toLowerCase());
      const hasRetail = lowerNames.includes('khách lẻ');
      const realNames = lowerNames.filter((n) => n !== 'khách lẻ');

      if (hasRetail && realNames.length > 0) {
        qb.andWhere(
          '(LOWER(order.customerName) IN (:...realNames) OR order.customerName IS NULL OR order.customerName = \'\')',
          { realNames },
        );
      } else if (hasRetail) {
        qb.andWhere('(order.customerName IS NULL OR order.customerName = \'\')');
      } else {
        qb.andWhere('LOWER(order.customerName) IN (:...customerNames)', {
          customerNames: realNames,
        });
      }
    }

    if (filter.phones?.length) {
      qb.andWhere('order.phone IN (:...phones)', { phones: filter.phones });
    }

    if (filter.departureTimes?.length) {
      qb.andWhere('order.departureTime IN (:...departureTimes)', {
        departureTimes: filter.departureTimes,
      });
    }

    if (filter.smsStatus) {
      if (filter.smsStatus === 'sent') {
        qb.andWhere('order.smsSent = true');
      } else if (filter.smsStatus === 'unsent') {
        qb.andWhere('(order.smsSent = false OR order.smsSent IS NULL)');
      }
    }

    if (filter.messageStates?.length) {
      const conds: string[] = [];
      const uniqueStates = Array.from(new Set(filter.messageStates));
      for (const st of uniqueStates) {
        if (st === 'sms') {
          conds.push(
            "(order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL))",
          );
        } else if (st === 'zalo') {
          conds.push("(order.smsSent = true AND order.messageChannel = 'ZALO')");
        } else if (st === 'unsent') {
          conds.push('(order.smsSent = false OR order.smsSent IS NULL)');
        }
      }
      if (conds.length > 0) {
        qb.andWhere(`(${conds.join(' OR ')})`);
      }
    }

    if (filter.sellPriceMin !== undefined) {
      qb.andWhere('order.sellPrice >= :sellPriceMin', { sellPriceMin: filter.sellPriceMin });
    }
    if (filter.sellPriceMax !== undefined) {
      qb.andWhere('order.sellPrice <= :sellPriceMax', { sellPriceMax: filter.sellPriceMax });
    }

    if (filter.commissionMin !== undefined) {
      qb.andWhere('order.commission >= :commissionMin', { commissionMin: filter.commissionMin });
    }
    if (filter.commissionMax !== undefined) {
      qb.andWhere('order.commission <= :commissionMax', { commissionMax: filter.commissionMax });
    }

    if (filter.deposits?.length) {
      qb.andWhere('order.deposit IN (:...deposits)', { deposits: filter.deposits });
    }

    if (filter.sellPrices?.length) {
      qb.andWhere('order.sellPrice IN (:...sellPrices)', { sellPrices: filter.sellPrices });
    }

    if (filter.commissions?.length) {
      qb.andWhere('order.commission IN (:...commissions)', { commissions: filter.commissions });
    }

    if (filter.entryDates?.length) {
      qb.andWhere('order.entryDate IN (:...entryDates)', { entryDates: filter.entryDates });
    }
    if (filter.departureDates?.length) {
      qb.andWhere('order.departureDate IN (:...departureDates)', {
        departureDates: filter.departureDates,
      });
    }

    const numberLists: Array<[string, number[] | undefined]> = [
      ['seatFront', filter.seatFronts],
      ['seatMiddle', filter.seatMiddles],
      ['seatBack', filter.seatBacks],
      ['seatCount', filter.seatCounts],
      ['costPrice', filter.costPrices],
      ['collectOnDelivery', filter.collectOnDeliveries],
    ];
    for (const [field, values] of numberLists) {
      if (values?.length) {
        qb.andWhere(`${seatColumnExpr(field) ?? `order.${field}`} IN (:...${field}List)`, {
          [`${field}List`]: values,
        });
      }
    }

    // Cột văn bản: "—" khớp giá trị trống
    const textLists: Array<[string, string[] | undefined]> = [
      ['vehicleType', filter.vehicleTypes],
      ['note', filter.notes],
      ['pickupPoint', filter.pickupPoints],
      ['dropoffPoint', filter.dropoffPoints],
      ['cancelReason', filter.cancelReasons],
    ];
    for (const [field, values] of textLists) {
      if (!values?.length) continue;
      const col = `order.${field}`;
      const real = values.filter((v) => v !== '—');
      const conds: string[] = [];
      if (real.length) conds.push(`TRIM(${col}) IN (:...${field}List)`);
      if (real.length !== values.length) conds.push(`(${col} IS NULL OR TRIM(${col}) = '')`);
      qb.andWhere(`(${conds.join(' OR ')})`, { [`${field}List`]: real });
    }

    if (filter.orderCode?.trim()) {
      const code = filter.orderCode.trim();
      const match = /^xv\s*(\d{1,9})$/i.exec(code);
      const orderId = match ? Number(match[1]) : /^\d+$/.test(code) ? Number(code) : null;
      if (orderId !== null) {
        qb.andWhere('order.id = :orderCodeId', { orderCodeId: orderId });
      } else {
        // Gõ mã không đúng dạng số hoặc XV thì không khớp đơn nào
        qb.andWhere('1 = 0');
      }
    }

    if (filter.search?.trim()) {
      const keyword = filter.search.trim();
      const orderCode = /^xv\s*(\d{1,9})$/i.exec(keyword);
      // Mã đơn hiển thị là XV<id> (ví dụ XV116): gõ đúng dạng đó thì tìm thêm theo id.
      // Mỗi nhánh OR phải có index (search_text, partner: GIN trigram; routeId: B-tree), nếu không Postgres
      // quét toàn bảng. Tên tuyến được tìm trước ở bảng tuyến nhỏ (searchRouteIds) rồi truyền vào dạng danh sách
      // số: subquery trong OR bị đoán sai số dòng khớp (~10-50%) nên Postgres đi ngược index ngày quét cả bảng
      // (~700ms trên 340k đơn dù chỉ 4 đơn khớp).
      const conds = ['order.search_text ILIKE :q', 'order.partner ILIKE :q'];
      if (searchRouteIds.length) conds.push('order.routeId IN (:...searchRouteIds)');
      if (orderCode) conds.push('order.id = :orderId');
      qb.andWhere(`(${conds.join(' OR ')})`, {
        q: `%${escapeLike(keyword)}%`,
        ...(searchRouteIds.length ? { searchRouteIds } : {}),
        ...(orderCode ? { orderId: Number(orderCode[1]) } : {}),
      });
    }

    return qb;
  }
}
