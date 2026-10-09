import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
  OrderChange,
  OrderHistory,
  OrderHistoryAction,
} from './entities/order-history.entity.js';
import {
  getBusinessDate,
  isOrderCreationLocked,
} from './order-time-lock.js';
import { MessageChannel } from './messaging/message.types.js';
import { MessagingService } from './messaging/messaging.service.js';
import { buildBookingSms } from './sms/sms-template.js';

const EXPORT_LIMIT = 5000;

/** Các trường được so sánh để ghi lịch sử khi sửa đơn */
const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'customerName', label: 'Tên khách' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'routeName', label: 'Tuyến đường' },
  { key: 'departureTime', label: 'Giờ đi' },
  { key: 'departureDate', label: 'Ngày đi' },
  { key: 'partner', label: 'Đối tác' },
  { key: 'vehicleType', label: 'Loại hình' },
  { key: 'seatCount', label: 'Số ghế' },
  { key: 'seatFront', label: 'Ghế đầu' },
  { key: 'seatMiddle', label: 'Ghế giữa' },
  { key: 'seatBack', label: 'Ghế cuối' },
  { key: 'pickupPoint', label: 'Điểm đón' },
  { key: 'dropoffPoint', label: 'Điểm trả' },
  { key: 'sellPrice', label: 'Giá bán' },
  { key: 'costPrice', label: 'Giá nhập' },
  { key: 'deposit', label: 'Đã cọc' },
  { key: 'collectOnDelivery', label: 'Nhờ thu' },
  { key: 'commission', label: 'Hoa hồng' },
  { key: 'note', label: 'Ghi chú' },
];

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly historyRepository: Repository<OrderHistory>,
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
    await this.record(saved.id, 'CREATE', actor, { summary: 'Tạo đơn' });
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
      ...this.seatsOf(order),
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
    return this.findOne(order.id, actor);
  }

  /** Hủy vé (khách không đặt nữa): giữ lại đơn nhưng không tính vào doanh thu */
  async cancel(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    if (order.cancelledAt) {
      throw new BadRequestException('Vé này đã được hủy trước đó.');
    }
    await this.orderRepository.update(order.id, { cancelledAt: new Date() });
    await this.record(order.id, 'CANCEL', actor, { summary: 'Hủy vé (khách không đặt nữa)' });
    return this.findOne(order.id, actor);
  }

  async remove(id: number, actor: JwtPayload) {
    const order = await this.findEntity(id, actor);
    await this.orderRepository.delete(order.id);
    await this.historyRepository.delete({ orderId: order.id });
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
    await this.record(order.id, 'SEND_MESSAGE', actor, {
      summary: `Gửi ${channel === MessageChannel.ZALO ? 'Zalo' : 'SMS'} cho khách${dryRun ? ' (chạy thử, chưa gửi thật)' : ''}`,
    });
    return { order: await this.findOne(order.id, actor), dryRun };
  }

  /** Lịch sử thao tác của một đơn (mới nhất trước); nhân viên chỉ xem được đơn của mình */
  async history(id: number, actor: JwtPayload) {
    await this.findEntity(id, actor);
    return this.historyRepository.find({
      where: { orderId: id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  /** Ghi một dòng lịch sử; lỗi ghi lịch sử không được làm hỏng thao tác chính */
  private async record(
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
      seats: sum(list, (o) => this.ticketsOf(o)),
      smsSent: list.filter((o) => o.smsSent).length,
      revenue: sum(list, (o) => o.sellPrice),
      cost: sum(list, (o) => o.costPrice),
      deposit: sum(list, (o) => o.deposit),
      collectOnDelivery: sum(list, (o) => o.collectOnDelivery),
      commission: sum(list, (o) => o.commission),
    });

    const result: Partial<ReturnType<typeof summarize>> &
      Pick<ReturnType<typeof summarize>, 'total' | 'seats' | 'smsSent'> & {
        date: string;
        byStaff?: Array<
          ReturnType<typeof summarize> & { staffId: number; fullName: string }
        >;
      } = { date, ...summarize(orders) };

    // Nhân viên không được biết doanh thu / giá nhập: không trả về từ server
    // (ẩn ở giao diện thôi chưa đủ vì gọi thẳng URL vẫn thấy)
    if (actor.role !== UserRole.ADMIN) {
      delete result.revenue;
      delete result.cost;
    }

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

    const exporter = await this.userRepository.findOne({
      where: { id: actor.sub },
      select: { id: true, fullName: true },
    });
    const isCancelled = (o: Order) => !!o.cancelledAt;
    const activeCount = orders.filter((o) => !isCancelled(o)).length;
    const cancelledCount = orders.length - activeCount;

    // ---- bảng màu
    const NAVY = 'FF0F2A5C';
    const BLUE = 'FF2563EB';
    const BAND = 'FFF1F5FF';
    const LINE = 'FFCBD5E1';
    const RED_BG = 'FFFDE2E2';
    const RED = 'FFB91C1C';
    const GOLD = 'FFFFE9A8';
    const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const thin = { style: 'thin', color: { argb: LINE } } as const;
    // Kẻ đủ bốn phía (ngang và dọc) cho tiêu đề và các dòng vé; từ dòng vé cuối trở xuống không kẻ viền
    const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
    const headerLine = { style: 'thin', color: { argb: 'FF93B4F5' } } as const;
    const GREEN = 'FF16A34A';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = exporter?.fullName ?? 'Hệ thống';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Nhật ký vé', {
      properties: { tabColor: { argb: BLUE } },
      views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });

    type Col = {
      header: string;
      width: number;
      align?: 'left' | 'center' | 'right';
      fmt?: string;
      sum?: boolean;
      value: (o: Order, index: number) => ExcelJS.CellValue;
    };
    const seats = (o: Order) => this.seatsOf(o);
    const COLS: Col[] = [
      { header: 'STT', width: 8, align: 'center', value: (_o, i) => i + 1 },
      { header: 'TRẠNG THÁI', width: 16, align: 'center', value: (o) => (isCancelled(o) ? 'ĐÃ HỦY' : 'Hợp lệ') },
      { header: 'NGÀY VÀO SỔ', width: 16, align: 'center', fmt: 'dd/mm/yyyy', value: (o) => this.toExcelDate(o.entryDate) },
      { header: 'NV', width: 20, value: (o) => o.createdBy?.fullName ?? '' },
      { header: 'TÊN KHÁCH', width: 24, value: (o) => this.neutralizeFormula(o.customerName ?? '') },
      { header: 'SỐ ĐIỆN THOẠI', width: 18, align: 'center', value: (o) => o.phone },
      { header: 'TUYẾN ĐI', width: 30, value: (o) => this.neutralizeFormula(o.route?.name ?? '') },
      { header: 'GIỜ ĐI', width: 11, align: 'center', value: (o) => o.departureTime },
      { header: 'NGÀY KHỞI HÀNH', width: 18, align: 'center', fmt: 'dd/mm/yyyy', value: (o) => this.toExcelDate(o.departureDate) },
      { header: 'LOẠI HÌNH', width: 22, value: (o) => this.neutralizeFormula(o.vehicleType ?? '') },
      { header: 'ĐẦU', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatFront || '' },
      { header: 'GIỮA', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatMiddle || '' },
      { header: 'CUỐI', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatBack || '' },
      { header: 'SỐ GHẾ', width: 11, align: 'center', sum: true, value: (o) => this.ticketsOf(o) },
      { header: 'GIÁ NHẬP', width: 16, align: 'right', fmt: '#,##0', sum: true, value: (o) => o.costPrice },
      { header: 'GIÁ BÁN', width: 16, align: 'right', fmt: '#,##0', sum: true, value: (o) => o.sellPrice },
      { header: 'ĐÃ CỌC', width: 16, align: 'right', fmt: '#,##0', sum: true, value: (o) => o.deposit },
      { header: 'NHỜ THU', width: 16, align: 'right', fmt: '#,##0', sum: true, value: (o) => o.collectOnDelivery },
      { header: 'HOA HỒNG', width: 16, align: 'right', fmt: '#,##0', sum: true, value: (o) => o.commission },
      { header: 'ĐỐI TÁC', width: 24, value: (o) => this.neutralizeFormula(o.partner ?? '') },
      { header: 'ĐIỂM ĐÓN', width: 28, value: (o) => this.neutralizeFormula(o.pickupPoint ?? '') },
      { header: 'ĐIỂM TRẢ', width: 28, value: (o) => this.neutralizeFormula(o.dropoffPoint ?? '') },
      { header: 'GHI CHÚ', width: 34, value: (o) => this.neutralizeFormula(o.note ?? '') },
    ];
    const N = COLS.length;
    COLS.forEach((c, i) => {
      sheet.getColumn(i + 1).width = c.width;
    });
    // ---- tiêu đề + dòng thông tin
    sheet.mergeCells(1, 1, 1, N);
    const title = sheet.getCell(1, 1);
    title.value = 'NHẬT KÝ VÉ XE';
    title.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = solid(NAVY);
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 38;

    sheet.mergeCells(2, 1, 2, N);
    const stamp = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hourCycle: 'h23',
    }).format(new Date());
    const info = sheet.getCell(2, 1);
    info.value =
      `Xuất lúc ${stamp}  •  Người xuất: ${exporter?.fullName ?? actor.username}  •  ` +
      `Tổng ${orders.length} đơn: ${activeCount} hợp lệ, ${cancelledCount} đã hủy` +
      (cancelledCount > 0 ? '  (vé đã hủy tô đỏ, gạch ngang và không tính vào dòng TỔNG)' : '');
    info.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E3A8A' } };
    info.fill = solid('FFE0EAFF');
    info.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 22;
    sheet.getRow(3).height = 6;

    // ---- hàng tiêu đề cột
    const HEADER_ROW = 4;
    const headerRow = sheet.getRow(HEADER_ROW);
    headerRow.height = 36;
    COLS.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = solid(BLUE);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: headerLine, left: headerLine, right: headerLine, bottom: { style: 'medium', color: { argb: NAVY } } };
    });

    // ---- dữ liệu
    orders.forEach((o, idx) => {
      const row = sheet.getRow(HEADER_ROW + 1 + idx);
      row.height = 21;
      const cancelled = isCancelled(o);
      COLS.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = c.value(o, idx);
        if (c.fmt) cell.numFmt = c.fmt;
        cell.border = box;
        cell.alignment = { horizontal: c.align ?? 'left', vertical: 'middle' };
        if (cancelled) {
          cell.fill = solid(RED_BG);
          cell.font = { color: { argb: 'FF7F1D1D' }, strike: i > 1 };
        } else if (idx % 2 === 1) {
          cell.fill = solid(BAND);
        }
      });
      // Ô trạng thái nổi bật
      const status = row.getCell(2);
      status.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      status.fill = solid(cancelled ? RED : GREEN);
    });

    // ---- dòng tổng (chỉ tính vé hợp lệ)
    const first = HEADER_ROW + 1;
    const last = HEADER_ROW + orders.length;
    const totalRow = sheet.getRow(last + 1);
    totalRow.height = 26;
    sheet.mergeCells(last + 1, 1, last + 1, 4);
    const label = totalRow.getCell(1);
    label.value = `TỔNG (${activeCount} đơn hợp lệ, không tính vé đã hủy)`;
    label.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    COLS.forEach((c, i) => {
      const cell = totalRow.getCell(i + 1);
      cell.fill = solid(GOLD);
      cell.font = { bold: true, size: 12, color: { argb: NAVY } };
      if (c.sum && orders.length > 0) {
        const colLetter = sheet.getColumn(i + 1).letter;
        const result = orders
          .filter((o) => !isCancelled(o))
          .reduce((acc, o) => {
            const v = c.value(o, 0);
            return acc + (typeof v === 'number' ? v : 0);
          }, 0);
        cell.value = {
          formula: `SUMIF($B$${first}:$B$${last},"Hợp lệ",${colLetter}${first}:${colLetter}${last})`,
          result,
        };
        cell.numFmt = c.fmt ?? '#,##0';
        cell.alignment = { horizontal: c.align ?? 'right', vertical: 'middle' };
      }
    });

    if (orders.length > 0) {
      sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: last, column: N } };
    }
    sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;

    // ---- khối tổng kết bên dưới bảng
    const colIndex = (header: string) => COLS.findIndex((c) => c.header === header) + 1;
    const totalCell = (header: string) => `${sheet.getColumn(colIndex(header)).letter}${last + 1}`;
    const sumOf = (pick: (o: Order) => number) =>
      orders.filter((o) => !isCancelled(o)).reduce((acc, o) => acc + pick(o), 0);
    const hasRows = orders.length > 0;
    const statusRange = `$B$${first}:$B$${last}`;
    const panel: Array<{ label: string; value: ExcelJS.CellValue; fmt?: string; color?: string }> = [
      { label: 'Tổng số đơn', value: hasRows ? { formula: `COUNTA(${statusRange})`, result: orders.length } : 0 },
      { label: 'Đơn hợp lệ', value: hasRows ? { formula: `COUNTIF(${statusRange},"Hợp lệ")`, result: activeCount } : 0, color: GREEN },
      { label: 'Đơn đã hủy', value: hasRows ? { formula: `COUNTIF(${statusRange},"ĐÃ HỦY")`, result: cancelledCount } : 0, color: RED },
      { label: 'Tổng vé (số ghế, vé hợp lệ)', value: hasRows ? { formula: totalCell('SỐ GHẾ'), result: sumOf((o) => this.ticketsOf(o)) } : 0 },
      { label: 'Tổng giá bán (vé hợp lệ)', value: hasRows ? { formula: totalCell('GIÁ BÁN'), result: sumOf((o) => o.sellPrice) } : 0, fmt: '#,##0" đ"' },
      { label: 'Tổng hoa hồng (vé hợp lệ)', value: hasRows ? { formula: totalCell('HOA HỒNG'), result: sumOf((o) => o.commission) } : 0, fmt: '#,##0" đ"' },
    ];
    const panelTop = last + 3;
    sheet.mergeCells(panelTop, 1, panelTop, 6);
    const panelTitle = sheet.getCell(panelTop, 1);
    panelTitle.value = 'TỔNG KẾT';
    panelTitle.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    panelTitle.fill = solid(NAVY);
    panelTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(panelTop).height = 26;
    for (let c = 1; c <= 6; c++) {
      sheet.getCell(panelTop, c).border = { top: headerLine, left: headerLine, right: headerLine, bottom: { style: 'medium', color: { argb: NAVY } } };
    }
    panel.forEach((item, i) => {
      const r = panelTop + 1 + i;
      sheet.mergeCells(r, 1, r, 4);
      sheet.mergeCells(r, 5, r, 6);
      const l = sheet.getCell(r, 1);
      const v = sheet.getCell(r, 5);
      l.value = item.label;
      v.value = item.value;
      if (item.fmt) v.numFmt = item.fmt;
      sheet.getRow(r).height = 24;
      for (const c of [1, 2, 3, 4, 5, 6]) {
        const cell = sheet.getCell(r, c);
        cell.fill = solid(i % 2 === 0 ? 'FFF1F5FF' : 'FFFFFFFF');
        cell.border = box;
      }
      l.font = { size: 11, color: { argb: 'FF334155' } };
      l.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      v.font = { bold: true, size: 13, color: { argb: item.color ?? NAVY } };
      v.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    });

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
      tickets: this.ticketsOf(order),
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

  /**
   * Số ghế và ghế đầu/giữa/cuối là hai cách ghi độc lập: có nhà xe chỉ cần số ghế,
   * có nhà xe chỉ cần đầu/giữa/cuối. Không ràng buộc bằng nhau, chỉ cần có ít nhất một trong hai.
   */
  private resolveSeats(
    dto: { seatFront?: number; seatMiddle?: number; seatBack?: number; seatCount?: number },
    current?: Order,
  ) {
    const base = current ? this.seatsOf(current) : { seatFront: 0, seatMiddle: 0, seatBack: 0 };
    const seatFront = dto.seatFront ?? base.seatFront;
    const seatMiddle = dto.seatMiddle ?? base.seatMiddle;
    const seatBack = dto.seatBack ?? base.seatBack;
    const seatCount = dto.seatCount ?? current?.seatCount ?? 1;
    if (seatCount + seatFront + seatMiddle + seatBack < 1) {
      throw new BadRequestException('Nhập số ghế hoặc ghế đầu/giữa/cuối (ít nhất 1).');
    }
    return { seatFront, seatMiddle, seatBack, seatCount };
  }

  /** Số vé của đơn: ưu tiên số ghế; nhà xe chỉ ghi đầu/giữa/cuối thì lấy tổng ba vị trí */
  private ticketsOf(order: Order): number {
    if (order.seatCount > 0) return order.seatCount;
    const { seatFront, seatMiddle, seatBack } = this.seatsOf(order);
    return seatFront + seatMiddle + seatBack;
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
