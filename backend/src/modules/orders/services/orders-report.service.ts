import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { Partner } from '../../partners/entities/partner.entity.js';
import { UserRole } from '../../users/entities/user.entity.js';
import { Order } from '../entities/order.entity.js';
import type { KpiQueryDto } from '../dto/query-orders.dto.js';
import { MessageChannel } from '../messaging/message.types.js';
import { getBusinessDate } from '../order-time-lock.js';
import { matchCanonicalPartner } from '../order-partner.util.js';
import { neutralizeFormula } from '../mappers/order.mapper.js';

/** Biểu thức SQL số vé của đơn, khớp `ticketsOf` ở order.mapper (ưu tiên số ghế, không thì tổng đầu/giữa/cuối) */
const TICKETS_SQL = `(CASE
  WHEN order.seatCount > 0 THEN order.seatCount
  WHEN (order.seatFront + order.seatMiddle + order.seatBack) > 0 THEN (order.seatFront + order.seatMiddle + order.seatBack)
  WHEN order.seatZone IS NOT NULL THEN order.seatCount
  ELSE 0 END)`;

/** Một dòng kết quả GROUP BY (nhân viên, tuyến, đối tác); Postgres trả số dạng chuỗi */
interface KpiRow {
  staffId: number | string;
  fullName: string | null;
  routeId: number | string;
  partnerKey: string;
  partnerName: string | null;
  total: string;
  seats: string;
  smsSent: string;
  zaloSent: string;
  revenue: string;
  cost: string;
  deposit: string;
  collectOnDelivery: string;
  commission: string;
}

interface Group {
  staffId: number;
  fullName: string;
  routeId: number;
  partnerKey: string;
  partnerName: string;
  total: number;
  seats: number;
  smsSent: number;
  zaloSent: number;
  revenue: number;
  cost: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
}

const sumOf = (list: Group[], pick: (g: Group) => number) => list.reduce((t, g) => t + pick(g), 0);

function groupByStaff(groups: Group[]): Map<number, Group[]> {
  const map = new Map<number, Group[]>();
  for (const g of groups) {
    const list = map.get(g.staffId);
    if (list) list.push(g);
    else map.set(g.staffId, [g]);
  }
  return map;
}

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

  /**
   * Truy vấn đơn còn hiệu lực khớp bộ lọc KPI (ngày vào sổ / ngày khởi hành, nhân viên, tuyến, đối tác).
   * Chỉ dựng điều kiện lọc: các hàm bên dưới tự gom nhóm bằng GROUP BY ở Postgres, tuyệt đối không
   * tải từng đơn lên Node (lọc cả tháng / cả năm là hàng chục đến hàng trăm nghìn đơn, chặn luồng xử lý
   * làm mọi yêu cầu khác bị đứng).
   */
  private kpiFilteredQuery(query: KpiQueryDto, actor: JwtPayload, allStaff = false) {
    const date = query.date ?? getBusinessDate();
    const qb = this.orderRepository.createQueryBuilder('order');
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
    return { date, qb };
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
    // Nhân viên cũng cần bảng vinh danh toàn hệ thống nên lấy nhóm của mọi người rồi tách phần của mình
    const { date, qb } = this.kpiFilteredQuery(query, actor, !isAdmin);

    // Một truy vấn duy nhất gom theo (nhân viên, tuyến, đối tác): chỉ vài chục dòng dù lọc cả năm
    const partnerExpr = `LOWER(TRIM(COALESCE(order.partner, '')))`;
    const rows = await qb
      .leftJoin('order.createdBy', 'staff')
      .select('order.createdById', 'staffId')
      .addSelect('staff.fullName', 'fullName')
      .addSelect('order.routeId', 'routeId')
      .addSelect(partnerExpr, 'partnerKey')
      .addSelect(`MIN(NULLIF(TRIM(order.partner), ''))`, 'partnerName')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`COALESCE(SUM(${TICKETS_SQL}), 0)`, 'seats')
      .addSelect('COUNT(*) FILTER (WHERE order.smsSent)', 'smsSent')
      .addSelect('COUNT(*) FILTER (WHERE order.smsSent AND order.messageChannel = :zalo)', 'zaloSent')
      .addSelect('COALESCE(SUM(order.sellPrice), 0)', 'revenue')
      .addSelect('COALESCE(SUM(order.costPrice), 0)', 'cost')
      .addSelect('COALESCE(SUM(order.deposit), 0)', 'deposit')
      .addSelect('COALESCE(SUM(order.collectOnDelivery), 0)', 'collectOnDelivery')
      .addSelect('COALESCE(SUM(order.commission), 0)', 'commission')
      .setParameter('zalo', MessageChannel.ZALO)
      .groupBy('order.createdById')
      .addGroupBy('staff.fullName')
      .addGroupBy('order.routeId')
      .addGroupBy(partnerExpr)
      .getRawMany<KpiRow>();

    const groups: Group[] = rows.map((r) => ({
      staffId: Number(r.staffId),
      fullName: r.fullName ?? '',
      routeId: Number(r.routeId),
      partnerKey: r.partnerKey,
      partnerName: r.partnerName ?? 'XVIP',
      total: Number(r.total),
      seats: Number(r.seats),
      smsSent: Number(r.smsSent),
      zaloSent: Number(r.zaloSent),
      revenue: Number(r.revenue),
      cost: Number(r.cost),
      deposit: Number(r.deposit),
      collectOnDelivery: Number(r.collectOnDelivery),
      commission: Number(r.commission),
    }));
    const mine = isAdmin ? groups : groups.filter((g) => g.staffId === actor.sub);

    const summarize = (list: Group[]) => {
      const smsSent = sumOf(list, (g) => g.smsSent);
      const zaloSent = sumOf(list, (g) => g.zaloSent);
      return {
        total: sumOf(list, (g) => g.total),
        seats: sumOf(list, (g) => g.seats),
        smsSent,
        zaloSent,
        // Đơn gửi trước khi có cột kênh (messageChannel null) đều là SMS
        smsOnlySent: smsSent - zaloSent,
        revenue: sumOf(list, (g) => g.revenue),
        cost: sumOf(list, (g) => g.cost),
        deposit: sumOf(list, (g) => g.deposit),
        collectOnDelivery: sumOf(list, (g) => g.collectOnDelivery),
        commission: sumOf(list, (g) => g.commission),
      };
    };

    const result: Partial<ReturnType<typeof summarize>> &
      Pick<ReturnType<typeof summarize>, 'total' | 'seats' | 'smsSent' | 'zaloSent' | 'smsOnlySent'> & {
        date: string;
        leaderboard?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
        ranking?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
        byStaff?: Array<
          ReturnType<typeof summarize> & { staffId: number; fullName: string }
        >;
        byRoute: Array<{ routeId: number; total: number; seats: number; revenue?: number; commission: number }>;
        byPartner?: Array<{ partner: string; total: number; seats: number; commission: number }>;
      } = { date, ...summarize(mine), byRoute: [] };

    // Số đơn, số vé (ghế) và hoa hồng theo đối tác (chỉ Admin vì có hoa hồng), nhiều hoa hồng nhất trước
    if (isAdmin) {
      const partnerGroups = new Map<string, { partner: string; total: number; seats: number; commission: number }>();
      for (const g of mine) {
        const key = g.partnerKey || 'xvip';
        const row = partnerGroups.get(key) ?? { partner: g.partnerName, total: 0, seats: 0, commission: 0 };
        row.total += g.total;
        row.seats += g.seats;
        row.commission += g.commission;
        partnerGroups.set(key, row);
      }
      result.byPartner = [...partnerGroups.values()].sort(
        (a, b) => b.commission - a.commission || b.total - a.total,
      );
    }

    // Số đơn, số vé (ghế) và doanh thu theo tuyến (trên toàn bộ vé trong khoảng lọc, không phụ thuộc phân trang danh sách)
    const routeMap = new Map<number, { total: number; seats: number; revenue: number; commission: number }>();
    for (const g of mine) {
      const cur = routeMap.get(g.routeId) ?? { total: 0, seats: 0, revenue: 0, commission: 0 };
      cur.total += g.total;
      cur.seats += g.seats;
      cur.revenue += g.revenue;
      cur.commission += g.commission;
      routeMap.set(g.routeId, cur);
    }
    result.byRoute = [...routeMap.entries()]
      .map(([routeId, stat]) => ({
        routeId,
        total: stat.total,
        seats: stat.seats,
        commission: stat.commission,
        ...(isAdmin ? { revenue: stat.revenue } : {}),
      }))
      .sort((a, b) => b.total - a.total);

    // Nhân viên không được biết doanh thu / giá nhập: không trả về từ server
    if (actor.role !== UserRole.ADMIN) {
      delete result.revenue;
      delete result.cost;
    }

    // Vinh danh toàn hệ thống: chỉ số đơn / vé, không lộ doanh thu hay hoa hồng của người khác
    const byStaffGroups = groupByStaff(groups);
    // Xếp hạng đầy đủ mọi nhân viên (chỉ số đơn / vé) để nhân viên biết vị trí của mình
    result.ranking = [...byStaffGroups.entries()]
      .map(([staffId, list]) => ({
        staffId,
        fullName: list[0].fullName,
        total: sumOf(list, (g) => g.total),
        seats: sumOf(list, (g) => g.seats),
      }))
      .sort((a, b) => b.seats - a.seats || b.total - a.total);
    result.leaderboard = result.ranking.slice(0, 3);

    if (isAdmin) {
      result.byStaff = [...byStaffGroups.entries()]
        .map(([staffId, list]) => ({
          staffId,
          fullName: list[0].fullName,
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
    const { qb } = this.kpiFilteredQuery(
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
    // Chỉ lấy các bộ (nhân viên, tuyến, đối tác) khác nhau, không tải từng đơn
    const rows = await qb
      .select('order.createdById', 'staffId')
      .addSelect('order.routeId', 'routeId')
      .addSelect(`NULLIF(TRIM(order.partner), '')`, 'partner')
      .groupBy('order.createdById')
      .addGroupBy('order.routeId')
      .addGroupBy(`NULLIF(TRIM(order.partner), '')`)
      .getRawMany<{ staffId: number | string; routeId: number | string; partner: string | null }>();

    const ofStaff =
      actor.role === UserRole.ADMIN && query.staffId !== undefined
        ? rows.filter((r) => Number(r.staffId) === query.staffId)
        : rows;
    return {
      staffIds: [...new Set(rows.map((r) => Number(r.staffId)))],
      routeIds: [...new Set(ofStaff.map((r) => Number(r.routeId)))],
      partners: [...new Set(ofStaff.map((r) => r.partner).filter((p): p is string => !!p))],
    };
  }

  /** Công nợ theo đối tác trong khoảng lọc: số đơn, vé, thu hộ, hoa hồng giữ, giá nhập phải trả. Vé hủy không tính */
  async debts(query: KpiQueryDto, actor: JwtPayload) {
    const { qb } = this.kpiFilteredQuery(query, actor);
    // Gom theo tên đối tác ngay ở SQL (chỉ vài chục tên), rồi đối chiếu với danh sách đối tác chuẩn.
    // Giá nhập chưa nhập (0) thì lấy giá bán trừ hoa hồng
    const rows = await qb
      .select('order.partner', 'partner')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(`COALESCE(SUM(${TICKETS_SQL}), 0)`, 'tickets')
      .addSelect('COALESCE(SUM(order.sellPrice), 0)', 'revenue')
      .addSelect('COALESCE(SUM(order.commission), 0)', 'commission')
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.costPrice <> 0 THEN order.costPrice ELSE order.sellPrice - order.commission END), 0)',
        'cost',
      )
      .groupBy('order.partner')
      .orderBy('MIN(order.id)', 'ASC')
      .getRawMany<{
        partner: string | null;
        orders: string;
        tickets: string;
        revenue: string;
        commission: string;
        cost: string;
      }>();
    const partners = await this.getCachedPartners();
    const groups = new Map<
      string,
      { partner: string; orders: number; tickets: number; revenue: number; commission: number; cost: number }
    >();
    let excludedOrders = 0;
    const excludedPartnersMap = new Map<string, string>();

    for (const r of rows) {
      const canonical = matchCanonicalPartner(r.partner, partners);
      if (canonical === null) {
        // Đơn không có đối tác (rỗng) -> không thuộc công nợ đối tác nào, không tính vào excluded
        continue;
      }
      if (canonical === undefined) {
        // Đối tác lạ (ngoài danh sách) -> loại khỏi công nợ, ghi nhận vào excluded
        excludedOrders += Number(r.orders);
        const raw = r.partner?.trim();
        if (raw && !excludedPartnersMap.has(raw.toLowerCase())) {
          excludedPartnersMap.set(raw.toLowerCase(), raw);
        }
        continue;
      }
      const key = canonical.toLowerCase();
      const g = groups.get(key) ?? { partner: canonical, orders: 0, tickets: 0, revenue: 0, commission: 0, cost: 0 };
      g.orders += Number(r.orders);
      g.tickets += Number(r.tickets);
      g.revenue += Number(r.revenue);
      g.commission += Number(r.commission);
      g.cost += Number(r.cost);
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
