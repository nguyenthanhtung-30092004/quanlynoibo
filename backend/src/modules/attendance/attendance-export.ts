import ExcelJS from 'exceljs';
import { neutralizeFormula } from '../orders/mappers/order.mapper.js';
import { vietnamClock } from './attendance.logic.js';
import type { AttendanceService } from './attendance.service.js';

type MonthData = Awaited<ReturnType<AttendanceService['month']>>;
type DayCell = MonthData['staff'][number]['days'][string];

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const XLSX_FILL = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;
const THIN = { style: 'thin', color: { argb: 'FFCBD5E1' } } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const STATUS_TEXT: Record<DayCell['status'], string> = {
  not_in: 'Chưa quẹt',
  working: 'Đang làm',
  auto_out: 'Quên quẹt ra (tự chấm 23:59)',
  missing_out: 'Quên quẹt ra',
  done: 'Đủ lượt vào ra',
};

const timeText = (iso: string | null) => {
  if (!iso) return '';
  const m = vietnamClock(new Date(iso)).minuteOfDay;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Quên quẹt ra và chưa được Admin chỉnh tay: hiện "?" trong bảng công như trên màn hình */
const noOut = (c: DayCell) => (c.status === 'missing_out' || c.status === 'auto_out') && !c.overridden;

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
  row.height = 32;
}

/** Xuất bảng chấm công một tháng: sheet "Bảng công" (như trên màn hình) và sheet "Chi tiết" (từng ngày) */
export async function buildAttendanceWorkbook(data: MonthData): Promise<Buffer> {
  const [year, month] = data.month.split('-').map(Number);
  const subtitle = `Tháng ${String(month).padStart(2, '0')}/${year}  •  Dấu ? là quên quẹt ra, chưa tính công`;
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // Sheet 1: mỗi nhân viên một dòng, mỗi ngày một cột
  const days = Array.from({ length: data.daysInMonth }, (_, i) => {
    const d = i + 1;
    return { d, key: `${data.month}-${String(d).padStart(2, '0')}`, weekday: new Date(Date.UTC(year, month - 1, d)).getUTCDay() };
  });
  const totalCols = days.length + 4;
  const grid = workbook.addWorksheet('Bảng công', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3, showGridLines: false }],
  });
  addTitle(grid, 'BẢNG CHẤM CÔNG', subtitle, totalCols);
  grid.getColumn(1).width = 7;
  grid.getColumn(2).width = 28;
  days.forEach((_, i) => (grid.getColumn(3 + i).width = 6));
  grid.getColumn(days.length + 3).width = 12;
  grid.getColumn(days.length + 4).width = 14;

  const head = grid.getRow(3);
  head.getCell(1).value = 'STT';
  head.getCell(2).value = 'NHÂN VIÊN';
  days.forEach((d, i) => (head.getCell(3 + i).value = `${d.d}\n${WEEKDAY[d.weekday]}`));
  head.getCell(days.length + 3).value = 'TỔNG CÔNG';
  head.getCell(days.length + 4).value = 'TĂNG CA (GIỜ)';
  const headFills: Record<number, string> = {};
  days.forEach((d, i) => {
    if (d.weekday === 0) headFills[3 + i] = 'FFE11D48';
  });
  styleHeader(head, totalCols, headFills);

  data.staff.forEach((s, idx) => {
    const row = grid.getRow(4 + idx);
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = neutralizeFormula(s.fullName);
    days.forEach((d, i) => {
      const cell = row.getCell(3 + i);
      const c = s.days[d.key];
      if (c && (c.cong > 0 || c.minutes > 0 || c.overridden)) {
        cell.value = c.cong;
        if (c.cong > 0) cell.fill = XLSX_FILL('FFD1FAE5');
        if (c.overridden) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
      } else if (c && noOut(c)) {
        cell.value = '?';
        cell.fill = XLSX_FILL('FFFEF3C7');
      }
    });
    row.getCell(days.length + 3).value = s.totalCong;
    row.getCell(days.length + 4).value = s.totalOvertimeHours;
    for (let i = 1; i <= totalCols; i++) {
      const cell = row.getCell(i);
      cell.border = BORDER;
      cell.alignment = { horizontal: i === 2 ? 'left' : 'center', vertical: 'middle' };
      if (i >= days.length + 3) {
        cell.numFmt = '0.0#';
        cell.font = { bold: true };
      }
    }
    row.height = 22;
  });

  // Sheet 2: từng ngày có dữ liệu
  const cols = [
    { header: 'NGÀY', width: 12 },
    { header: 'NHÂN VIÊN', width: 28 },
    { header: 'CA', width: 14 },
    { header: 'GIỜ VÀO', width: 10 },
    { header: 'GIỜ RA', width: 10 },
    { header: 'VÀO MUỘN (PHÚT)', width: 12 },
    { header: 'RA SỚM (PHÚT)', width: 12 },
    { header: 'TĂNG CA (GIỜ)', width: 12 },
    { header: 'CÔNG', width: 8 },
    { header: 'TRẠNG THÁI', width: 30 },
    { header: 'GHI CHÚ', width: 40 },
  ];
  const detail = workbook.addWorksheet('Chi tiết', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  });
  addTitle(detail, 'CHI TIẾT CHẤM CÔNG THEO NGÀY', subtitle, cols.length);
  cols.forEach((c, i) => (detail.getColumn(i + 1).width = c.width));
  const dhead = detail.getRow(3);
  cols.forEach((c, i) => (dhead.getCell(i + 1).value = c.header));
  styleHeader(dhead, cols.length);

  let r = 4;
  for (const s of data.staff) {
    for (const [day, c] of Object.entries(s.days).sort(([a], [b]) => a.localeCompare(b))) {
      const [y, m, d] = day.split('-').map(Number);
      const row = detail.getRow(r++);
      const note = [c.overridden ? 'Admin chỉnh tay' : '', c.note].filter(Boolean).join(': ');
      const values: Array<string | number | Date> = [
        new Date(Date.UTC(y, m - 1, d)),
        neutralizeFormula(s.fullName),
        c.shift ?? '',
        timeText(c.firstAt),
        timeText(c.lastAt),
        c.lateMinutes,
        c.earlyLeaveMinutes,
        c.overtimeHours,
        c.cong,
        STATUS_TEXT[c.status],
        neutralizeFormula(note),
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.border = BORDER;
        cell.alignment = { horizontal: i === 1 || i >= 9 ? 'left' : 'center', vertical: 'middle' };
      });
      row.getCell(1).numFmt = 'dd/mm/yyyy';
      row.getCell(8).numFmt = '0.0#';
      row.getCell(9).numFmt = '0.0#';
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
