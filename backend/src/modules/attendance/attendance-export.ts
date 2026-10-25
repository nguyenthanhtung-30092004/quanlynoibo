import ExcelJS from 'exceljs';
import { neutralizeFormula } from '../orders/mappers/order.mapper.js';
import { DEFAULT_PAYROLL_CONFIG, type PayrollConfig } from '../payroll/payroll.config.js';
import {
  LATE_KEEP_FULL_CONG_MINUTES,
  OVERTIME_MAX_HOURS,
  OVERTIME_MIN_MINUTES,
  vietnamClock,
} from './attendance.logic.js';
import type { AttendanceService } from './attendance.service.js';

type MonthData = Awaited<ReturnType<AttendanceService['month']>>;
type DayCell = MonthData['staff'][number]['days'][string];
type Pay = Pick<PayrollConfig, 'latePenaltyPerMinute' | 'overtimePerHour' | 'standardDaysOffset'>;

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const XLSX_FILL = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;
const THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const MONEY_FMT = '#,##0';
const NUM_FMT = '0.0#';

const STATUS_TEXT: Record<DayCell['status'], string> = {
  not_in: 'Chưa quẹt',
  working: 'Đang làm',
  auto_out: 'Quên quẹt ra (tự chấm 23:59)',
  missing_out: 'Quên quẹt ra',
  done: 'Đủ lượt vào ra',
};

const SOURCE_TEXT = { auto: 'Tự đoán', default: 'Ca mặc định của nhân viên', forced: 'Admin chọn' } as const;

const timeText = (iso: string | null) => {
  if (!iso) return '';
  const m = vietnamClock(new Date(iso)).minuteOfDay;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** 154 -> "2 giờ 34 phút", 120 -> "2 giờ", 45 -> "45 phút" */
const durationText = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
};

const dayText = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

/** Quên quẹt ra và chưa được Admin chỉnh tay: hiện "?" trong bảng công như trên màn hình */
const noOut = (c: DayCell) => (c.status === 'missing_out' || c.status === 'auto_out') && !c.overridden;

/**
 * Số phút vào muộn bị trừ tiền của một ngày: chỉ ngày muộn dưới ngưỡng, đã đủ lượt vào ra và chưa bị Admin chỉnh tay
 * (muộn từ ngưỡng trở lên đã bị trừ công nên không trừ tiền nữa). Cùng quy tắc với `monthLateMinutes` ở bảng lương.
 */
const lateChargeMinutes = (c: DayCell) =>
  c.status === 'done' && !c.overridden && c.lateMinutes > 0 && c.lateMinutes < LATE_KEEP_FULL_CONG_MINUTES
    ? c.lateMinutes
    : 0;

/** Nhãn cách hiểu ca khác mà Admin cần xem lại; rỗng nếu không mập mờ */
const reviewText = (c: DayCell) =>
  c.alternative ? `Chưa chắc ca: nếu là ca ${c.alternative.shift} thì tăng ca ${c.alternative.overtimeHours} giờ` : '';

const TIME_FONT = { size: 9, color: { argb: 'FF475569' } };

/** Nội dung ô của bảng công gồm 3 dòng: số công (to, đậm), giờ vào, giờ ra (nhỏ); quên quẹt ra thì chỉ có giờ vào */
function dayCellValue(label: string | number, c: DayCell, color: string): ExcelJS.CellRichTextValue {
  return {
    richText: [
      { text: String(label), font: { bold: true, size: 12, color: { argb: color } } },
      ...(c.firstAt ? [{ text: `\n${timeText(c.firstAt)}`, font: TIME_FONT }] : []),
      ...(c.lastAt ? [{ text: `\n${timeText(c.lastAt)}`, font: TIME_FONT }] : []),
    ],
  };
}

/** Ghi chú hiện khi rê chuột vào ô của bảng công */
function cellNote(c: DayCell): string {
  const lines: string[] = [];
  if (c.shift) lines.push(`Ca ${c.shift}${c.shiftSource ? ` (${SOURCE_TEXT[c.shiftSource]})` : ''}`);
  if (c.firstAt) lines.push(`Vào ${timeText(c.firstAt)}${c.lastAt ? `, ra ${timeText(c.lastAt)}` : ', chưa quẹt ra'}`);
  if (c.lateMinutes > 0) lines.push(`Vào muộn ${durationText(c.lateMinutes)}`);
  if (c.earlyLeaveMinutes > 0 && c.lastAt) lines.push(`Ra sớm ${durationText(c.earlyLeaveMinutes)}`);
  if (c.overtimeMinutes > 0) lines.push(`Ở lại sau ca ${durationText(c.overtimeMinutes)}, tăng ca ${c.overtimeHours} giờ`);
  lines.push(c.overridden ? `Công ${c.cong} (Admin chỉnh tay, tự tính ${c.autoCong})` : `Công ${c.cong}`);
  if (c.note) lines.push(`Ghi chú: ${c.note}`);
  const review = reviewText(c);
  if (review) lines.push(review);
  return lines.join('\n');
}

interface Summary {
  present: number;
  full: number;
  half: number;
  missingOut: number;
  overridden: number;
  lateTimes: number;
  lateTotal: number;
  lateCharge: number;
  latePenalty: number;
  earlyTimes: number;
  earlyTotal: number;
  overtimeDays: number;
  overtimeHours: number;
  overtimePay: number;
  review: number;
}

function summarize(days: DayCell[], pay: Pay): Summary {
  const s: Summary = {
    present: 0,
    full: 0,
    half: 0,
    missingOut: 0,
    overridden: 0,
    lateTimes: 0,
    lateTotal: 0,
    lateCharge: 0,
    latePenalty: 0,
    earlyTimes: 0,
    earlyTotal: 0,
    overtimeDays: 0,
    overtimeHours: 0,
    overtimePay: 0,
    review: 0,
  };
  for (const c of days) {
    if (c.status === 'done') {
      s.present++;
      if (c.lateMinutes > 0) {
        s.lateTimes++;
        s.lateTotal += c.lateMinutes;
      }
      if (c.earlyLeaveMinutes > 0) {
        s.earlyTimes++;
        s.earlyTotal += c.earlyLeaveMinutes;
      }
    }
    if (c.cong >= 1) s.full++;
    else if (c.cong > 0) s.half++;
    if (c.status === 'missing_out' || c.status === 'auto_out') s.missingOut++;
    if (c.overridden) s.overridden++;
    s.lateCharge += lateChargeMinutes(c);
    if (c.overtimeHours > 0) {
      s.overtimeDays++;
      s.overtimeHours += c.overtimeHours;
    }
    if (c.alternative) s.review++;
  }
  s.latePenalty = s.lateCharge * Math.max(0, pay.latePenaltyPerMinute);
  s.overtimePay = Math.round(s.overtimeHours * Math.max(0, pay.overtimePerHour));
  return s;
}

function addTitle(sheet: ExcelJS.Worksheet, text: string, subtitle: string, width: number) {
  sheet.mergeCells(1, 1, 1, width);
  const title = sheet.getCell(1, 1);
  title.value = text;
  title.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = XLSX_FILL('FF0F2A5C');
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, width);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  sheet.getRow(2).height = 22;
}

function styleHeader(row: ExcelJS.Row, count: number, fills: Record<number, string> = {}) {
  for (let i = 1; i <= count; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = XLSX_FILL(fills[i] ?? 'FF2563EB');
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  }
  row.height = 40;
}

interface Col {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  fmt?: string;
}

/**
 * Xuất bảng chấm công một tháng gồm 4 sheet: "Bảng công" (như trên màn hình), "Tổng hợp" (mỗi người một dòng, có tiền),
 * "Chi tiết" (từng ngày) và "Quy tắc" (cách tính). Tiền trừ vào muộn và tiền tăng ca tính theo cấu hình lương hiện tại.
 */
export async function buildAttendanceWorkbook(
  data: MonthData,
  payroll: Pay = DEFAULT_PAYROLL_CONFIG,
): Promise<Buffer> {
  const [year, month] = data.month.split('-').map(Number);
  const monthText = `Tháng ${String(month).padStart(2, '0')}/${year}`;
  const subtitle = `${monthText}  •  Mỗi ô ghi công, giờ vào, giờ ra  •  Dấu ? là quên quẹt ra, chưa tính công  •  Ô đỏ là vào muộn  •  Rê chuột vào ô để xem muộn, tăng ca`;
  const shiftLabel = (startMinute: number | null) =>
    startMinute == null ? '' : (data.shifts.find((sh) => sh.startMinute === startMinute)?.label ?? '');
  const standard = Math.max(1, data.daysInMonth - payroll.standardDaysOffset);
  const summaries = new Map(data.staff.map((s) => [s.id, summarize(Object.values(s.days), payroll)]));

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // Sheet 1: mỗi nhân viên một dòng, mỗi ngày một cột
  const days = Array.from({ length: data.daysInMonth }, (_, i) => {
    const d = i + 1;
    return { d, key: `${data.month}-${String(d).padStart(2, '0')}`, weekday: new Date(Date.UTC(year, month - 1, d)).getUTCDay() };
  });
  const extraHeads = ['TỔNG CÔNG', 'TĂNG CA (GIỜ)', 'PHÚT MUỘN', 'TRỪ VÀO MUỘN (ĐỒNG)', 'TIỀN TĂNG CA (ĐỒNG)'];
  const totalCols = days.length + 2 + extraHeads.length;
  const grid = workbook.addWorksheet('Bảng công', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3, showGridLines: false }],
  });
  addTitle(grid, 'BẢNG CHẤM CÔNG', subtitle, totalCols);
  grid.getColumn(1).width = 7;
  grid.getColumn(2).width = 28;
  days.forEach((_, i) => (grid.getColumn(3 + i).width = 8));
  extraHeads.forEach((_, i) => (grid.getColumn(days.length + 3 + i).width = i < 2 ? 13 : 16));

  const head = grid.getRow(3);
  head.getCell(1).value = 'STT';
  head.getCell(2).value = 'NHÂN VIÊN';
  days.forEach((d, i) => (head.getCell(3 + i).value = `${d.d}\n${WEEKDAY[d.weekday]}`));
  extraHeads.forEach((h, i) => (head.getCell(days.length + 3 + i).value = h));
  const headFills: Record<number, string> = {};
  days.forEach((d, i) => {
    if (d.weekday === 0) headFills[3 + i] = 'FFE11D48';
  });
  styleHeader(head, totalCols, headFills);

  data.staff.forEach((s, idx) => {
    const sum = summaries.get(s.id)!;
    const row = grid.getRow(4 + idx);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = neutralizeFormula(s.fullName);
    days.forEach((d, i) => {
      const cell = row.getCell(3 + i);
      const c = s.days[d.key];
      if (c && (c.cong > 0 || c.minutes > 0 || c.overridden)) {
        cell.value = dayCellValue(c.cong, c, c.overridden ? 'FF1D4ED8' : 'FF0F172A');
        if (c.cong > 0) cell.fill = XLSX_FILL('FFD1FAE5');
        if (c.lateMinutes > 0 && c.status === 'done') cell.fill = XLSX_FILL('FFFECACA');
        cell.note = cellNote(c);
      } else if (c && noOut(c)) {
        cell.value = dayCellValue('?', c, 'FF0F172A');
        cell.fill = XLSX_FILL('FFFEF3C7');
        cell.note = cellNote(c);
      }
    });
    const base = days.length + 3;
    row.getCell(base).value = s.totalCong;
    row.getCell(base + 1).value = s.totalOvertimeHours;
    row.getCell(base + 2).value = sum.lateTotal;
    row.getCell(base + 3).value = sum.latePenalty;
    row.getCell(base + 4).value = sum.overtimePay;
    for (let i = 1; i <= totalCols; i++) {
      const cell = row.getCell(i);
      cell.border = BORDER;
      cell.alignment = { horizontal: i === 2 ? 'left' : 'center', vertical: 'middle', wrapText: i > 2 && i < base };
      if (i >= base) {
        cell.numFmt = i >= base + 3 ? MONEY_FMT : NUM_FMT;
        cell.font = { bold: true };
      }
    }
    row.height = 50; // đủ cho 3 dòng trong ô: công, giờ vào, giờ ra
  });

  // Sheet 2: tổng hợp từng người trong tháng
  const sumCols: Col[] = [
    { header: 'STT', width: 6, align: 'center' },
    { header: 'NHÂN VIÊN', width: 28, align: 'left' },
    { header: 'CA MẶC ĐỊNH', width: 14, align: 'center' },
    { header: 'CÔNG CHUẨN', width: 10, align: 'center' },
    { header: 'TỔNG CÔNG', width: 10, align: 'center', fmt: NUM_FMT },
    { header: 'NGÀY CÓ MẶT', width: 10, align: 'center' },
    { header: 'NGÀY ĐỦ 1 CÔNG', width: 10, align: 'center' },
    { header: 'NGÀY NỬA CÔNG', width: 10, align: 'center' },
    { header: 'NGÀY QUÊN QUẸT RA', width: 12, align: 'center' },
    { header: 'NGÀY ADMIN CHỈNH CÔNG', width: 12, align: 'center' },
    { header: 'SỐ LẦN VÀO MUỘN', width: 10, align: 'center' },
    { header: 'TỔNG PHÚT MUỘN', width: 10, align: 'center' },
    { header: 'PHÚT MUỘN BỊ TRỪ TIỀN', width: 12, align: 'center' },
    { header: 'TRỪ VÀO MUỘN (ĐỒNG)', width: 16, align: 'right', fmt: MONEY_FMT },
    { header: 'SỐ LẦN RA SỚM', width: 10, align: 'center' },
    { header: 'TỔNG PHÚT RA SỚM', width: 10, align: 'center' },
    { header: 'NGÀY TĂNG CA', width: 10, align: 'center' },
    { header: 'TĂNG CA (GIỜ)', width: 10, align: 'center', fmt: NUM_FMT },
    { header: 'TIỀN TĂNG CA (ĐỒNG)', width: 16, align: 'right', fmt: MONEY_FMT },
    { header: 'TĂNG CA − TRỪ MUỘN (ĐỒNG)', width: 18, align: 'right', fmt: MONEY_FMT },
    { header: 'NGÀY CẦN XEM LẠI CA', width: 12, align: 'center' },
  ];
  const summary = workbook.addWorksheet('Tổng hợp', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3, showGridLines: false }],
  });
  addTitle(
    summary,
    'TỔNG HỢP CHẤM CÔNG THEO NHÂN VIÊN',
    `${monthText}  •  Công chuẩn ${standard}  •  Vào muộn trừ ${payroll.latePenaltyPerMinute.toLocaleString('vi-VN')}đ/phút  •  Tăng ca ${payroll.overtimePerHour.toLocaleString('vi-VN')}đ/giờ`,
    sumCols.length,
  );
  sumCols.forEach((c, i) => (summary.getColumn(i + 1).width = c.width));
  const shead = summary.getRow(3);
  sumCols.forEach((c, i) => (shead.getCell(i + 1).value = c.header));
  styleHeader(shead, sumCols.length);

  const totals = new Array<number>(sumCols.length).fill(0);
  data.staff.forEach((s, idx) => {
    const m = summaries.get(s.id)!;
    const values: Array<string | number> = [
      idx + 1,
      neutralizeFormula(s.fullName),
      shiftLabel(s.defaultShift),
      standard,
      s.totalCong,
      m.present,
      m.full,
      m.half,
      m.missingOut,
      m.overridden,
      m.lateTimes,
      m.lateTotal,
      m.lateCharge,
      m.latePenalty,
      m.earlyTimes,
      m.earlyTotal,
      m.overtimeDays,
      m.overtimeHours,
      m.overtimePay,
      m.overtimePay - m.latePenalty,
      m.review,
    ];
    const row = summary.getRow(4 + idx);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.border = BORDER;
      cell.alignment = { horizontal: sumCols[i].align ?? 'center', vertical: 'middle' };
      if (sumCols[i].fmt) cell.numFmt = sumCols[i].fmt!;
      if (typeof v === 'number' && i >= 4) totals[i] += v;
    });
    if (m.review > 0) row.getCell(sumCols.length).fill = XLSX_FILL('FFFEF3C7');
    if (m.latePenalty > 0) row.getCell(14).font = { bold: true, color: { argb: 'FFB91C1C' } };
    row.height = 22;
  });
  const totalRow = summary.getRow(4 + data.staff.length);
  totalRow.getCell(2).value = 'TỔNG CỘNG';
  sumCols.forEach((c, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i >= 4) cell.value = totals[i];
    cell.font = { bold: true };
    cell.fill = XLSX_FILL('FFE2E8F0');
    cell.border = BORDER;
    cell.alignment = { horizontal: i === 1 ? 'left' : (c.align ?? 'center'), vertical: 'middle' };
    if (c.fmt) cell.numFmt = c.fmt;
  });
  totalRow.height = 24;

  // Sheet 3: từng ngày có dữ liệu
  const cols: Col[] = [
    { header: 'NGÀY', width: 12, align: 'center', fmt: 'dd/mm/yyyy' },
    { header: 'THỨ', width: 6, align: 'center' },
    { header: 'NHÂN VIÊN', width: 28, align: 'left' },
    { header: 'CA', width: 14, align: 'center' },
    { header: 'CA DO AI XÁC ĐỊNH', width: 20, align: 'center' },
    { header: 'GIỜ VÀO', width: 10, align: 'center' },
    { header: 'GIỜ RA', width: 10, align: 'center' },
    { header: 'PHÚT TÍNH TRONG CA', width: 11, align: 'center' },
    { header: 'VÀO MUỘN (PHÚT)', width: 11, align: 'center' },
    { header: 'PHÚT MUỘN BỊ TRỪ TIỀN', width: 12, align: 'center' },
    { header: 'TRỪ VÀO MUỘN (ĐỒNG)', width: 14, align: 'right', fmt: MONEY_FMT },
    { header: 'RA SỚM (PHÚT)', width: 10, align: 'center' },
    { header: 'Ở LẠI SAU CA', width: 16, align: 'center' },
    { header: 'TĂNG CA (GIỜ)', width: 10, align: 'center', fmt: NUM_FMT },
    { header: 'TIỀN TĂNG CA (ĐỒNG)', width: 14, align: 'right', fmt: MONEY_FMT },
    { header: 'CÔNG TỰ TÍNH', width: 10, align: 'center', fmt: NUM_FMT },
    { header: 'CÔNG CHỐT', width: 10, align: 'center', fmt: NUM_FMT },
    { header: 'TRẠNG THÁI', width: 30, align: 'left' },
    { header: 'CẢNH BÁO CA', width: 42, align: 'left' },
    { header: 'GHI CHÚ', width: 40, align: 'left' },
  ];
  const detail = workbook.addWorksheet('Chi tiết', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 3, showGridLines: false }],
  });
  addTitle(detail, 'CHI TIẾT CHẤM CÔNG THEO NGÀY', `${monthText}  •  Mỗi dòng là một ngày có dữ liệu của một nhân viên`, cols.length);
  cols.forEach((c, i) => (detail.getColumn(i + 1).width = c.width));
  const dhead = detail.getRow(3);
  cols.forEach((c, i) => (dhead.getCell(i + 1).value = c.header));
  styleHeader(dhead, cols.length);

  let r = 4;
  for (const s of data.staff) {
    for (const [day, c] of Object.entries(s.days).sort(([a], [b]) => a.localeCompare(b))) {
      const { y, m, d, weekday } = dayText(day);
      const row = detail.getRow(r++);
      const note = [c.overridden ? 'Admin chỉnh tay' : '', c.note].filter(Boolean).join(': ');
      const lateCharge = lateChargeMinutes(c);
      const values: Array<string | number | Date> = [
        new Date(Date.UTC(y, m - 1, d)),
        WEEKDAY[weekday],
        neutralizeFormula(s.fullName),
        c.shift ?? '',
        c.shiftSource ? SOURCE_TEXT[c.shiftSource] : '',
        timeText(c.firstAt),
        timeText(c.lastAt),
        c.minutes,
        c.lateMinutes,
        lateCharge,
        lateCharge * Math.max(0, payroll.latePenaltyPerMinute),
        c.earlyLeaveMinutes,
        c.overtimeMinutes > 0 ? durationText(c.overtimeMinutes) : '',
        c.overtimeHours,
        Math.round(c.overtimeHours * Math.max(0, payroll.overtimePerHour)),
        c.autoCong,
        c.cong,
        STATUS_TEXT[c.status],
        reviewText(c),
        neutralizeFormula(note),
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.border = BORDER;
        cell.alignment = { horizontal: cols[i].align ?? 'center', vertical: 'middle', wrapText: i >= 17 };
        if (cols[i].fmt) cell.numFmt = cols[i].fmt!;
      });
      if (weekday === 0) row.getCell(2).font = { bold: true, color: { argb: 'FFE11D48' } };
      if (c.lateMinutes > 0 && c.status === 'done') row.getCell(9).font = { bold: true, color: { argb: 'FFB91C1C' } };
      if (c.overridden) row.getCell(17).font = { bold: true, color: { argb: 'FF1D4ED8' } };
      if (c.alternative) row.getCell(19).fill = XLSX_FILL('FFFEF3C7');
    }
  }

  // Sheet 4: quy tắc tính, để ai mở file cũng đối chiếu được
  const rules = workbook.addWorksheet('Quy tắc', { views: [{ showGridLines: false }] });
  rules.getColumn(1).width = 28;
  rules.getColumn(2).width = 110;
  addTitle(rules, 'QUY TẮC TÍNH CÔNG', monthText, 2);
  const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
  const ruleRows: Array<[string, string]> = [
    ['Lượt quẹt', 'Giờ vào là lượt quẹt đầu tiên trong ngày, giờ ra là lượt quẹt cuối cùng. Quẹt lại trong 2 phút bị coi là quẹt trùng và bỏ qua.'],
    ['Quên quẹt ra', 'Ngày chỉ có một lượt quẹt thì đến 23:59 hệ thống tự chấm ra và ngày đó không tính công (Admin vẫn chỉnh tay được).'],
    ['Ca làm việc', 'Ưu tiên: Admin chọn tay cho ngày đó, rồi ca mặc định của nhân viên, rồi tự đoán từ giờ vào và giờ ra. Cột "Cảnh báo ca" cho biết ngày nào hệ thống chưa chắc ca và số giờ tăng ca sẽ khác nếu chọn ca kia.'],
    ['Công mỗi ngày', 'Chỉ tính phần giờ nằm trong ca, không trừ nghỉ trưa. Đủ cả ca là 1 công, có mặt từ nửa ca là 0,5 công, ít hơn là 0. Mỗi ngày tối đa 1 công.'],
    ['Vào muộn', `Vào muộn dưới ${LATE_KEEP_FULL_CONG_MINUTES} phút: vẫn đủ công như vào đúng giờ nhưng bị trừ ${money(payroll.latePenaltyPerMinute)} mỗi phút muộn. Từ ${LATE_KEEP_FULL_CONG_MINUTES} phút trở lên: công tính theo số giờ thực có mặt và không trừ tiền nữa.`],
    ['Ra sớm', 'Chỉ để theo dõi và làm giảm công khi ở lại ít hơn một ca; không trừ tiền riêng.'],
    ['Tăng ca', `Ở lại sau giờ kết thúc ca từ ${OVERTIME_MIN_MINUTES} phút mới tính. Làm tròn xuống theo mốc 0,5 giờ, tối đa ${OVERTIME_MAX_HOURS} giờ mỗi ngày, ${money(payroll.overtimePerHour)} mỗi giờ.`],
    ['Ngày Admin chỉnh tay', 'Số công do Admin nhập thay cho số tự tính (cột "Công chốt" so với "Công tự tính"), và phút muộn của ngày đó không bị trừ tiền. Tăng ca của ngày đó vẫn được tính.'],
    ['Công chuẩn', `Số ngày trong tháng trừ ${payroll.standardDaysOffset}, tháng này là ${standard}.`],
  ];
  ruleRows.forEach(([name, text], i) => {
    const row = rules.getRow(3 + i);
    row.getCell(1).value = name;
    row.getCell(2).value = text;
    row.getCell(1).font = { bold: true };
    for (const col of [1, 2]) {
      const cell = row.getCell(col);
      cell.border = BORDER;
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    }
    row.height = 44;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
