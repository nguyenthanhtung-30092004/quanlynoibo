import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildAttendanceWorkbook } from './attendance-export.js';

const cell = (over: Record<string, unknown> = {}) => ({
  minutes: 510,
  cong: 1,
  autoCong: 1,
  overridden: false,
  note: '',
  status: 'done',
  shift: '8h - 17h30',
  // 07:53 và 17:31 giờ Việt Nam
  firstAt: '2026-10-21T00:53:00.000Z',
  lastAt: '2026-10-21T10:31:00.000Z',
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 1,
  overtimeHours: 0,
  shiftStart: 480,
  shiftSource: 'auto',
  alternative: null,
  ...over,
});

const data = {
  month: '2026-10',
  daysInMonth: 31,
  config: { fullMinutes: 480, halfMinutes: 240 },
  shifts: [],
  staff: [
    {
      id: 1,
      fullName: 'Nguyễn Văn A',
      isActive: true,
      defaultShift: null,
      days: {
        '2026-10-21': cell(),
        '2026-10-22': cell({ status: 'missing_out', cong: 0, minutes: 0, shift: null, lastAt: null }),
        '2026-10-23': cell({ overridden: true, cong: 0.5, note: 'Mất mạng', lateMinutes: 5 }),
        // vào muộn 10 phút (bị trừ tiền), ở lại 154 phút được 2,5 giờ tăng ca, ca chưa chắc
        '2026-10-24': cell({
          lateMinutes: 10,
          overtimeMinutes: 154,
          overtimeHours: 2.5,
          alternative: { shiftStart: 420, shift: '7h - 16h30', overtimeHours: 3 },
        }),
      },
      totalCong: 2.5,
      totalOvertimeHours: 2.5,
    },
  ],
} as never;

const pay = { latePenaltyPerMinute: 25_000, overtimePerHour: 25_000, standardDaysOffset: 4 };

/** Giá trị ô dạng văn bản, kể cả ô nhiều dòng (rich text) */
const textOf = (value: ExcelJS.CellValue): string =>
  value !== null && typeof value === 'object' && 'richText' in value
    ? value.richText.map((r) => r.text).join('')
    : String(value);

const load = async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await buildAttendanceWorkbook(data, pay)) as never);
  return wb;
};

describe('buildAttendanceWorkbook', () => {
  it('có đủ 4 sheet', async () => {
    const wb = await load();
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Bảng công', 'Tổng hợp', 'Chi tiết', 'Quy tắc']);
  });

  it('sheet Bảng công đúng số liệu, có phút muộn và tiền', async () => {
    const grid = (await load()).getWorksheet('Bảng công')!;
    expect(grid.getRow(3).getCell(2).value).toBe('NHÂN VIÊN');
    const row = grid.getRow(4);
    expect(row.getCell(2).value).toBe('Nguyễn Văn A');
    // mỗi ô ba dòng: công, giờ vào, giờ ra
    expect(textOf(row.getCell(2 + 21).value)).toBe('1\n07:53\n17:31'); // ngày 21
    expect(textOf(row.getCell(2 + 22).value)).toBe('?\n07:53'); // quên quẹt ra, chưa có giờ ra
    expect(textOf(row.getCell(2 + 23).value)).toBe('0.5\n07:53\n17:31'); // chỉnh tay
    expect(row.getCell(31 + 3).value).toBe(2.5); // tổng công
    expect(row.getCell(31 + 4).value).toBe(2.5); // tăng ca (giờ)
    expect(row.getCell(31 + 5).value).toBe(15); // phút muộn (10 + 5 của ngày Admin chỉnh tay)
    expect(row.getCell(31 + 6).value).toBe(250_000); // trừ muộn: 10 phút × 25.000
    expect(row.getCell(31 + 7).value).toBe(62_500); // tăng ca: 2,5 giờ × 25.000
    expect(String(row.getCell(2 + 24).note)).toContain('Vào muộn 10 phút');
  });

  it('sheet Tổng hợp cộng đúng từng người và có dòng tổng', async () => {
    const sheet = (await load()).getWorksheet('Tổng hợp')!;
    const row = sheet.getRow(4);
    expect(row.getCell(2).value).toBe('Nguyễn Văn A');
    expect(row.getCell(4).value).toBe(27); // công chuẩn tháng 31 ngày
    expect(row.getCell(5).value).toBe(2.5); // tổng công
    expect(row.getCell(9).value).toBe(1); // 1 ngày quên quẹt ra
    expect(row.getCell(10).value).toBe(1); // 1 ngày Admin chỉnh
    expect(row.getCell(12).value).toBe(15); // tổng phút muộn
    expect(row.getCell(13).value).toBe(10); // chỉ 10 phút bị trừ tiền, 5 phút của ngày Admin chỉnh tay thì không
    expect(row.getCell(14).value).toBe(250_000);
    expect(row.getCell(18).value).toBe(2.5); // giờ tăng ca
    expect(row.getCell(19).value).toBe(62_500);
    expect(row.getCell(20).value).toBe(62_500 - 250_000);
    expect(row.getCell(21).value).toBe(1); // 1 ngày cần xem lại ca
    expect(sheet.getRow(5).getCell(2).value).toBe('TỔNG CỘNG');
    expect(sheet.getRow(5).getCell(14).value).toBe(250_000);
  });

  it('sheet Chi tiết có nguồn ca, ở lại, tiền và cảnh báo', async () => {
    const detail = (await load()).getWorksheet('Chi tiết')!;
    const first = detail.getRow(4);
    expect(first.getCell(4).value).toBe('8h - 17h30');
    expect(first.getCell(5).value).toBe('Tự đoán');
    expect(first.getCell(6).value).toBe('07:53');
    expect(first.getCell(7).value).toBe('17:31');
    expect(detail.getRow(5).getCell(18).value).toContain('Quên quẹt ra');
    expect(detail.getRow(6).getCell(20).value).toBe('Admin chỉnh tay: Mất mạng');
    expect(detail.getRow(6).getCell(16).value).toBe(1); // công tự tính
    expect(detail.getRow(6).getCell(17).value).toBe(0.5); // công chốt
    const late = detail.getRow(7);
    expect(late.getCell(10).value).toBe(10); // phút muộn bị trừ tiền
    expect(late.getCell(11).value).toBe(250_000);
    expect(late.getCell(13).value).toBe('2 giờ 34 phút'); // ở lại sau ca
    expect(late.getCell(15).value).toBe(62_500);
    expect(late.getCell(19).value).toContain('7h - 16h30');
  });

  it('ngày Admin chỉnh tay không bị trừ tiền muộn', async () => {
    const detail = (await load()).getWorksheet('Chi tiết')!;
    expect(detail.getRow(6).getCell(9).value).toBe(5); // vẫn ghi phút muộn
    expect(detail.getRow(6).getCell(10).value).toBe(0); // nhưng không trừ tiền
    expect(detail.getRow(6).getCell(11).value).toBe(0);
  });
});
