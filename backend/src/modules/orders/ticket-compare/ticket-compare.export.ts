import ExcelJS from 'exceljs';
import type { TicketCompareResponse } from './ticket-compare.service.js';
import type { DaySummary, PhoneDiff, TicketDetail } from './ticket-compare.util.js';

/** Bảng màu đồng bộ với file xuất vé */
const NAVY = 'FF0F2A5C';
const WHITE = 'FFFFFFFF';
const LINE = 'FFCBD5E1';
const BAND = 'FFF8FAFC';
const MUTED = 'FF64748B';
const GREEN = 'FF059669';
const PURPLE = 'FF7C3AED';
const GOLD = 'FFFFE9A8';
const RED = 'FFDC2626';

const MONEY = '#,##0';

type Names = { a: string; b: string };

/** Mỗi nhóm chênh lệch một sheet: tên sheet, tiêu đề, mô tả, màu nhãn và màu nền nhạt */
const CATEGORY = {
  ticketMismatch: {
    sheet: 'Lệch số vé',
    title: 'Lệch số vé giữa 2 file',
    describe: (_n: Names) => 'Có ở cả 2 file nhưng số vé khác nhau',
    chip: RED,
    tint: 'FFFEF2F2',
  },
  depositMismatch: {
    sheet: 'Lệch tiền cọc',
    title: 'Lệch tiền cọc giữa 2 file',
    describe: (_n: Names) => 'Có ở cả 2 file nhưng tiền cọc khác nhau',
    chip: 'FFDB2777',
    tint: 'FFFDF2F8',
  },
  onlyA: {
    sheet: 'Có ở A, thiếu ở B',
    title: 'Có ở file A, thiếu ở file B',
    describe: (n: Names) => `Có trong file A (${n.a}) nhưng không có trong file B (${n.b})`,
    chip: 'FF2563EB',
    tint: 'FFEFF6FF',
  },
  onlyB: {
    sheet: 'Có ở B, thiếu ở A',
    title: 'Có ở file B, thiếu ở file A',
    describe: (n: Names) => `Có trong file B (${n.b}) nhưng không có trong file A (${n.a})`,
    chip: 'FFD97706',
    tint: 'FFFFFBEB',
  },
} as const;
type Category = keyof typeof CATEGORY;

const BY_DAY_SHEET = 'Theo ngày';

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

const money = (n: number) => n.toLocaleString('vi-VN');

/** "2026-10-01" -> "01/10/2026"; rỗng -> "Không rõ ngày" */
export const vnDay = (day: string | undefined) =>
  day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : 'Không rõ ngày';

/** "2 vé · Hà Nội - Sapa · 21:00 04/10/2026 · Mã VX123 · Cọc 170.000", mỗi vé một dòng trong ô */
function describeTickets(tickets: TicketDetail[]): string {
  return tickets
    .map((t) =>
      [
        `${t.quantity} vé`,
        t.route,
        t.departure,
        t.ticketId ? `Mã ${t.ticketId}` : undefined,
        t.deposit ? `Cọc ${money(t.deposit)}` : undefined,
      ]
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

/** Dòng tiêu đề bảng (nền navy, chữ trắng) */
function writeHeader(sheet: ExcelJS.Worksheet, row: number, headers: string[]) {
  const header = sheet.getRow(row);
  headers.forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = box;
  });
  header.height = 32;
}

/** Số chênh lệch có dấu: dương xanh dương (A nhiều hơn), âm đỏ (B nhiều hơn), 0 xám */
function styleDelta(cell: ExcelJS.Cell, n: number, isMoney: boolean) {
  cell.value = n;
  cell.numFmt = isMoney ? `+#,##0;-#,##0;0` : '+0;-0;0';
  cell.font = {
    size: 11,
    bold: n !== 0,
    color: { argb: n > 0 ? CATEGORY.onlyA.chip : n < 0 ? RED : MUTED },
  };
}

type Kind = 'text' | 'count' | 'money' | 'delta' | 'moneyDelta' | 'detail';
type Column = { header: string; width: number; kind: Kind; value: (d: PhoneDiff) => string | number };

/** Cột của từng sheet: sheet chỉ có một bên thì bỏ hẳn cột của bên kia (toàn số 0 / trống) */
function columnsFor(category: Category, byDay: boolean): Column[] {
  const cols: Column[] = [{ header: 'STT', width: 7, kind: 'count', value: () => 0 }];
  if (byDay) cols.push({ header: 'NGÀY\nKHỞI HÀNH', width: 13, kind: 'text', value: (d) => vnDay(d.day) });
  cols.push(
    { header: 'SỐ ĐIỆN THOẠI', width: 16, kind: 'text', value: (d) => d.phone },
    { header: 'TÊN KHÁCH', width: 24, kind: 'text', value: (d) => safeText(d.customerName) },
  );
  const details: Column[] = [
    { header: 'CHI TIẾT VÉ FILE A', width: 42, kind: 'detail', value: (d) => safeText(describeTickets(d.ticketsA)) || '—' },
    { header: 'CHI TIẾT VÉ FILE B', width: 42, kind: 'detail', value: (d) => safeText(describeTickets(d.ticketsB)) || '—' },
  ];
  if (category === 'ticketMismatch') {
    return [
      ...cols,
      { header: 'VÉ\nFILE A', width: 9, kind: 'count', value: (d) => d.countA },
      { header: 'VÉ\nFILE B', width: 9, kind: 'count', value: (d) => d.countB },
      { header: 'CHÊNH VÉ\n(A - B)', width: 11, kind: 'delta', value: (d) => d.delta },
      ...details,
    ];
  }
  if (category === 'depositMismatch') {
    return [
      ...cols,
      { header: 'CỌC\nFILE A', width: 13, kind: 'money', value: (d) => d.depositA },
      { header: 'CỌC\nFILE B', width: 13, kind: 'money', value: (d) => d.depositB },
      { header: 'CHÊNH CỌC\n(A - B)', width: 14, kind: 'moneyDelta', value: (d) => d.depositDelta },
      ...details,
    ];
  }
  const a = category === 'onlyA';
  const side = a ? 'A' : 'B';
  return [
    ...cols,
    { header: `SỐ VÉ\nFILE ${side}`, width: 11, kind: 'count', value: (d) => (a ? d.countA : d.countB) },
    { header: `CỌC\nFILE ${side}`, width: 13, kind: 'money', value: (d) => (a ? d.depositA : d.depositB) },
    { header: `CHI TIẾT VÉ FILE ${side}`, width: 60, kind: 'detail', value: (d) => safeText(describeTickets(a ? d.ticketsA : d.ticketsB)) || '—' },
  ];
}

/** Một sheet danh sách SĐT của đúng một nhóm chênh lệch */
function writeGroupSheet(
  wb: ExcelJS.Workbook,
  category: Category,
  list: PhoneDiff[],
  names: Names,
  stamp: string,
  byDay: boolean,
) {
  const meta = CATEGORY[category];
  const sheet = wb.addWorksheet(sheetName(meta.sheet, list.length), {
    ...SHEET_OPTS,
    properties: { tabColor: { argb: meta.chip } },
  });
  const cols = columnsFor(category, byDay);
  const N = cols.length;
  cols.forEach((c, i) => (sheet.getColumn(i + 1).width = c.width));

  const by = byDay ? 'Theo cặp số điện thoại + ngày khởi hành' : 'Theo số điện thoại';
  writeTitle(sheet, N, meta.title.toUpperCase(), `${meta.describe(names)}  •  ${by}  •  Xuất lúc ${stamp}`, meta.chip);

  const HEADER_ROW = 4;
  writeHeader(sheet, HEADER_ROW, cols.map((c) => c.header));

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
      cell.border = box;
      cell.fill = solid(i % 2 === 0 ? WHITE : BAND);
      cell.font = { size: 10 };
      const v = ci === 0 ? i + 1 : c.value(d);
      if (c.kind === 'delta' || c.kind === 'moneyDelta') {
        styleDelta(cell, v as number, c.kind === 'moneyDelta');
        if (v !== 0) cell.fill = solid(meta.tint);
      } else {
        cell.value = v;
        if (c.kind === 'money') cell.numFmt = MONEY;
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: c.kind === 'text' || c.kind === 'detail' ? 'left' : c.kind === 'count' ? 'center' : 'right',
        wrapText: c.kind === 'detail',
      };
    });
    // Số điện thoại luôn là chữ để không mất số 0 đầu
    const phoneCell = row.getCell(byDay ? 3 : 2);
    phoneCell.numFmt = '@';
    phoneCell.font = { size: 10, bold: true };
    const lines = Math.max(1, d.ticketsA.length, d.ticketsB.length);
    row.height = Math.max(20, 15 * lines + 4);
  });

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }];
  if (list.length > 0) {
    sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + list.length, column: N } };
  }
  sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;
}

/** Sheet "Theo ngày": mỗi ngày khởi hành một dòng, so số vé và tiền cọc 2 bên, có dòng TỔNG */
function writeByDaySheet(wb: ExcelJS.Workbook, days: DaySummary[], names: Names, stamp: string) {
  const sheet = wb.addWorksheet(sheetName(BY_DAY_SHEET, days.length), {
    ...SHEET_OPTS,
    properties: { tabColor: { argb: PURPLE } },
  });
  const headers = [
    'NGÀY\nKHỞI HÀNH',
    'VÉ\nFILE A',
    'VÉ\nFILE B',
    'CHÊNH VÉ\n(A - B)',
    'SĐT\nLỆCH VÉ',
    'CỌC FILE A',
    'CỌC FILE B',
    'CHÊNH CỌC\n(A - B)',
    'SĐT\nLỆCH CỌC',
  ];
  const N = headers.length;
  [15, 10, 10, 12, 11, 16, 16, 16, 11].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  writeTitle(
    sheet,
    N,
    'ĐỐI CHIẾU THEO NGÀY KHỞI HÀNH',
    `File A: ${safeText(names.a)}  •  File B: ${safeText(names.b)}  •  Xuất lúc ${stamp}`,
    PURPLE,
  );
  const HEADER_ROW = 4;
  writeHeader(sheet, HEADER_ROW, headers);

  const write = (r: number, cells: Array<string | number>, total: boolean, band: boolean) => {
    const row = sheet.getRow(r);
    cells.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.border = box;
      cell.fill = solid(total ? GOLD : band ? BAND : WHITE);
      cell.font = { size: total ? 11 : 10, bold: total || ci === 0 };
      if (ci === 3 || ci === 7) styleDelta(cell, v as number, ci === 7);
      else {
        cell.value = v;
        if (ci === 5 || ci === 6) cell.numFmt = MONEY;
      }
      if (total) cell.font = { ...cell.font, bold: true, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: ci >= 5 && ci <= 7 ? 'right' : 'center' };
      // Ngày có chênh lệch: số SĐT lệch vé / lệch cọc tô đỏ để dễ thấy
      if ((ci === 4 || ci === 8) && !total) {
        cell.font = { size: 10, bold: (v as number) > 0, color: { argb: (v as number) > 0 ? RED : GREEN } };
      }
    });
    row.height = total ? 24 : 20;
  };

  days.forEach((d, i) =>
    write(
      HEADER_ROW + 1 + i,
      [
        vnDay(d.day),
        d.ticketsA,
        d.ticketsB,
        d.ticketsA - d.ticketsB,
        d.ticketDiffPhones,
        d.depositA,
        d.depositB,
        d.depositA - d.depositB,
        d.depositDiffPhones,
      ],
      false,
      i % 2 === 1,
    ),
  );
  const sum = (f: (d: DaySummary) => number) => days.reduce((n, d) => n + f(d), 0);
  const tA = sum((d) => d.ticketsA);
  const tB = sum((d) => d.ticketsB);
  const cA = sum((d) => d.depositA);
  const cB = sum((d) => d.depositB);
  write(
    HEADER_ROW + 1 + days.length,
    ['TỔNG', tA, tB, tA - tB, sum((d) => d.ticketDiffPhones), cA, cB, cA - cB, sum((d) => d.depositDiffPhones)],
    true,
    false,
  );

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }];
  sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;
}

/**
 * Báo cáo đối chiếu vé dạng Excel, mỗi phần một sheet:
 * "Tổng quan" (tên 2 file, thẻ số liệu vé + cọc, mục lục bấm được), "Theo ngày" (khi so được theo ngày
 * khởi hành), "Lệch số vé", "Lệch tiền cọc", "Có ở A, thiếu ở B", "Có ở B, thiếu ở A" (tên sheet kèm số lượng).
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
  const byDay = result.comparedByDay;
  const groups: Array<{ category: Category; list: PhoneDiff[] }> = [
    { category: 'ticketMismatch', list: result.ticketMismatched },
    { category: 'depositMismatch', list: result.depositMismatched },
    { category: 'onlyA', list: result.onlyInA },
    { category: 'onlyB', list: result.onlyInB },
  ];

  // ---- Sheet Tổng quan
  const sheet = wb.addWorksheet('Tổng quan', { ...SHEET_OPTS, properties: { tabColor: { argb: NAVY } } });
  const N = 6;
  [24, 18, 18, 18, 18, 18].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  writeTitle(
    sheet,
    N,
    'BÁO CÁO ĐỐI CHIẾU VÉ NHÀ XE',
    `${byDay ? 'So theo cặp số điện thoại + ngày khởi hành' : 'So theo số điện thoại'}  •  Xuất lúc ${stamp}`,
    NAVY,
  );

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
  const writeCards = (
    labelRow: number,
    cards: Array<{ label: string; value: number; color: string; money?: boolean; signed?: boolean }>,
  ) => {
    cards.forEach((c, i) => {
      const label = sheet.getCell(labelRow, i + 1);
      label.value = c.label.toUpperCase();
      label.font = { bold: true, size: 9, color: { argb: WHITE } };
      label.fill = solid(c.color);
      label.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      label.border = { top: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
      const value = sheet.getCell(labelRow + 1, i + 1);
      value.value = c.value;
      value.numFmt = c.signed ? '+#,##0;-#,##0;0' : MONEY;
      value.font = { bold: true, size: c.money ? 15 : 20, color: { argb: c.color } };
      value.alignment = { horizontal: 'center', vertical: 'middle' };
      value.border = { bottom: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
    });
    sheet.getRow(labelRow).height = 30;
    sheet.getRow(labelRow + 1).height = 36;
  };
  const unit = byDay ? 'cặp SĐT-ngày' : 'SĐT';
  writeCards(7, [
    { label: `Khớp hoàn toàn (${unit})`, value: result.matchedPhones, color: GREEN },
    { label: 'Lệch số vé', value: result.ticketMismatched.length, color: CATEGORY.ticketMismatch.chip },
    { label: 'Lệch tiền cọc', value: result.depositMismatched.length, color: CATEGORY.depositMismatch.chip },
    { label: 'Có ở A, thiếu ở B', value: result.onlyInA.length, color: CATEGORY.onlyA.chip },
    { label: 'Có ở B, thiếu ở A', value: result.onlyInB.length, color: CATEGORY.onlyB.chip },
  ]);
  const ticketDelta = result.totalTicketsA - result.totalTicketsB;
  const depositDelta = result.totalDepositA - result.totalDepositB;
  writeCards(10, [
    { label: `Tổng vé A (${result.totalPhonesA} SĐT)`, value: result.totalTicketsA, color: NAVY },
    { label: `Tổng vé B (${result.totalPhonesB} SĐT)`, value: result.totalTicketsB, color: NAVY },
    { label: 'Chênh lệch vé (A - B)', value: ticketDelta, color: ticketDelta === 0 ? GREEN : RED, signed: true },
    { label: 'Tổng cọc file A (đồng)', value: result.totalDepositA, color: PURPLE, money: true },
    { label: 'Tổng cọc file B (đồng)', value: result.totalDepositB, color: PURPLE, money: true },
    { label: 'Chênh lệch cọc (A - B)', value: depositDelta, color: depositDelta === 0 ? GREEN : RED, money: true, signed: true },
  ]);

  const cancelled = result.cancelledCountA + result.cancelledCountB;
  const NOTE_ROW = 13;
  sheet.mergeCells(NOTE_ROW, 1, NOTE_ROW, N);
  const note = sheet.getCell(NOTE_ROW, 1);
  note.value =
    'Chênh lệch = file A - file B. Tiền cọc tính theo đồng (file ghi nghìn đồng đã được quy đổi).' +
    (cancelled > 0 ? `  Đã bỏ qua vé hủy: ${result.cancelledCountA} ở file A, ${result.cancelledCountB} ở file B.` : '');
  note.font = { size: 10, color: { argb: MUTED } };
  note.alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(NOTE_ROW).height = 30;

  // Mục lục: bấm tên sheet để nhảy sang sheet chi tiết
  const TOC_ROW = 15;
  sheet.mergeCells(TOC_ROW, 1, TOC_ROW, N);
  const toc = sheet.getCell(TOC_ROW, 1);
  toc.value = 'CÁC SHEET CHI TIẾT (bấm tên sheet để mở)';
  toc.font = { bold: true, size: 11, color: { argb: NAVY } };
  toc.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
  sheet.getRow(TOC_ROW).height = 22;
  const links: Array<{ name: string; color: string; describe: string }> = [
    ...(byDay
      ? [{ name: sheetName(BY_DAY_SHEET, result.byDay.length), color: PURPLE, describe: 'Mỗi ngày khởi hành: số vé và tiền cọc hai bên, số SĐT lệch vé / lệch cọc' }]
      : []),
    ...groups.map(({ category, list }) => ({
      name: sheetName(CATEGORY[category].sheet, list.length),
      color: CATEGORY[category].chip,
      describe: CATEGORY[category].describe(names),
    })),
  ];
  links.forEach((l, i) => {
    const r = TOC_ROW + 1 + i;
    const link = sheet.getCell(r, 1);
    link.value = { text: l.name, hyperlink: `#'${l.name}'!A1` };
    link.font = { bold: true, underline: true, color: { argb: l.color } };
    link.alignment = { vertical: 'middle' };
    sheet.mergeCells(r, 2, r, N);
    const desc = sheet.getCell(r, 2);
    desc.value = l.describe;
    desc.font = { size: 10, color: { argb: MUTED } };
    desc.alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(r).height = 30;
  });

  // ---- Các sheet chi tiết
  if (byDay) writeByDaySheet(wb, result.byDay, names, stamp);
  for (const { category, list } of groups) writeGroupSheet(wb, category, list, names, stamp, byDay);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
