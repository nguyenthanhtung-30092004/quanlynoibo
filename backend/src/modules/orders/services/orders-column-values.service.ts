import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { UserRole } from '../../users/entities/user.entity.js';
import type { ColumnValuesKey, OrderFilterDto } from '../dto/query-orders.dto.js';
import { escapeLike, seatColumnExpr } from '../mappers/order.mapper.js';
import { OrdersQueryService } from './orders-query.service.js';

@Injectable()
export class OrdersColumnValuesService {
  constructor(private readonly queryService: OrdersQueryService) {}

  private readonly columnValuesCache = new Map<
    string,
    { data: Array<{ value: string; label: string; count: number }>; expiresAt: number }
  >();
  private readonly COLUMN_VALUES_TTL_MS = 15_000;

  clearCache(): void {
    this.columnValuesCache.clear();
  }

  /**
   * Lấy danh sách giá trị kèm số lượng đơn cho bộ lọc cột kiểu Excel.
   * Dùng cùng buildListQuery với các điều kiện của các cột khác để phản ánh tập dữ liệu hiện hành.
   */
  async columnValues(
    column: ColumnValuesKey,
    q: string | undefined,
    filter: OrderFilterDto,
    actor: JwtPayload,
  ): Promise<Array<{ value: string; label: string; count: number }>> {
    const cacheKey = `${column}:${q || ''}:${actor.role}:${actor.role === UserRole.ADMIN ? 'all' : actor.sub}:${JSON.stringify(filter)}`;
    const now = Date.now();
    const cached = this.columnValuesCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const data = await this.computeColumnValues(column, q, filter, actor);
    this.columnValuesCache.set(cacheKey, { data, expiresAt: now + this.COLUMN_VALUES_TTL_MS });
    return data;
  }

  private async computeColumnValues(
    column: ColumnValuesKey,
    q: string | undefined,
    filter: OrderFilterDto,
    actor: JwtPayload,
  ): Promise<Array<{ value: string; label: string; count: number }>> {
    // buildListQuery tôn trọng quyền: nhân viên chỉ thấy vé của mình trừ khi có tìm kiếm tổng
    const qb = this.queryService.buildListQuery(filter, actor);

    // Không lấy các bản ghi đã hủy nếu activeOnly đang bật (đã có trong buildListQuery)
    const keyword = q?.trim() ? q.trim().toLowerCase() : undefined;

    switch (column) {
      case 'customer': {
        // customerName có thể null hoặc rỗng -> Khách lẻ
        qb.select(
          `COALESCE(NULLIF(TRIM(order.customerName), ''), 'Khách lẻ')`,
          'val',
        )
          .addSelect('COUNT(*)', 'cnt')
          .groupBy(`COALESCE(NULLIF(TRIM(order.customerName), ''), 'Khách lẻ')`);

        if (keyword) {
          qb.andWhere(
            `LOWER(COALESCE(NULLIF(TRIM(order.customerName), ''), 'Khách lẻ')) LIKE :valQ`,
            { valQ: `%${escapeLike(keyword)}%` },
          );
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('val', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => ({
          value: r.val,
          label: r.val,
          count: Number(r.cnt),
        }));
      }

      case 'phone': {
        qb.select('order.phone', 'val')
          .addSelect('COUNT(*)', 'cnt')
          .andWhere("order.phone IS NOT NULL AND order.phone != ''")
          .groupBy('order.phone');

        if (keyword) {
          qb.andWhere('order.phone LIKE :valQ', {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('val', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => ({
          value: r.val,
          label: r.val,
          count: Number(r.cnt),
        }));
      }

      case 'staff': {
        qb.select('staff.id', 'valId')
          .addSelect('staff.fullName', 'valLabel')
          .addSelect('COUNT(*)', 'cnt')
          .groupBy('staff.id')
          .addGroupBy('staff.fullName');

        if (keyword) {
          qb.andWhere('LOWER(staff.fullName) LIKE :valQ', {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('valLabel', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ valId: number; valLabel: string; cnt: string }>();
        return rows.map((r) => ({
          value: String(r.valId),
          label: r.valLabel || 'NV',
          count: Number(r.cnt),
        }));
      }

      case 'route': {
        qb.select('route.id', 'valId')
          .addSelect('route.name', 'valLabel')
          .addSelect('COUNT(*)', 'cnt')
          .groupBy('route.id')
          .addGroupBy('route.name');

        if (keyword) {
          qb.andWhere('LOWER(route.name) LIKE :valQ', {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('valLabel', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ valId: number; valLabel: string; cnt: string }>();
        return rows.map((r) => ({
          value: String(r.valId),
          label: r.valLabel || 'Tuyến',
          count: Number(r.cnt),
        }));
      }

      case 'partner': {
        qb.select(`COALESCE(NULLIF(TRIM(order.partner), ''), 'XVIP')`, 'val')
          .addSelect('COUNT(*)', 'cnt')
          .groupBy(`COALESCE(NULLIF(TRIM(order.partner), ''), 'XVIP')`);

        if (keyword) {
          qb.andWhere(
            `LOWER(COALESCE(NULLIF(TRIM(order.partner), ''), 'XVIP')) LIKE :valQ`,
            { valQ: `%${escapeLike(keyword)}%` },
          );
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('val', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => ({
          value: r.val,
          label: r.val,
          count: Number(r.cnt),
        }));
      }

      case 'departureTime': {
        qb.select('order.departureTime', 'val')
          .addSelect('COUNT(*)', 'cnt')
          .andWhere("order.departureTime IS NOT NULL AND order.departureTime != ''")
          .groupBy('order.departureTime');

        if (keyword) {
          qb.andWhere('order.departureTime LIKE :valQ', {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('val', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => ({
          value: r.val,
          label: r.val,
          count: Number(r.cnt),
        }));
      }

      case 'deposit':
      case 'sellPrice':
      case 'commission': {
        const colField = `order.${column}`;
        qb.select(colField, 'val')
          .addSelect('COUNT(*)', 'cnt')
          .groupBy(colField);

        if (keyword) {
          qb.andWhere(`CAST(${colField} AS text) LIKE :valQ`, {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy(colField, 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: number | string; cnt: string }>();
        return rows.map((r) => {
          const num = Number(r.val);
          return {
            value: String(num),
            label: `${num.toLocaleString('vi-VN')}đ`,
            count: Number(r.cnt),
          };
        });
      }

      case 'message': {
        qb.select(
          `CASE
            WHEN order.smsSent = true AND order.messageChannel = 'ZALO' THEN 'zalo'
            WHEN order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL) THEN 'sms'
            ELSE 'unsent'
          END`,
          'val',
        )
          .addSelect('COUNT(*)', 'cnt')
          .groupBy(
            `CASE
              WHEN order.smsSent = true AND order.messageChannel = 'ZALO' THEN 'zalo'
              WHEN order.smsSent = true AND (order.messageChannel = 'SMS' OR order.messageChannel IS NULL) THEN 'sms'
              ELSE 'unsent'
            END`,
          );

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        const counts: Record<string, number> = { sms: 0, zalo: 0, unsent: 0 };
        for (const r of rows) {
          if (r.val && r.val in counts) {
            counts[r.val] = Number(r.cnt);
          }
        }

        const items = [
          { value: 'sms', label: 'Đã gửi SMS', count: counts.sms },
          { value: 'zalo', label: 'Đã gửi Zalo', count: counts.zalo },
          { value: 'unsent', label: 'Chưa gửi', count: counts.unsent },
        ];

        if (keyword) {
          return items.filter(
            (item) =>
              item.label.toLowerCase().includes(keyword) ||
              item.value.toLowerCase().includes(keyword),
          );
        }
        return items;
      }

      case 'entryDate':
      case 'departureDate': {
        const colField = `order.${column}`;
        qb.select(`TO_CHAR(${colField}, 'YYYY-MM-DD')`, 'val')
          .addSelect('COUNT(*)', 'cnt')
          .groupBy(colField);

        if (keyword) {
          qb.andWhere(`TO_CHAR(${colField}, 'DD/MM/YYYY') LIKE :valQ`, {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy(colField, 'DESC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => {
          const [y, m, d] = r.val.split('-');
          return { value: r.val, label: `${d}/${m}/${y}`, count: Number(r.cnt) };
        });
      }

      case 'seatFront':
      case 'seatMiddle':
      case 'seatBack':
      case 'seatCount':
      case 'costPrice':
      case 'collectOnDelivery': {
        // Ghế đầu/giữa/cuối lọc theo số hiển thị (đơn cũ chưa tách thì suy từ vùng ghế)
        const colField = seatColumnExpr(column) ?? `order.${column}`;
        const isMoney = column === 'costPrice' || column === 'collectOnDelivery';
        qb.select(colField, 'val').addSelect('COUNT(*)', 'cnt').groupBy(colField);

        if (keyword) {
          qb.andWhere(`CAST(${colField} AS text) LIKE :valQ`, {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy(colField, 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: number | string; cnt: string }>();
        return rows.map((r) => {
          const num = Number(r.val);
          return {
            value: String(num),
            label: isMoney ? `${num.toLocaleString('vi-VN')}đ` : String(num),
            count: Number(r.cnt),
          };
        });
      }

      case 'vehicleType':
      case 'note':
      case 'pickupPoint':
      case 'dropoffPoint':
      case 'cancelReason': {
        // Giá trị trống gom thành một lựa chọn "—"
        const colField = `order.${column}`;
        const expr = `COALESCE(NULLIF(TRIM(${colField}), ''), '—')`;
        qb.select(expr, 'val').addSelect('COUNT(*)', 'cnt').groupBy(expr);

        if (keyword) {
          qb.andWhere(`LOWER(${expr}) LIKE :valQ`, {
            valQ: `%${escapeLike(keyword)}%`,
          });
        }
        qb.orderBy('cnt', 'DESC').addOrderBy('val', 'ASC').limit(100);

        const rows = await qb.getRawMany<{ val: string; cnt: string }>();
        return rows.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) }));
      }

      default:
        return [];
    }
  }
}
