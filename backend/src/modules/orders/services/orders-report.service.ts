import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Partner } from '../../partners/entities/partner.entity.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import type { KpiQueryDto } from '../dto/query-orders.dto.js';
import { getBusinessDate } from '../order-time-lock.js';
import { matchCanonicalPartner } from '../order-partner.util.js';
import { neutralizeFormula, ticketsOf } from '../mappers/order.mapper.js';

@Injectable()
export class OrdersReportService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  private cachedPartners: { data: Partner[]; expiresAt: number } | null = null;
  private readonly MASTER_DATA_TTL_MS = 30_000;

  private readonly kpiCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly kpiInflight = new Map<string, Promise<any>>();
  private readonly KPI_CACHE_TTL_MS = 3_000;

  private readonly kpiFilterOptionsCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly KPI_FILTER_OPTIONS_TTL_MS = 15_000;

  clearCache(): void {
    this.kpiCache.clear();
    this.kpiFilterOptionsCache.clear();
  }

  private async getCachedPartners(): Promise<Partner[]> {
    const now = Date.now();
    if (this.cachedPartners && this.cachedPartners.expiresAt > now) {
      return this.cachedPartners.data;
    }
    const data = await this.partnerRepository.find({ select: { id: true, name: true } });
    this.cachedPartners = { data, expiresAt: now + this.MASTER_DATA_TTL_MS };
    return data;
  }

  /** Đơn còn hiệu lực khớp bộ lọc KPI (ngày vào sổ / ngày khởi hành, nhân viên, tuyến, đối tác) */
  async kpiOrders(query: KpiQueryDto, actor: JwtPayload, allStaff = false) {
    const date = query.date ?? getBusinessDate();
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.createdBy', 'staff')
      .addSelect(['staff.id', 'staff.fullName']);
    const byDeparture = !!(query.departureFrom || query.departureTo);
    const byEntryRange = !!(query.dateFrom || query.dateTo);
    if (byDeparture || byEntryRange) {
      // Lọc theo ngày khởi hành và/hoặc ngày vào sổ (một ngày hoặc một khoảng)
      if (query.departureFrom) {
        qb.andWhere('order.departureDate >= :depFrom', { depFrom: query.departureFrom });
      }
      if (query.departureTo) {
        qb.andWhere('order.departureDate <= :depTo', { depTo: query.departureTo });
      }
      if (query.dateFrom) {
        qb.andWhere('order.entryDate >= :from', { from: query.dateFrom });
      }
      if (query.dateTo) {
        qb.andWhere('order.entryDate <= :to', { to: query.dateTo });
      }
    } else {
      qb.andWhere('order.entryDate = :date', { date });
    }
    if (actor.role === UserRole.ADMIN) {
      if (query.staffId !== undefined) {
        qb.andWhere('order.createdById = :staffId', { staffId: query.staffId });
      }
      if (query.staffIds?.length) {
        qb.andWhere('order.createdById IN (:...staffIds)', { staffIds: query.staffIds });
      }
    }
    if (query.routeId !== undefined) {
      qb.andWhere('order.routeId = :routeId', { routeId: query.routeId });
    }
    if (query.routeIds?.length) {
      qb.andWhere('order.routeId IN (:...routeIds)', { routeIds: query.routeIds });
    }
    if (query.partner?.trim()) {
      qb.andWhere('order.partnerKey = :partner', { partner: query.partner.trim().toLowerCase() });
    }
    if (query.partners?.length) {
      qb.andWhere('order.partnerKey IN (:...partners)', {
        partners: query.partners.map((p) => p.trim().toLowerCase()),
      });
    }
    if (actor.role !== UserRole.ADMIN && !allStaff) {
      qb.andWhere('order.createdById = :uid', { uid: actor.sub });
    }
    // Vé đã hủy không tính vào doanh thu
    qb.andWhere('order.cancelledAt IS NULL');
    qb.select([
      'order.id',
      'order.createdById',
      'order.routeId',
      'order.partner',
      'order.seatCount',
      'order.seatFront',
      'order.seatMiddle',
      'order.seatBack',
      'order.seatZone',
      'order.sellPrice',
      'order.costPrice',
      'order.deposit',
      'order.collectOnDelivery',
      'order.commission',
      'order.smsSent',
    ]);
    const orders = await qb.getMany();
    return { date, orders };
  }

  /** KPI theo ngày vào sổ (mặc định) hoặc theo ngày khởi hành. Có single-flight và cache ngắn (3s) */
  async kpi(query: KpiQueryDto, actor: JwtPayload) {
    const cacheKey = `${actor.role}:${actor.role === UserRole.ADMIN ? 'all' : actor.sub}:${JSON.stringify(query)}`;
    const now = Date.now();
    const cached = this.kpiCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const inflight = this.kpiInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }
    const promise = this.computeKpi(query, actor)
      .then((data) => {
        this.kpiCache.set(cacheKey, { data, expiresAt: Date.now() + this.KPI_CACHE_TTL_MS });
        return data;
      })
      .finally(() => {
        this.kpiInflight.delete(cacheKey);
      });
    this.kpiInflight.set(cacheKey, promise);
    return promise;
  }

  private async computeKpi(query: KpiQueryDto, actor: JwtPayload) {
    const isAdmin = actor.role === UserRole.ADMIN;
    // Nhân viên cũng cần bảng vinh danh toàn hệ thống nên lấy đơn của mọi người rồi tách phần của mình
    const { date, orders: scoped } = await this.kpiOrders(query, actor, !isAdmin);
    const orders = isAdmin ? scoped : scoped.filter((o) => o.createdById === actor.sub);

    const sum = (list: Order[], pick: (o: Order) => number) =>
      list.reduce((total, o) => total + pick(o), 0);
    const summarize = (list: Order[]) => ({
      total: list.length,
      seats: sum(list, (o) => ticketsOf(o)),
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
        leaderboard?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
        ranking?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
        byStaff?: Array<
          ReturnType<typeof summarize> & { staffId: number; fullName: string }
        >;
        byRoute: Array<{ routeId: number; total: number; seats: number; revenue?: number }>;
        byPartner?: Array<{ partner: string; total: number; seats: number; commission: number }>;
      } = { date, ...summarize(orders), byRoute: [] };

    // Số đơn, số vé (ghế) và hoa hồng theo đối tác (chỉ Admin vì có hoa hồng), nhiều hoa hồng nhất trước
    if (isAdmin) {
      const partnerGroups = new Map<string, { partner: string; total: number; seats: number; commission: number }>();
      for (const o of orders) {
        const name = o.partner?.trim() || 'XVIP';
        const key = name.toLowerCase();
        const row = partnerGroups.get(key) ?? { partner: name, total: 0, seats: 0, commission: 0 };
        row.total += 1;
        row.seats += ticketsOf(o);
        row.commission += o.commission;
        partnerGroups.set(key, row);
      }
      result.byPartner = [...partnerGroups.values()].sort(
        (a, b) => b.commission - a.commission || b.total - a.total,
      );
    }

    // Số đơn, số vé (ghế) và doanh thu theo tuyến (trên toàn bộ vé trong khoảng lọc, không phụ thuộc phân trang danh sách)
    const routeMap = new Map<number, { total: number; seats: number; revenue: number }>();
    for (const o of orders) {
      const cur = routeMap.get(o.routeId) ?? { total: 0, seats: 0, revenue: 0 };
      cur.total += 1;
      cur.seats += ticketsOf(o);
      cur.revenue += o.sellPrice || 0;
      routeMap.set(o.routeId, cur);
    }
    result.byRoute = [...routeMap.entries()]
      .map(([routeId, stat]) => ({
        routeId,
        total: stat.total,
        seats: stat.seats,
        ...(isAdmin ? { revenue: stat.revenue } : {}),
      }))
      .sort((a, b) => b.total - a.total);

    // Nhân viên không được biết doanh thu / giá nhập: không trả về từ server
    if (actor.role !== UserRole.ADMIN) {
      delete result.revenue;
      delete result.cost;
    }

    // Vinh danh toàn hệ thống: chỉ số đơn / vé, không lộ doanh thu hay hoa hồng của người khác
    const ranking = new Map<number, Order[]>();
    for (const o of scoped) {
      ranking.set(o.createdById, [...(ranking.get(o.createdById) ?? []), o]);
    }
    // Xếp hạng đầy đủ mọi nhân viên (chỉ số đơn / vé) để nhân viên biết vị trí của mình
    result.ranking = [...ranking.entries()]
      .map(([staffId, list]) => ({
        staffId,
        fullName: list[0].createdBy?.fullName ?? '',
        total: list.length,
        seats: sum(list, (o) => ticketsOf(o)),
      }))
      .sort((a, b) => b.seats - a.seats || b.total - a.total);
    result.leaderboard = result.ranking.slice(0, 3);

    if (isAdmin) {
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

  /**
   * Nhân viên, tuyến và đối tác có đơn trong khoảng ngày đang lọc, để các ô lọc chỉ gợi ý mục có dữ liệu.
   * Danh sách nhân viên chỉ phụ thuộc khoảng ngày; tuyến và đối tác thu hẹp thêm theo nhân viên đang chọn.
   */
  async kpiFilterOptions(query: KpiQueryDto, actor: JwtPayload) {
    const cacheKey = `${actor.role}:${actor.role === UserRole.ADMIN ? 'all' : actor.sub}:${JSON.stringify(query)}`;
    const now = Date.now();
    const cached = this.kpiFilterOptionsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    const data = await this.computeKpiFilterOptions(query, actor);
    this.kpiFilterOptionsCache.set(cacheKey, { data, expiresAt: now + this.KPI_FILTER_OPTIONS_TTL_MS });
    return data;
  }

  private async computeKpiFilterOptions(query: KpiQueryDto, actor: JwtPayload) {
    const { orders } = await this.kpiOrders(
      {
        ...query,
        staffId: undefined,
        routeId: undefined,
        routeIds: undefined,
        partner: undefined,
        partners: undefined,
      },
      actor,
    );
    const ofStaff =
      actor.role === UserRole.ADMIN && query.staffId !== undefined
        ? orders.filter((o) => o.createdById === query.staffId)
        : orders;
    return {
      staffIds: [...new Set(orders.map((o) => o.createdById))],
      routeIds: [...new Set(ofStaff.map((o) => o.routeId))],
      partners: [...new Set(ofStaff.map((o) => o.partner?.trim()).filter((p): p is string => !!p))],
    };
  }

  /** Công nợ theo đối tác trong khoảng lọc: số đơn, vé, thu hộ, hoa hồng giữ, giá nhập phải trả. Vé hủy không tính */
  async debts(query: KpiQueryDto, actor: JwtPayload) {
    const { orders } = await this.kpiOrders(query, actor);
    const partners = await this.getCachedPartners();
    const groups = new Map<
      string,
      { partner: string; orders: number; tickets: number; revenue: number; commission: number; cost: number }
    >();
    let excludedOrders = 0;
    const excludedPartnersMap = new Map<string, string>();

    for (const o of orders) {
      const canonical = matchCanonicalPartner(o.partner, partners);
      if (canonical === null) {
        // Đơn không có đối tác (rỗng) -> không thuộc công nợ đối tác nào, không tính vào excluded
        continue;
      }
      if (canonical === undefined) {
        // Đối tác lạ (ngoài danh sách) -> loại khỏi công nợ, ghi nhận vào excluded
        excludedOrders += 1;
        const raw = o.partner?.trim();
        if (raw && !excludedPartnersMap.has(raw.toLowerCase())) {
          excludedPartnersMap.set(raw.toLowerCase(), raw);
        }
        continue;
      }
      const key = canonical.toLowerCase();
      const g = groups.get(key) ?? { partner: canonical, orders: 0, tickets: 0, revenue: 0, commission: 0, cost: 0 };
      g.orders += 1;
      g.tickets += ticketsOf(o);
      g.revenue += o.sellPrice;
      g.commission += o.commission;
      // Giá nhập chưa nhập thì lấy giá bán trừ hoa hồng
      g.cost += o.costPrice || o.sellPrice - o.commission || 0;
      groups.set(key, g);
    }
    return {
      items: [...groups.values()].sort((a, b) => b.cost - a.cost),
      excluded: {
        orders: excludedOrders,
        partners: [...excludedPartnersMap.values()],
      },
    };
  }

  /** Xuất bảng công nợ đối tác (đúng bộ lọc) ra Excel */
  async exportDebts(query: KpiQueryDto, actor: JwtPayload) {
    const { items, excluded } = await this.debts(query, actor);
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Công nợ đối tác', {
      views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
    });
    const cols = [
      { header: 'STT', width: 8, align: 'center' as const },
      { header: 'ĐỐI TÁC', width: 30, align: 'left' as const },
      { header: 'SỐ ĐƠN', width: 12, align: 'center' as const, fmt: '#,##0' },
      { header: 'SỐ VÉ', width: 12, align: 'center' as const, fmt: '#,##0' },
      { header: 'TỔNG THU HỘ', width: 18, align: 'right' as const, fmt: '#,##0' },
      { header: 'HOA HỒNG GIỮ', width: 18, align: 'right' as const, fmt: '#,##0' },
      { header: 'PHẢI TRẢ NHÀ XE', width: 20, align: 'right' as const, fmt: '#,##0' },
    ];
    cols.forEach((c, i) => {
      sheet.getColumn(i + 1).width = c.width;
    });
    sheet.mergeCells(1, 1, 1, cols.length);
    const title = sheet.getCell(1, 1);
    title.value = 'CÔNG NỢ ĐỐI TÁC';
    title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2A5C' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells(2, 1, 2, cols.length);
    const range = (from?: string, to?: string) => (from || to ? `${from ?? '…'} → ${to ?? '…'}` : null);
    const scope =
      range(query.departureFrom, query.departureTo)?.replace(/^/, 'Ngày khởi hành: ') ??
      range(query.dateFrom, query.dateTo)?.replace(/^/, 'Ngày tạo vé: ') ??
      `Ngày tạo vé: ${query.date ?? getBusinessDate()}`;
    sheet.getCell(2, 1).value = `${scope}${query.partner ? `  •  Đối tác: ${query.partner}` : ''}  •  Không tính vé đã hủy`;
    sheet.getCell(2, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 22;

    const head = sheet.getRow(3);
    cols.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    head.height = 28;

    const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } } as const;
    items.forEach((r, idx) => {
      const row = sheet.getRow(4 + idx);
      const values = [idx + 1, neutralizeFormula(r.partner), r.orders, r.tickets, r.revenue, r.commission, r.cost];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        if (cols[i].fmt) cell.numFmt = cols[i].fmt;
        cell.alignment = { horizontal: cols[i].align, vertical: 'middle' };
        cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      });
    });

    const totalRow = sheet.getRow(4 + items.length);
    const sumBy = (pick: (r: (typeof items)[number]) => number) => items.reduce((t, r) => t + pick(r), 0);
    const totals = [null, 'TỔNG', sumBy((r) => r.orders), sumBy((r) => r.tickets), sumBy((r) => r.revenue), sumBy((r) => r.commission), sumBy((r) => r.cost)];
    totals.forEach((v, i) => {
      const cell = totalRow.getCell(i + 1);
      cell.value = v;
      if (cols[i].fmt) cell.numFmt = cols[i].fmt;
      cell.font = { bold: true, color: { argb: 'FF0F2A5C' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9A8' } };
      cell.alignment = { horizontal: cols[i].align, vertical: 'middle' };
    });

    if (excluded.orders > 0) {
      const noteRowIdx = 5 + items.length;
      sheet.mergeCells(noteRowIdx, 1, noteRowIdx, cols.length);
      const noteCell = sheet.getCell(noteRowIdx, 1);
      const namesStr = excluded.partners.length > 0 ? ` (tên ${excluded.partners.join(', ')})` : '';
      noteCell.value = `Có ${excluded.orders} đơn thuộc đối tác không có trong danh sách${namesStr} nên không được tính.`;
      noteCell.font = { italic: true, color: { argb: 'FFB91C1C' } };
      noteCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sheet.getRow(noteRowIdx).height = 22;
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
