import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import ExcelJS from 'exceljs';
import { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Route } from '../routes/entities/route.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import {
  KpiQueryDto,
  OrderFilterDto,
  QueryOrdersDto,
} from './dto/query-orders.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { Order, SeatZone } from './entities/order.entity.js';
import {
  getBusinessDate,
  isOrderCreationLocked,
} from './order-time-lock.js';
import { MessageChannel } from './messaging/message.types.js';
import { MessagingService } from './messaging/messaging.service.js';
import { buildBookingSms } from './sms/sms-template.js';

const EXPORT_LIMIT = 5000;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Tạo đơn. Nhân viên chỉ tạo được từ 04h30 đến 22h30 (giờ VN), Admin không bị khóa.
   * Ngày vào sổ và nhân viên được điền tự động.
   */
  async create(dto: CreateOrderDto, actor: JwtPayload) {
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

    const costPrice = dto.costPrice ?? 0;
    const sellPrice = dto.sellPrice ?? 0;

    const saved = await this.orderRepository.save(
      this.orderRepository.create({
        entryDate: getBusinessDate(),
        createdById: ownerId,
        customerName: dto.customerName || null,
        phone: dto.phone,
        routeId: dto.routeId,
        departureTime: dto.departureTime,
        departureDate: dto.departureDate,
        vehicleType: dto.vehicleType || null,
        seatZone: null,
        ...this.resolveSeats(dto),
        costPrice,
        sellPrice,
        deposit: dto.deposit ?? 0,
        collectOnDelivery: dto.collectOnDelivery ?? 0,
        commission: dto.commission ?? 0,
        partner: dto.partner || null,
        pickupPoint: dto.pickupPoint || null,
        dropoffPoint: dto.dropoffPoint || null,
        note: dto.note || null,
      }),
    );
    return this.findOne(saved.id, actor);
  }

  async findAll(query: QueryOrdersDto, actor: JwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Các join đều là nhiều-một nên dùng offset/limit (không bị TypeORM chèn thêm
    // truy vấn DISTINCT id như skip/take), đếm tổng chạy song song với lấy trang
    const [items, total] = await Promise.all([
      this.buildListQuery(query, actor)
        .orderBy('order.createdAt', 'DESC')
        .addOrderBy('order.id', 'DESC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getMany(),
      this.buildListQuery(query, actor).getCount(),
    ]);

    return { items: items.map((o) => this.toView(o)), total, page, limit };
  }

  async findOne(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    return this.toView(order);
  }

  async update(id: number, dto: UpdateOrderDto, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    if (order.cancelledAt) {
      throw new BadRequestException('Vé đã hủy, không thể sửa.');
    }

    if (dto.routeId !== undefined && dto.routeId !== order.routeId) {
      await this.assertRouteUsable(dto.routeId);
    }

    const next = {
      customerName:
        dto.customerName !== undefined
          ? dto.customerName || null
          : order.customerName,
      phone: dto.phone ?? order.phone,
      routeId: dto.routeId ?? order.routeId,
      departureTime: dto.departureTime ?? order.departureTime,
      departureDate: dto.departureDate ?? order.departureDate,
      vehicleType:
        dto.vehicleType !== undefined
          ? dto.vehicleType || null
          : order.vehicleType,
      ...this.resolveSeats(dto, order),
      costPrice: dto.costPrice ?? order.costPrice,
      sellPrice: dto.sellPrice ?? order.sellPrice,
      deposit: dto.deposit ?? order.deposit,
      collectOnDelivery: dto.collectOnDelivery ?? order.collectOnDelivery,
      partner: dto.partner !== undefined ? dto.partner || null : order.partner,
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

    await this.orderRepository.update(order.id, {
      ...next,
      commission: dto.commission ?? order.commission,
    });
    return this.findOne(order.id, actor);
  }

  /** Hủy vé (khách không đặt nữa): giữ lại đơn nhưng không tính vào doanh thu */
  async cancel(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    if (order.cancelledAt) {
      throw new BadRequestException('Vé này đã được hủy trước đó.');
    }
    await this.orderRepository.update(order.id, { cancelledAt: new Date() });
    return this.findOne(order.id, actor);
  }

  async remove(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    await this.orderRepository.delete(order.id);
  }

  /**
   * Gửi tin nhắn 1 chạm cho khách theo mẫu của đơn, qua kênh được chọn
   * (SMS hoặc Zalo). Chế độ chạy thử (dryRun) thì không gửi và không đánh dấu đã gửi.
   */
  async sendMessage(id: number, channel: MessageChannel, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    const [year, month, day] = order.departureDate.split('-');

    const { dryRun, referentId } = await this.messaging.send(channel, {
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
      },
    });

    if (!dryRun) {
      await this.orderRepository.update(order.id, {
        smsSent: true,
        smsSentAt: new Date(),
        messageChannel: channel,
        messageRefId: referentId ?? null,
        messageStatus: null,
      });
    }
    return { order: await this.findOne(order.id, actor), dryRun };
  }

  /** Tra trạng thái tin đã gửi (VMG) và lưu lại */
  async messageStatus(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
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

  /** KPI theo ngày vào sổ (mặc định) hoặc theo ngày khởi hành. Admin thấy thêm bảng theo từng nhân viên */
  async kpi(query: KpiQueryDto, actor: JwtPayload) {
    const date = query.date ?? getBusinessDate();
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.createdBy', 'staff')
      .addSelect(['staff.id', 'staff.fullName']);
    if (query.departureFrom || query.departureTo) {
      // Lọc theo ngày khởi hành (một ngày hoặc một khoảng)
      if (query.departureFrom) {
        qb.andWhere('order.departureDate >= :depFrom', { depFrom: query.departureFrom });
      }
      if (query.departureTo) {
        qb.andWhere('order.departureDate <= :depTo', { depTo: query.departureTo });
      }
    } else {
      qb.andWhere('order.entryDate = :date', { date });
    }
    if (actor.role !== UserRole.ADMIN) {
      qb.andWhere('order.createdById = :uid', { uid: actor.sub });
    }
    // Vé đã hủy không tính vào doanh thu
    qb.andWhere('order.cancelledAt IS NULL');
    const orders = await qb.getMany();

    const sum = (list: Order[], pick: (o: Order) => number) =>
      list.reduce((total, o) => total + pick(o), 0);
    const summarize = (list: Order[]) => ({
      total: list.length,
      seats: sum(list, (o) => o.seatCount),
      smsSent: list.filter((o) => o.smsSent).length,
      revenue: sum(list, (o) => o.sellPrice),
      cost: sum(list, (o) => o.costPrice),
      deposit: sum(list, (o) => o.deposit),
      collectOnDelivery: sum(list, (o) => o.collectOnDelivery),
      commission: sum(list, (o) => o.commission),
    });

    const result: ReturnType<typeof summarize> & {
      date: string;
      byStaff?: Array<
        ReturnType<typeof summarize> & { staffId: number; fullName: string }
      >;
    } = { date, ...summarize(orders) };

    if (actor.role === UserRole.ADMIN) {
      const groups = new Map<number, Order[]>();
      for (const o of orders) {
        groups.set(o.createdById, [...(groups.get(o.createdById) ?? []), o]);
      }
      result.byStaff = [...groups.entries()]
        .map(([staffId, list]) => ({
          staffId,
          fullName: list[0].createdBy?.fullName ?? '',
          ...summarize(list),
        }))
        .sort((a, b) => b.total - a.total);
    }
    return result;
  }

  /** Xuất danh sách (đã lọc) ra file Excel, cột theo sổ "Nhật ký" */
  async exportExcel(filter: OrderFilterDto, actor: JwtPayload) {
    const orders = await this.buildListQuery(filter, actor)
      .orderBy('order.createdAt', 'DESC')
      .take(EXPORT_LIMIT)
      .getMany();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Nhật ký');
    sheet.columns = [
      { header: 'NGÀY VÀO SỔ', key: 'entryDate', width: 14 },
      { header: 'NV', key: 'staff', width: 22 },
      { header: 'TÊN KHÁCH', key: 'customerName', width: 24 },
      { header: 'SỐ ĐIỆN THOẠI', key: 'phone', width: 15 },
      { header: 'TUYẾN ĐI', key: 'route', width: 30 },
      { header: 'GIỜ ĐI', key: 'departureTime', width: 9 },
      { header: 'NGÀY KHỞI HÀNH', key: 'departureDate', width: 15 },
      { header: 'LOẠI HÌNH', key: 'vehicleType', width: 22 },
      { header: 'ĐẦU', key: 'front', width: 7 },
      { header: 'GIỮA', key: 'middle', width: 7 },
      { header: 'CUỐI', key: 'back', width: 7 },
      { header: 'SỐ GHẾ', key: 'seatCount', width: 9 },
      { header: 'GIÁ NHẬP', key: 'costPrice', width: 13 },
      { header: 'GIÁ BÁN', key: 'sellPrice', width: 13 },
      { header: 'ĐÃ CỌC', key: 'deposit', width: 13 },
      { header: 'NHỜ THU', key: 'collectOnDelivery', width: 13 },
      { header: 'HOA HỒNG', key: 'commission', width: 13 },
      { header: 'ĐỐI TÁC', key: 'partner', width: 26 },
      { header: 'ĐIỂM ĐÓN', key: 'pickupPoint', width: 30 },
      { header: 'ĐIỂM TRẢ', key: 'dropoffPoint', width: 30 },
      { header: 'GHI CHÚ', key: 'note', width: 36 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const key of [
      'costPrice',
      'sellPrice',
      'deposit',
      'collectOnDelivery',
      'commission',
    ]) {
      sheet.getColumn(key).numFmt = '#,##0';
    }
    // Ngày hiển thị dạng ngày/tháng/năm (ô vẫn là ngày thật nên lọc và sắp xếp được)
    for (const key of ['entryDate', 'departureDate']) {
      const col = sheet.getColumn(key);
      col.numFmt = 'dd/mm/yyyy';
      col.alignment = { horizontal: 'left' };
    }

    for (const o of orders) {
      sheet.addRow({
        entryDate: this.toExcelDate(o.entryDate),
        staff: o.createdBy?.fullName ?? '',
        customerName: this.neutralizeFormula(o.customerName ?? ''),
        phone: o.phone,
        route: this.neutralizeFormula(o.route?.name ?? ''),
        departureTime: o.departureTime,
        departureDate: this.toExcelDate(o.departureDate),
        vehicleType: this.neutralizeFormula(o.vehicleType ?? ''),
        front: this.seatsOf(o).seatFront || '',
        middle: this.seatsOf(o).seatMiddle || '',
        back: this.seatsOf(o).seatBack || '',
        seatCount: o.seatCount,
        costPrice: o.costPrice,
        sellPrice: o.sellPrice,
        deposit: o.deposit,
        collectOnDelivery: o.collectOnDelivery,
        commission: o.commission,
        partner: this.neutralizeFormula(o.partner ?? ''),
        pickupPoint: this.neutralizeFormula(o.pickupPoint ?? ''),
        dropoffPoint: this.neutralizeFormula(o.dropoffPoint ?? ''),
        note: this.neutralizeFormula(o.note ?? ''),
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ---------------------------------------------------------------- helpers

  private async assertRouteUsable(routeId: number) {
    const route = await this.routeRepository.findOne({
      where: { id: routeId },
    });
    if (!route || !route.isActive) {
      throw new BadRequestException(
        'Tuyến đi không tồn tại hoặc đã ngừng hoạt động.',
      );
    }
  }

  /** Staff chỉ truy cập được đơn của chính mình (trả 404 để không lộ sự tồn tại) */
  private async findEntity(id: number, actor: JwtPayload): Promise<Order> {
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
      (actor.role !== UserRole.ADMIN && order.createdById !== actor.sub)
    ) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${id}".`);
    }
    return order;
  }

  private buildListQuery(
    filter: OrderFilterDto,
    actor: JwtPayload,
  ): SelectQueryBuilder<Order> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.createdBy', 'staff')
      .addSelect(['staff.id', 'staff.fullName'])
      .leftJoin('order.route', 'route')
      .addSelect(['route.id', 'route.name']);

    if (actor.role === UserRole.ADMIN) {
      if (filter.staffId !== undefined) {
        qb.andWhere('order.createdById = :staffId', { staffId: filter.staffId });
      }
    } else {
      // Quyền truy cập do server quyết định, bỏ qua staffId client gửi lên
      qb.andWhere('order.createdById = :uid', { uid: actor.sub });
    }

    if (filter.routeId !== undefined) {
      qb.andWhere('order.routeId = :routeId', { routeId: filter.routeId });
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
    if (filter.search?.trim()) {
      qb.andWhere(
        `(order.customerName ILIKE :q OR order.phone ILIKE :q OR route.name ILIKE :q OR order.vehicleType ILIKE :q OR order.partner ILIKE :q OR order.pickupPoint ILIKE :q OR order.dropoffPoint ILIKE :q OR order.note ILIKE :q)`,
        { q: `%${this.escapeLike(filter.search.trim())}%` },
      );
    }
    return qb;
  }

  private toView(order: Order) {
    return {
      id: order.id,
      entryDate: order.entryDate,
      staff: order.createdBy
        ? { id: order.createdBy.id, fullName: order.createdBy.fullName }
        : { id: order.createdById, fullName: '' },
      customerName: order.customerName,
      phone: order.phone,
      route: order.route
        ? { id: order.route.id, name: order.route.name }
        : { id: order.routeId, name: '' },
      departureTime: order.departureTime,
      departureDate: order.departureDate,
      vehicleType: order.vehicleType,
      seatZone: order.seatZone,
      ...this.seatsOf(order),
      seatCount: order.seatCount,
      costPrice: order.costPrice,
      sellPrice: order.sellPrice,
      deposit: order.deposit,
      collectOnDelivery: order.collectOnDelivery,
      commission: order.commission,
      partner: order.partner,
      pickupPoint: order.pickupPoint,
      dropoffPoint: order.dropoffPoint,
      note: order.note,
      smsSent: order.smsSent,
      smsSentAt: order.smsSentAt,
      messageChannel: order.messageChannel,
      smsContent: buildBookingSms({
        route: order.route?.name ?? '',
        departureTime: order.departureTime,
        departureDate: order.departureDate,
      }),
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Tách ghế đầu/giữa/cuối. Đơn cũ chưa tách (cả ba bằng 0) thì quy toàn bộ số ghế
   * về vị trí đã chọn trước đây để hiển thị không bị mất.
   */
  private seatsOf(order: Order) {
    const { seatFront, seatMiddle, seatBack, seatCount, seatZone } = order;
    if (seatFront + seatMiddle + seatBack > 0) {
      return { seatFront, seatMiddle, seatBack };
    }
    return {
      seatFront: seatZone === SeatZone.FRONT ? seatCount : 0,
      seatMiddle: seatZone === SeatZone.MIDDLE ? seatCount : 0,
      seatBack: seatZone === SeatZone.BACK ? seatCount : 0,
    };
  }

  /** Tổng ghế luôn bằng đầu + giữa + cuối nếu client gửi phần tách */
  private resolveSeats(
    dto: { seatFront?: number; seatMiddle?: number; seatBack?: number; seatCount?: number },
    current?: Order,
  ) {
    const split =
      dto.seatFront !== undefined || dto.seatMiddle !== undefined || dto.seatBack !== undefined;
    if (!split) {
      if (current) {
        return { seatFront: current.seatFront, seatMiddle: current.seatMiddle, seatBack: current.seatBack, seatCount: dto.seatCount ?? current.seatCount };
      }
      return { seatFront: 0, seatMiddle: 0, seatBack: 0, seatCount: dto.seatCount ?? 1 };
    }
    const base = current ? this.seatsOf(current) : { seatFront: 0, seatMiddle: 0, seatBack: 0 };
    const seatFront = dto.seatFront ?? base.seatFront;
    const seatMiddle = dto.seatMiddle ?? base.seatMiddle;
    const seatBack = dto.seatBack ?? base.seatBack;
    const seatCount = seatFront + seatMiddle + seatBack;
    if (seatCount < 1) {
      throw new BadRequestException('Đơn phải có ít nhất 1 ghế (đầu, giữa hoặc cuối).');
    }
    if (seatCount > 60) {
      throw new BadRequestException('Tổng số ghế quá lớn.');
    }
    return { seatFront, seatMiddle, seatBack, seatCount };
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (c) => `\\${c}`);
  }

  /** 'YYYY-MM-DD' -> ô ngày của Excel (nửa đêm UTC để không bị lệch ngày theo múi giờ) */
  private toExcelDate(ymd: string): Date | string {
    const [y, m, d] = ymd.split('-').map(Number);
    return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : ymd;
  }

  /** Chặn công thức Excel (CSV/formula injection) trong ô do người dùng nhập */
  private neutralizeFormula(value: string): string {
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }
}
