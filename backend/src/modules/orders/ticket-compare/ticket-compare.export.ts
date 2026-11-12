import ExcelJS from 'exceljs';
import type { TicketCompareResponse } from './ticket-compare.service.js';
import type { PhoneDiff, TicketDetail } from './ticket-compare.util.js';

/** Bảng màu đồng bộ với file xuất vé */
const NAVY = 'FF0F2A5C';
const WHITE = 'FFFFFFFF';
const LINE = 'FFCBD5E1';
const BAND = 'FFF8FAFC';
const MUTED = 'FF64748B';
const GREEN = 'FF059669';

type Names = { a: string; b: string };

/** Mỗi nhóm chênh lệch một sheet: tên sheet, tiêu đề, mô tả, màu nhãn và màu nền nhạt */
const CATEGORY = {
  mismatched: {
    sheet: 'Lệch số vé',
    title: 'Lệch số vé giữa 2 file',
    describe: (_n: Names) => 'Số điện thoại có ở cả 2 file nhưng số vé khác nhau',
    chip: 'FFDC2626',
    tint: 'FFFEF2F2',
  },
  onlyA: {
    sheet: 'Có ở A, thiếu ở B',
    title: 'Có ở file A, thiếu ở file B',
    describe: (n: Names) => `Số điện thoại có trong file A (${n.a}) nhưng không có trong file B (${n.b})`,
    chip: 'FF2563EB',
    tint: 'FFEFF6FF',
  },
  onlyB: {
    sheet: 'Có ở B, thiếu ở A',
    title: 'Có ở file B, thiếu ở file A',
    describe: (n: Names) => `Số điện thoại có trong file B (${n.b}) nhưng không có trong file A (${n.a})`,
    chip: 'FFD97706',
    tint: 'FFFFFBEB',
  },
} as const;
type Category = keyof typeof CATEGORY;

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: LINE } } as const;
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

const SHEET_OPTS: Partial<ExcelJS.AddWorksheetOptions> = {
  views: [{ showGridLines: false }],
  pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
};

/** Ô bắt đầu bằng = + - @ bị Excel hiểu là công thức: thêm dấu nháy để luôn là chữ */
const safeText = (s: string | undefined) => {
  const v = (s ?? '').trim();
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
};

/** "2 vé · Hà Nội - Sapa · 21:00 04/10/2026 · Mã VX123", mỗi vé một dòng trong ô */
function describeTickets(tickets: TicketDetail[]): string {
  return tickets
    .map((t) =>
      [`${t.quantity} vé`, t.route, t.departure, t.ticketId ? `Mã ${t.ticketId}` : undefined]
        .filter(Boolean)
        .join(' · '),
    )
    .join('\n');
}

/** "09:05 12/11/2026" theo giờ Việt Nam */
function vnStamp(at: Date): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('hour')}:${g('minute')} ${g('day')}/${g('month')}/${g('year')}`;
}

/** Tên file hiển thị trong báo cáo: bỏ đuôi, giới hạn độ dài */
export function displayName(fileName: string | undefined, fallback: string): string {
  const name = (fileName ?? '').replace(/\.[^/.]+$/, '').trim();
  return (name || fallback).slice(0, 60);
}

/** Tên sheet kèm số lượng; Excel giới hạn 31 ký tự và cấm các ký tự : \ / ? * [ ] */
export function sheetName(base: string, count: number): string {
  return `${base} (${count})`.replace(/[:\\/?*[\]]/g, '').slice(0, 31);
}

/** Dòng tiêu đề lớn (nền màu) và dòng mô tả (chữ xám) ở đầu mỗi sheet */
function writeTitle(sheet: ExcelJS.Worksheet, cols: number, title: string, subtitle: string, color: string) {
  sheet.mergeCells(1, 1, 1, cols);
  const t = sheet.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: WHITE } };
  t.fill = solid(color);
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, cols);
  const sub = sheet.getCell(2, 1);
  sub.value = subtitle;
  sub.font = { italic: true, size: 10, color: { argb: MUTED } };
  sub.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getRow(2).height = 30;
}

type Column = {
  header: string;
  width: number;
  center?: boolean;
  wrap?: boolean;
  value: (d: PhoneDiff) => string | number;
};

/** Cột của từng sheet: sheet chỉ có một bên thì bỏ hẳn cột của bên kia (toàn số 0 / trống) */
function columnsFor(category: Category): Column[] {
  const cols: Column[] = [
    { header: 'STT', width: 7, center: true, value: () => 0 },
    { header: 'SỐ ĐIỆN THOẠI', width: 16, value: (d) => d.phone },
    { header: 'TÊN KHÁCH', width: 26, value: (d) => safeText(d.customerName) },
  ];
  if (category === 'mismatched') {
    return [
      ...cols,
      { header: 'VÉ FILE A', width: 11, center: true, value: (d) => d.countA },
      { header: 'VÉ FILE B', width: 11, center: true, value: (d) => d.countB },
      { header: 'CHÊNH LỆCH\n(A - B)', width: 13, center: true, value: (d) => (d.delta > 0 ? `+${d.delta}` : String(d.delta)) },
      { header: 'CHI TIẾT VÉ FILE A', width: 46, wrap: true, value: (d) => safeText(describeTickets(d.ticketsA)) || '—' },
      { header: 'CHI TIẾT VÉ FILE B', width: 46, wrap: true, value: (d) => safeText(describeTickets(d.ticketsB)) || '—' },
    ];
  }
  const side = category === 'onlyA' ? 'A' : 'B';
  const count = (d: PhoneDiff) => (category === 'onlyA' ? d.countA : d.countB);
  const tickets = (d: PhoneDiff) => (category === 'onlyA' ? d.ticketsA : d.ticketsB);
  return [
    ...cols,
    { header: `SỐ VÉ FILE ${side}`, width: 13, center: true, value: count },
    { header: `CHI TIẾT VÉ FILE ${side}`, width: 64, wrap: true, value: (d) => safeText(describeTickets(tickets(d))) || '—' },
  ];
}

/** Một sheet danh sách SĐT của đúng một nhóm chênh lệch */
function writeGroupSheet(wb: ExcelJS.Workbook, category: Category, list: PhoneDiff[], names: Names, stamp: string) {
  const meta = CATEGORY[category];
  const sheet = wb.addWorksheet(sheetName(meta.sheet, list.length), {
    ...SHEET_OPTS,
    properties: { tabColor: { argb: meta.chip } },
  });
  const cols = columnsFor(category);
  const N = cols.length;
  cols.forEach((c, i) => (sheet.getColumn(i + 1).width = c.width));

  writeTitle(sheet, N, meta.title.toUpperCase(), `${meta.describe(names)}     •     Xuất lúc ${stamp}`, meta.chip);

  const HEADER_ROW = 4;
  const header = sheet.getRow(HEADER_ROW);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = box;
  });
  header.height = 32;

  if (list.length === 0) {
    sheet.mergeCells(HEADER_ROW + 1, 1, HEADER_ROW + 1, N);
    const none = sheet.getCell(HEADER_ROW + 1, 1);
    none.value = 'Không có số điện thoại nào trong nhóm này.';
    none.font = { bold: true, size: 11, color: { argb: GREEN } };
    none.fill = solid('FFECFDF5');
    none.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(HEADER_ROW + 1).height = 28;
  }

  list.forEach((d, i) => {
    const row = sheet.getRow(HEADER_ROW + 1 + i);
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = ci === 0 ? i + 1 : c.value(d);
      cell.border = box;
      cell.fill = solid(i % 2 === 0 ? WHITE : BAND);
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: c.center ? 'center' : 'left', wrapText: !!c.wrap };
    });
    // Số điện thoại luôn là chữ để không mất số 0 đầu
    row.getCell(2).numFmt = '@';
    row.getCell(2).font = { size: 10, bold: true };
    if (category === 'mismatched') {
      const delta = row.getCell(6);
      delta.font = { size: 11, bold: true, color: { argb: d.delta > 0 ? CATEGORY.onlyA.chip : CATEGORY.mismatched.chip } };
      delta.fill = solid(meta.tint);
    }
    const lines = Math.max(1, d.ticketsA.length, d.ticketsB.length);
    row.height = Math.max(20, 15 * lines + 4);
  });

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }];
  if (list.length > 0) {
    sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + list.length, column: N } };
  }
  sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;
}

/**
 * Báo cáo đối chiếu vé dạng Excel, mỗi nhóm một sheet:
 * "Tổng quan" (tên 2 file, thẻ số liệu, mục lục bấm được), "Lệch số vé",
 * "Có ở A, thiếu ở B", "Có ở B, thiếu ở A" (tên sheet kèm số lượng).
 */
export async function buildCompareWorkbook(
  result: TicketCompareResponse,
  names: Names,
  exportedAt: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'XVIP';
  wb.created = exportedAt;
  const stamp = vnStamp(exportedAt);
  const groups: Array<{ category: Category; list: PhoneDiff[] }> = [
    { category: 'mismatched', list: result.mismatched },
    { category: 'onlyA', list: result.onlyInA },
    { category: 'onlyB', list: result.onlyInB },
  ];

  // ---- Sheet Tổng quan
  const sheet = wb.addWorksheet('Tổng quan', { ...SHEET_OPTS, properties: { tabColor: { argb: NAVY } } });
  const N = 6;
  [24, 18, 18, 18, 18, 18].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  writeTitle(sheet, N, 'BÁO CÁO ĐỐI CHIẾU VÉ NHÀ XE', `Xuất lúc ${stamp}`, NAVY);

  // Hai file đem so
  const files: Array<[string, string]> = [
    ['File A', names.a],
    ['File B', names.b],
  ];
  files.forEach(([label, name], i) => {
    const r = 4 + i;
    const l = sheet.getCell(r, 1);
    l.value = label;
    l.font = { bold: true, color: { argb: WHITE } };
    l.fill = solid(NAVY);
    l.alignment = { horizontal: 'center', vertical: 'middle' };
    l.border = box;
    sheet.mergeCells(r, 2, r, N);
    const v = sheet.getCell(r, 2);
    v.value = safeText(name);
    v.font = { bold: true, size: 11 };
    v.alignment = { vertical: 'middle', indent: 1 };
    v.border = box;
    sheet.getRow(r).height = 22;
  });

  // Thẻ số liệu: nhãn (trên, nền màu) và con số (dưới)
  const cards: Array<{ label: string; value: number; color: string }> = [
    { label: 'SĐT khớp', value: result.matchedPhones, color: GREEN },
    { label: 'Lệch số vé', value: result.mismatched.length, color: CATEGORY.mismatched.chip },
    { label: 'Có ở A, thiếu ở B', value: result.onlyInA.length, color: CATEGORY.onlyA.chip },
    { label: 'Có ở B, thiếu ở A', value: result.onlyInB.length, color: CATEGORY.onlyB.chip },
    { label: `Tổng vé A (${result.totalPhonesA} SĐT)`, value: result.totalTicketsA, color: NAVY },
    { label: `Tổng vé B (${result.totalPhonesB} SĐT)`, value: result.totalTicketsB, color: NAVY },
  ];
  const LABEL_ROW = 7;
  const VALUE_ROW = 8;
  cards.forEach((c, i) => {
    const label = sheet.getCell(LABEL_ROW, i + 1);
    label.value = c.label.toUpperCase();
    label.font = { bold: true, size: 9, color: { argb: WHITE } };
    label.fill = solid(c.color);
    label.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    label.border = { top: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
    const value = sheet.getCell(VALUE_ROW, i + 1);
    value.value = c.value;
    value.numFmt = '#,##0';
    value.font = { bold: true, size: 20, color: { argb: c.color } };
    value.alignment = { horizontal: 'center', vertical: 'middle' };
    value.border = { bottom: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
  });
  sheet.getRow(LABEL_ROW).height = 30;
  sheet.getRow(VALUE_ROW).height = 38;

  const cancelled = result.cancelledCountA + result.cancelledCountB;
  sheet.mergeCells(9, 1, 9, N);
  const note = sheet.getCell(9, 1);
  note.value =
    'Chênh lệch = vé file A - vé file B.' +
    (cancelled > 0 ? `  Đã bỏ qua vé hủy: ${result.cancelledCountA} ở file A, ${result.cancelledCountB} ở file B.` : '');
  note.font = { size: 10, color: { argb: MUTED } };
  note.alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(9).height = 22;

  // Mục lục: bấm tên sheet để nhảy sang sheet chi tiết
  const TOC_ROW = 11;
  sheet.mergeCells(TOC_ROW, 1, TOC_ROW, N);
  const toc = sheet.getCell(TOC_ROW, 1);
  toc.value = 'CÁC SHEET CHI TIẾT (bấm tên sheet để mở)';
  toc.font = { bold: true, size: 11, color: { argb: NAVY } };
  toc.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
  sheet.getRow(TOC_ROW).height = 22;
  groups.forEach(({ category, list }, i) => {
    const meta = CATEGORY[category];
    const r = TOC_ROW + 1 + i;
    const name = sheetName(meta.sheet, list.length);
    const link = sheet.getCell(r, 1);
    link.value = { text: name, hyperlink: `#'${name}'!A1` };
    link.font = { bold: true, underline: true, color: { argb: meta.chip } };
    link.alignment = { vertical: 'middle' };
    sheet.mergeCells(r, 2, r, N);
    const desc = sheet.getCell(r, 2);
    desc.value = meta.describe(names);
    desc.font = { size: 10, color: { argb: MUTED } };
    desc.alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(r).height = 30;
  });

  // ---- Mỗi nhóm một sheet
  for (const { category, list } of groups) writeGroupSheet(wb, category, list, names, stamp);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
