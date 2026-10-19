import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator.js';
import { User } from '../../users/entities/user.entity.js';
import { CABIN_LABELS, Order, PRIVATE_VEHICLE_TYPE } from '../entities/order.entity.js';
import type { OrderFilterDto } from '../dto/query-orders.dto.js';
import { filterOrdersByPartner } from '../order-partner.util.js';
import {
  neutralizeFormula,
  seatsOf,
  sortCabinLines,
  toExcelDate,
} from '../mappers/order.mapper.js';
import { OrdersQueryService } from './orders-query.service.js';

const EXPORT_LIMIT = 5000;
/** Dấu phẩy cuối định dạng chia hiển thị cho 1.000 (25000 hiện là 25); giá trị thật trong ô vẫn đầy đủ nên tổng không đổi */
const THOUSANDS_FMT = '#,##0,';

@Injectable()
export class OrdersExportService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queryService: OrdersQueryService,
  ) {}

  /** Xuất danh sách (đã lọc) ra file Excel, cột theo sổ "Nhật ký" */
  async exportExcel(filter: OrderFilterDto, actor: JwtPayload): Promise<Buffer> {
    const rawOrders = await this.queryService
      .buildListQuery(filter, actor, true)
      .orderBy('order.createdAt', 'DESC')
      .take(EXPORT_LIMIT)
      .getMany();

    const partners = await this.queryService.getCachedPartners();
    const { valid: orders, excluded } = filterOrdersByPartner(rawOrders, partners);
    const excludedCount = excluded.length;

    const exporter = await this.userRepository.findOne({
      where: { id: actor.sub },
      select: { id: true, fullName: true },
    });
    const isCancelled = (o: Order) => !!o.cancelledAt;
    const activeCount = orders.filter((o) => !isCancelled(o)).length;
    const cancelledCount = orders.length - activeCount;

    // Đơn "Xe Cabin" có cả cabin đơn và cabin đôi được tách thành mỗi loại một dòng.
    // Tiền cọc, nhờ thu, hoa hồng chỉ ghi ở dòng đầu để tổng không bị tính đôi.
    type Row = { order: Order; view: Order; orderIndex: number };
    const rows: Row[] = orders.flatMap((o, orderIndex) => {
      const lines = sortCabinLines(o.cabinLines);
      if (!lines) return [{ order: o, view: o, orderIndex }];
      return lines.map((line, i): Row => ({
        order: o,
        orderIndex,
        view: Object.assign(Object.create(Object.getPrototypeOf(o)) as Order, o, {
          vehicleType: CABIN_LABELS[line.kind],
          seatFront: 0,
          seatMiddle: 0,
          seatBack: 0,
          seatZone: null,
          seatCount: line.quantity,
          // Cột giá nhập / giá bán là tổng tiền của dòng = đơn giá x số lượng
          costPrice: line.costPrice * line.quantity,
          sellPrice: line.sellPrice * line.quantity,
          deposit: i === 0 ? o.deposit : 0,
          collectOnDelivery: i === 0 ? o.collectOnDelivery : 0,
          commission: i === 0 ? o.commission : 0,
        }),
      }));
    });
    const hasSplitRows = rows.length !== orders.length;

    // ---- bảng màu
    const NAVY = 'FF0F2A5C';
    const BLUE = 'FF2563EB';
    const BAND = 'FFF1F5FF';
    const LINE = 'FFCBD5E1';
    const YELLOW = 'FFFFF176';
    const RED = 'FFB91C1C';
    const GOLD = 'FFFFE9A8';
    const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const thin = { style: 'thin', color: { argb: LINE } } as const;
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
    const seats = (o: Order) => seatsOf(o);
    const COLS: Col[] = [
      { header: 'STT', width: 8, align: 'center', value: (_o, i) => rows[i].orderIndex + 1 },
      { header: 'TRẠNG THÁI', width: 16, align: 'center', value: (o) => (isCancelled(o) ? 'ĐÃ HỦY' : 'Hợp lệ') },
      { header: 'NGÀY VÀO SỔ', width: 16, align: 'center', fmt: 'dd/mm/yyyy', value: (o) => toExcelDate(o.entryDate) },
      { header: 'NV', width: 20, value: (o) => o.createdBy?.fullName ?? '' },
      { header: 'TÊN KHÁCH', width: 24, value: (o) => neutralizeFormula(o.customerName ?? '') },
      { header: 'SỐ ĐIỆN THOẠI', width: 18, align: 'center', value: (o) => o.phone },
      { header: 'TUYẾN ĐI', width: 30, value: (o) => neutralizeFormula(o.route?.name ?? '') },
      { header: 'GIỜ ĐI', width: 11, align: 'center', value: (o) => o.departureTime },
      { header: 'NGÀY KHỞI HÀNH', width: 18, align: 'center', fmt: 'dd/mm/yyyy', value: (o) => toExcelDate(o.departureDate) },
      {
        header: 'LOẠI HÌNH',
        width: 22,
        // Xe riêng ghi kèm số xe (không tính vào cột SỐ GHẾ)
        value: (o) =>
          neutralizeFormula(
            o.vehicleType === PRIVATE_VEHICLE_TYPE && o.vehicleCount > 0
              ? `${o.vehicleType} x${o.vehicleCount}`
              : (o.vehicleType ?? ''),
          ),
      },
      { header: 'ĐẦU', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatFront || '' },
      { header: 'GIỮA', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatMiddle || '' },
      { header: 'CUỐI', width: 10, align: 'center', sum: true, value: (o) => seats(o).seatBack || '' },
      { header: 'SỐ GHẾ', width: 11, align: 'center', sum: true, value: (o) => o.seatCount || '' },
      { header: 'GIÁ NHẬP', width: 16, align: 'right', fmt: THOUSANDS_FMT, sum: true, value: (o) => o.costPrice },
      { header: 'GIÁ BÁN', width: 16, align: 'right', fmt: THOUSANDS_FMT, sum: true, value: (o) => o.sellPrice },
      { header: 'ĐÃ CỌC', width: 16, align: 'right', fmt: THOUSANDS_FMT, sum: true, value: (o) => o.deposit },
      { header: 'NHỜ THU', width: 16, align: 'right', fmt: THOUSANDS_FMT, sum: true, value: (o) => o.collectOnDelivery },
      { header: 'HOA HỒNG', width: 16, align: 'right', fmt: THOUSANDS_FMT, sum: true, value: (o) => o.commission },
      { header: 'ĐỐI TÁC', width: 24, value: (o) => neutralizeFormula(o.partner ?? '') },
      { header: 'GHI CHÚ', width: 34, value: (o) => neutralizeFormula(o.note ?? '') },
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
      (excludedCount > 0 ? `, ${excludedCount} đơn bị loại vì đối tác không có trong danh sách` : '') +
      (cancelledCount > 0 ? '  (vé đã hủy chữ đỏ và không tính vào dòng TỔNG)' : '') +
      '  •  Vé đã cọc nền vàng';
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
    rows.forEach(({ order, view: o, orderIndex }, idx) => {
      const row = sheet.getRow(HEADER_ROW + 1 + idx);
      row.height = 21;
      const cancelled = isCancelled(o);
      // Đã cọc theo cả đơn: đơn tách nhiều dòng thì dòng nào cũng vàng dù tiền cọc chỉ ghi ở dòng đầu
      const deposited = !cancelled && order.deposit > 0;
      COLS.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = c.value(o, idx);
        if (c.fmt) cell.numFmt = c.fmt;
        cell.border = box;
        cell.alignment = { horizontal: c.align ?? 'left', vertical: 'middle' };
        if (cancelled) {
          // Vé hủy: nền trắng, chữ đỏ
          cell.fill = solid('FFFFFFFF');
          cell.font = { color: { argb: RED } };
        } else if (deposited) {
          // Vé đã cọc: nền vàng, chữ đen
          cell.fill = solid(YELLOW);
          cell.font = { color: { argb: 'FF000000' } };
        } else if (orderIndex % 2 === 1) {
          cell.fill = solid(BAND);
        }
      });
      // Ô trạng thái nổi bật
      const status = row.getCell(2);
      status.font = { bold: true, color: { argb: cancelled ? RED : 'FFFFFFFF' } };
      status.fill = solid(cancelled ? 'FFFFFFFF' : GREEN);
    });

    // ---- dòng tổng (chỉ tính vé hợp lệ)
    const first = HEADER_ROW + 1;
    const last = HEADER_ROW + rows.length;
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
      if (c.sum && rows.length > 0) {
        const colLetter = sheet.getColumn(i + 1).letter;
        const result = rows
          .filter((r) => !isCancelled(r.view))
          .reduce((acc, r) => {
            const v = c.value(r.view, 0);
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

    if (rows.length > 0) {
      sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: last, column: N } };
    }
    sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;

    // ---- khối tổng kết bên dưới bảng
    const colIndex = (header: string) => COLS.findIndex((c) => c.header === header) + 1;
    const totalCell = (header: string) => `${sheet.getColumn(colIndex(header)).letter}${last + 1}`;
    const sumOf = (pick: (o: Order) => number) =>
      rows.filter((r) => !isCancelled(r.view)).reduce((acc, r) => acc + pick(r.view), 0);
    const hasRows = orders.length > 0;
    const statusRange = `$B$${first}:$B$${last}`;
    const panel: Array<{ label: string; value: ExcelJS.CellValue; fmt?: string; color?: string }> = [
      // Có đơn tách dòng thì một đơn chiếm nhiều dòng, nên đếm đơn bằng số cố định thay vì công thức đếm dòng
      { label: 'Tổng số đơn', value: hasRows ? (hasSplitRows ? orders.length : { formula: `COUNTA(${statusRange})`, result: orders.length }) : 0 },
      { label: 'Đơn hợp lệ', value: hasRows ? (hasSplitRows ? activeCount : { formula: `COUNTIF(${statusRange},"Hợp lệ")`, result: activeCount }) : 0, color: GREEN },
      { label: 'Đơn đã hủy', value: hasRows ? (hasSplitRows ? cancelledCount : { formula: `COUNTIF(${statusRange},"ĐÃ HỦY")`, result: cancelledCount }) : 0, color: RED },
      { label: 'Tổng vé (số ghế, vé hợp lệ)', value: hasRows ? { formula: totalCell('SỐ GHẾ'), result: sumOf((o) => o.seatCount) } : 0 },
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
}
