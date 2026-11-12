import ExcelJS from 'exceljs';
import type { TicketCompareResponse } from './ticket-compare.service.js';
import type { PhoneDiff, TicketDetail } from './ticket-compare.util.js';

/** Bảng màu đồng bộ với file xuất vé */
const NAVY = 'FF0F2A5C';
const WHITE = 'FFFFFFFF';
const LINE = 'FFCBD5E1';
const BAND = 'FFF8FAFC';
const MUTED = 'FF64748B';

/** Màu của từng nhóm chênh lệch: nền nhãn, chữ nhãn, nền nhạt của dòng */
const CATEGORY = {
  onlyA: { label: 'Chỉ có ở file A', chip: 'FF2563EB', tint: 'FFEFF6FF' },
  onlyB: { label: 'Chỉ có ở file B', chip: 'FFD97706', tint: 'FFFFFBEB' },
  mismatched: { label: 'Lệch số vé', chip: 'FFDC2626', tint: 'FFFEF2F2' },
} as const;
type Category = keyof typeof CATEGORY;

const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: LINE } } as const;
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

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

/**
 * Báo cáo đối chiếu vé dạng Excel: tiêu đề, khối tổng quan (thẻ số liệu) và bảng chi tiết
 * các SĐT chênh lệch, chia nhóm theo màu (chỉ có ở A / chỉ có ở B / lệch số vé).
 */
export async function buildCompareWorkbook(
  result: TicketCompareResponse,
  names: { a: string; b: string },
  exportedAt: Date = new Date(),
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'XVIP';
  wb.created = exportedAt;
  const sheet = wb.addWorksheet('Đối chiếu vé', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  const COLS = [
    { header: 'STT', width: 7 },
    { header: 'SỐ ĐIỆN THOẠI', width: 16 },
    { header: 'TÊN KHÁCH', width: 24 },
    { header: 'PHÂN LOẠI', width: 18 },
    { header: `VÉ FILE A`, width: 11 },
    { header: `VÉ FILE B`, width: 11 },
    { header: 'CHÊNH LỆCH', width: 12 },
    { header: `CHI TIẾT VÉ FILE A`, width: 46 },
    { header: `CHI TIẾT VÉ FILE B`, width: 46 },
  ];
  const N = COLS.length;
  COLS.forEach((c, i) => (sheet.getColumn(i + 1).width = c.width));

  // ---- Tiêu đề
  sheet.mergeCells(1, 1, 1, N);
  const title = sheet.getCell(1, 1);
  title.value = 'BÁO CÁO ĐỐI CHIẾU VÉ NHÀ XE';
  title.font = { bold: true, size: 16, color: { argb: WHITE } };
  title.fill = solid(NAVY);
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 32;

  sheet.mergeCells(2, 1, 2, N);
  const sub = sheet.getCell(2, 1);
  sub.value = `File A: ${safeText(names.a)}     •     File B: ${safeText(names.b)}     •     Xuất lúc ${vnStamp(exportedAt)}`;
  sub.font = { italic: true, size: 10, color: { argb: MUTED } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // ---- Khối tổng quan: mỗi thẻ gồm nhãn (trên) và con số (dưới), chiếm 1-2 cột
  const totalDiff = result.onlyInA.length + result.onlyInB.length + result.mismatched.length;
  const cards: Array<{ label: string; value: number; color: string; from: number; to: number }> = [
    { label: 'SĐT khớp', value: result.matchedPhones, color: 'FF059669', from: 1, to: 2 },
    { label: 'Chỉ có ở A', value: result.onlyInA.length, color: CATEGORY.onlyA.chip, from: 3, to: 3 },
    { label: 'Chỉ có ở B', value: result.onlyInB.length, color: CATEGORY.onlyB.chip, from: 4, to: 4 },
    { label: 'Lệch số vé', value: result.mismatched.length, color: CATEGORY.mismatched.chip, from: 5, to: 7 },
    { label: `Vé file A (${result.totalPhonesA} SĐT)`, value: result.totalTicketsA, color: NAVY, from: 8, to: 8 },
    { label: `Vé file B (${result.totalPhonesB} SĐT)`, value: result.totalTicketsB, color: NAVY, from: 9, to: 9 },
  ];
  const LABEL_ROW = 4;
  const VALUE_ROW = 5;
  for (const c of cards) {
    if (c.to > c.from) {
      sheet.mergeCells(LABEL_ROW, c.from, LABEL_ROW, c.to);
      sheet.mergeCells(VALUE_ROW, c.from, VALUE_ROW, c.to);
    }
    const label = sheet.getCell(LABEL_ROW, c.from);
    label.value = c.label.toUpperCase();
    label.font = { bold: true, size: 9, color: { argb: WHITE } };
    label.fill = solid(c.color);
    label.alignment = { horizontal: 'center', vertical: 'middle' };
    const value = sheet.getCell(VALUE_ROW, c.from);
    value.value = c.value;
    value.numFmt = '#,##0';
    value.font = { bold: true, size: 18, color: { argb: c.color } };
    value.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = c.from; col <= c.to; col++) {
      sheet.getCell(LABEL_ROW, col).border = { top: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
      sheet.getCell(VALUE_ROW, col).border = { bottom: { style: 'medium', color: { argb: c.color } }, left: thin, right: thin };
      sheet.getCell(VALUE_ROW, col).fill = solid(WHITE);
    }
  }
  sheet.getRow(LABEL_ROW).height = 20;
  sheet.getRow(VALUE_ROW).height = 34;

  const cancelled = result.cancelledCountA + result.cancelledCountB;
  sheet.mergeCells(6, 1, 6, N);
  const note = sheet.getCell(6, 1);
  note.value =
    `Có ${totalDiff} số điện thoại chênh lệch.` +
    (cancelled > 0 ? `  Đã bỏ qua vé hủy: ${result.cancelledCountA} ở file A, ${result.cancelledCountB} ở file B.` : '') +
    '  Chênh lệch = vé file A - vé file B.';
  note.font = { size: 10, color: { argb: MUTED } };
  note.alignment = { vertical: 'middle' };
  sheet.getRow(6).height = 20;

  // ---- Bảng chi tiết
  const HEADER_ROW = 8;
  const header = sheet.getRow(HEADER_ROW);
  COLS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = box;
  });
  header.height = 30;

  const groups: Array<{ category: Category; list: PhoneDiff[] }> = [
    { category: 'mismatched', list: result.mismatched },
    { category: 'onlyA', list: result.onlyInA },
    { category: 'onlyB', list: result.onlyInB },
  ];

  let r = HEADER_ROW + 1;
  let stt = 0;
  for (const { category, list } of groups) {
    if (list.length === 0) continue;
    const meta = CATEGORY[category];

    // Dòng tiêu đề nhóm
    sheet.mergeCells(r, 1, r, N);
    const g = sheet.getCell(r, 1);
    g.value = `${meta.label.toUpperCase()}  (${list.length} SĐT)`;
    g.font = { bold: true, size: 11, color: { argb: WHITE } };
    g.fill = solid(meta.chip);
    g.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(r).height = 22;
    r++;

    list.forEach((d, i) => {
      stt++;
      const row = sheet.getRow(r);
      const values: Array<string | number> = [
        stt,
        d.phone,
        safeText(d.customerName),
        meta.label,
        d.countA,
        d.countB,
        d.delta > 0 ? `+${d.delta}` : String(d.delta),
        safeText(describeTickets(d.ticketsA)) || '—',
        safeText(describeTickets(d.ticketsB)) || '—',
      ];
      const lines = Math.max(1, d.ticketsA.length, d.ticketsB.length);
      values.forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.border = box;
        cell.fill = solid(i % 2 === 0 ? WHITE : BAND);
        cell.font = { size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [0, 4, 5, 6].includes(c) ? 'center' : 'left',
          wrapText: c >= 7,
        };
      });
      // Số điện thoại luôn là chữ để không mất số 0 đầu
      row.getCell(2).numFmt = '@';
      row.getCell(2).font = { size: 10, bold: true };
      const chip = row.getCell(4);
      chip.fill = solid(meta.tint);
      chip.font = { size: 10, bold: true, color: { argb: meta.chip } };
      const delta = row.getCell(7);
      delta.font = { size: 11, bold: true, color: { argb: d.delta > 0 ? CATEGORY.onlyA.chip : CATEGORY.mismatched.chip } };
      delta.fill = solid(meta.tint);
      row.height = Math.max(20, 15 * lines + 4);
      r++;
    });
  }

  if (totalDiff === 0) {
    sheet.mergeCells(r, 1, r, N);
    const ok = sheet.getCell(r, 1);
    ok.value = 'Hai file khớp hoàn toàn, không có số điện thoại nào chênh lệch.';
    ok.font = { bold: true, size: 11, color: { argb: 'FF059669' } };
    ok.fill = solid('FFECFDF5');
    ok.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(r).height = 28;
  }

  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }];
  sheet.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
