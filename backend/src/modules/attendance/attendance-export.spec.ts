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
        '2026-10-23': cell({ overridden: true, cong: 0.5, note: 'Mất mạng' }),
      },
      totalCong: 1.5,
      totalOvertimeHours: 0,
    },
  ],
} as never;

describe('buildAttendanceWorkbook', () => {
  it('có sheet Bảng công và Chi tiết với đúng số liệu', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildAttendanceWorkbook(data)) as never);

    const grid = wb.getWorksheet('Bảng công')!;
    expect(grid.getRow(3).getCell(2).value).toBe('NHÂN VIÊN');
    const row = grid.getRow(4);
    expect(row.getCell(2).value).toBe('Nguyễn Văn A');
    expect(row.getCell(2 + 21).value).toBe(1); // ngày 21
    expect(row.getCell(2 + 22).value).toBe('?'); // quên quẹt ra
    expect(row.getCell(2 + 23).value).toBe(0.5); // chỉnh tay
    expect(row.getCell(31 + 3).value).toBe(1.5); // tổng công

    const detail = wb.getWorksheet('Chi tiết')!;
    const first = detail.getRow(4);
    expect(first.getCell(3).value).toBe('8h - 17h30');
    expect(first.getCell(4).value).toBe('07:53');
    expect(first.getCell(5).value).toBe('17:31');
    expect(detail.getRow(5).getCell(10).value).toContain('Quên quẹt ra');
    expect(detail.getRow(6).getCell(11).value).toBe('Admin chỉnh tay: Mất mạng');
  });
});
