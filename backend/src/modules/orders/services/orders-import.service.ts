import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Partner } from '../../partners/entities/partner.entity.js';
import { Route } from '../../routes/entities/route.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import { OrderHistory } from '../entities/order-history.entity.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import {
  ImportRow,
  normalizeKey,
  parseOrderWorkbook,
} from '../order-import.parser.js';
import { matchCanonicalPartner } from '../order-partner.util.js';
import { resolveSeats, titleCaseName } from '../mappers/order.mapper.js';
import { getBusinessDate } from '../order-time-lock.js';

export interface ImportResult {
  total: number;
  created: number;
  /** Mã các đơn vừa tạo, dùng để hoàn tác lần nhập này */
  createdIds: number[];
  duplicates: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

interface ValidatedRow {
  rowNumber: number;
  entryDate?: string;
  cancelled?: boolean;
  dto: CreateOrderDto;
  canonicalPartner: string | null;
}

const BATCH_SIZE = 250;
const IMPORT_HISTORY_SUMMARY = 'Tạo đơn từ file Excel';

@Injectable()
export class OrdersImportService {
  private readonly logger = new Logger(OrdersImportService.name);

  constructor(
    private readonly dataSource: DataSource,
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
  ) {}

  /**
   * Nhập đơn từ file Excel (chỉ Admin).
   * Kiểm tra hợp lệ cả file trước, kiểm tra trùng lặp theo lô, rồi chèn theo chunk trong 1 transaction.
   */
  async importExcel(
    buffer: Buffer,
    actor: JwtPayload,
    onSuccessCallback?: () => void,
  ): Promise<ImportResult> {
    let rows: ImportRow[];
    try {
      rows = await parseOrderWorkbook(buffer);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'File không hợp lệ.');
    }

    const [routes, users, partners] = await Promise.all([
      this.routeRepository.find({ where: { isActive: true } }),
      this.userRepository.find({ where: { isActive: true } }),
      this.partnerRepository.find(),
    ]);

    const routeByName = new Map(routes.map((r) => [normalizeKey(r.name), r.id]));
    const userByName = new Map<string, number>();
    for (const u of users) {
      userByName.set(normalizeKey(u.username), u.id);
      userByName.set(normalizeKey(u.fullName), u.id);
    }

    const result: ImportResult = {
      total: rows.length,
      created: 0,
      createdIds: [],
      duplicates: 0,
      failed: 0,
      errors: [],
    };

    const fail = (rowNumber: number, message: string) => {
      result.failed++;
      if (result.errors.length < 200) result.errors.push({ row: rowNumber, message });
    };

    const validRows: ValidatedRow[] = [];

    // Bước 1: Validate toàn bộ các dòng
    for (const row of rows) {
      const problems = [...row.errors];
      const routeId = routeByName.get(normalizeKey(row.routeName));
      if (row.routeName && !routeId) problems.push(`không có tuyến "${row.routeName}"`);

      let canonicalPartner: string | null = null;
      if (row.partner && row.partner.trim()) {
        // Đối tác chưa có trong danh sách vẫn nhập theo đúng tên trong file (không tạo đối tác mới)
        canonicalPartner = matchCanonicalPartner(row.partner, partners) ?? row.partner.trim();
      }

      const dto = plainToInstance(CreateOrderDto, {
        customerName: row.customerName,
        phone: row.phone,
        routeId,
        departureTime: row.departureTime,
        departureDate: row.departureDate,
        vehicleType: row.vehicleType,
        seatFront: row.seatFront,
        seatMiddle: row.seatMiddle,
        seatBack: row.seatBack,
        seatCount: row.seatCount,
        costPrice: row.costPrice,
        sellPrice: row.sellPrice,
        deposit: row.deposit,
        collectOnDelivery: row.collectOnDelivery,
        commission: row.commission,
        partner: canonicalPartner,
        pickupPoint: row.pickupPoint,
        dropoffPoint: row.dropoffPoint,
        note: row.note,
        staffId: (row.staffName && userByName.get(normalizeKey(row.staffName))) || actor.sub,
      });

      if (problems.length === 0) {
        const violations = await validate(dto);
        for (const v of violations) problems.push(...Object.values(v.constraints ?? {}));
      }

      if (problems.length > 0) {
        fail(row.rowNumber, problems.join('; '));
        continue;
      }

      validRows.push({
        rowNumber: row.rowNumber,
        entryDate: row.entryDate,
        cancelled: row.cancelled,
        dto,
        canonicalPartner,
      });
    }

    if (validRows.length === 0) {
      return result;
    }

    // Bước 2: Kiểm tra trùng lặp theo lô
    const phones = [...new Set(validRows.map((r) => r.dto.phone).filter(Boolean))];
    const existingOrders = await this.orderRepository.find({
      where: { phone: In(phones) },
      select: {
        id: true,
        phone: true,
        routeId: true,
        departureDate: true,
        departureTime: true,
        seatCount: true,
        seatFront: true,
        seatMiddle: true,
        seatBack: true,
        sellPrice: true,
      },
    });

    const existingSet = new Set<string>();
    for (const o of existingOrders) {
      const key = `${o.phone}|${o.routeId}|${o.departureDate}|${o.departureTime}|${o.seatCount}|${o.seatFront}|${o.seatMiddle}|${o.seatBack}|${o.sellPrice}`;
      existingSet.add(key);
    }

    const rowsToInsert: ValidatedRow[] = [];
    for (const r of validRows) {
      const dto = r.dto;
      const key = `${dto.phone}|${dto.routeId}|${dto.departureDate}|${dto.departureTime}|${dto.seatCount ?? 1}|${dto.seatFront ?? 0}|${dto.seatMiddle ?? 0}|${dto.seatBack ?? 0}|${dto.sellPrice ?? 0}`;
      if (existingSet.has(key)) {
        result.duplicates++;
      } else {
        existingSet.add(key); // Tránh trùng ngay trong cùng file
        rowsToInsert.push(r);
      }
    }

    if (rowsToInsert.length === 0) {
      return result;
    }

    // Bước 3: Bulk insert theo chunk trong Transaction
    const actorUser = await this.userRepository.findOne({
      where: { id: actor.sub },
      select: { id: true, fullName: true },
    });
    const actorName = actorUser?.fullName ?? actor.username ?? '';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
        const orderEntities = chunk.map((item) => {
          const dto = item.dto;
          const costPrice = dto.costPrice ?? 0;
          const sellPrice = dto.sellPrice ?? 0;

          return queryRunner.manager.create(Order, {
            entryDate: item.entryDate ?? getBusinessDate(),
            createdById: dto.staffId ?? actor.sub,
            customerName: titleCaseName(dto.customerName) || null,
            phone: dto.phone,
            routeId: dto.routeId,
            departureTime: dto.departureTime,
            departureDate: dto.departureDate,
            vehicleType: dto.vehicleType || null,
            seatZone: null,
            ...resolveSeats(dto),
            costPrice,
            sellPrice,
            deposit: dto.deposit ?? 0,
            collectOnDelivery: dto.collectOnDelivery ?? 0,
            commission: dto.commission ?? 0,
            partner: item.canonicalPartner,
            pickupPoint: dto.pickupPoint || null,
            dropoffPoint: dto.dropoffPoint || null,
            note: dto.note || null,
            cancelledAt: item.cancelled ? new Date() : null,
            cancelReason: item.cancelled ? 'Hủy từ file Excel' : null,
          });
        });

        const savedOrders = await queryRunner.manager.save(Order, orderEntities);
        result.created += savedOrders.length;
        result.createdIds.push(...savedOrders.map((o) => o.id));

        // Lưu lịch sử theo lô
        const histories = savedOrders.map((o) =>
          queryRunner.manager.create(OrderHistory, {
            orderId: o.id,
            action: 'CREATE',
            actorId: actor.sub,
            actorName,
            summary: IMPORT_HISTORY_SUMMARY,
            changes: null,
          }),
        );
        await queryRunner.manager.save(OrderHistory, histories);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Lỗi khi insert bulk import: ${(err as Error).message}`);
      throw new BadRequestException('Không thể lưu các đơn hàng từ file Excel.');
    } finally {
      await queryRunner.release();
    }

    if (onSuccessCallback) {
      onSuccessCallback();
    }

    return result;
  }

  /**
   * Hoàn tác một lần nhập Excel (chỉ Admin): xóa các đơn vừa nhập để nhập lại.
   * Chỉ xóa đơn do chính người này nhập và chưa bị đụng tới (lịch sử chỉ có đúng một dòng
   * "Tạo đơn từ file Excel"); đơn đã sửa, hủy hoặc gửi tin nhắn được giữ nguyên và đếm vào `skipped`.
   */
  async rollbackImport(
    ids: number[],
    actor: JwtPayload,
    onSuccessCallback?: () => void,
  ): Promise<{ deleted: number; skipped: number }> {
    const uniqueIds = [...new Set(ids)];
    let deleted = 0;

    await this.dataSource.transaction(async (manager) => {
      const histories = await manager.find(OrderHistory, { where: { orderId: In(uniqueIds) } });
      const byOrder = new Map<number, OrderHistory[]>();
      for (const h of histories) {
        const list = byOrder.get(h.orderId) ?? [];
        list.push(h);
        byOrder.set(h.orderId, list);
      }

      const removable = uniqueIds.filter((id) => {
        const list = byOrder.get(id) ?? [];
        return (
          list.length === 1 &&
          list[0].action === 'CREATE' &&
          list[0].summary === IMPORT_HISTORY_SUMMARY &&
          list[0].actorId === actor.sub
        );
      });
      if (removable.length === 0) return;

      const res = await manager.delete(Order, { id: In(removable) });
      deleted = res.affected ?? 0;
      await manager.delete(OrderHistory, { orderId: In(removable) });
    });

    if (deleted > 0) onSuccessCallback?.();
    return { deleted, skipped: uniqueIds.length - deleted };
  }
}
