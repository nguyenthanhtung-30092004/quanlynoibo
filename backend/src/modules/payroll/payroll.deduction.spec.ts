import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYROLL_CONFIG, sanitizeConfig, sanitizeEntry } from './payroll.config.js';

describe('sanitizeEntry: phụ cấp', () => {
  it('dữ liệu lưu từ trước (chưa có trường này) coi là không có phụ cấp nào', () => {
    expect(sanitizeEntry({}, 4).allowances).toEqual([]);
  });

  it('chỉ giữ khóa hợp lệ, bỏ trùng và xếp theo thứ tự cố định', () => {
    const { allowances } = sanitizeEntry({ allowances: ['posting', 'manager', 'posting', 'abc', 5] }, 4);
    expect(allowances).toEqual(['manager', 'posting']);
  });

  it('cờ isManager của bản lưu cũ vẫn được hiểu là trưởng phòng', () => {
    expect(sanitizeEntry({ isManager: true }, 4).allowances).toEqual(['manager']);
    expect(sanitizeEntry({ isManager: 'true' }, 4).allowances).toEqual([]);
  });
});

describe('sanitizeEntry: khoản trừ do lỗi', () => {
  it('dữ liệu lưu từ trước (chưa có trường này) coi là không có khoản trừ', () => {
    expect(sanitizeEntry({}, 4).deductions).toEqual([]);
    expect(sanitizeEntry({ deductions: 'abc' }, 4).deductions).toEqual([]);
  });

  it('giữ số tiền và lý do, lý do có thể để trống', () => {
    const { deductions } = sanitizeEntry(
      { deductions: [{ amount: 100_000, reason: 'Sai giờ xe' }, { amount: 50_000 }] },
      4,
    );
    expect(deductions).toEqual([
      { amount: 100_000, reason: 'Sai giờ xe' },
      { amount: 50_000, reason: '' },
    ]);
  });

  it('bỏ khoản có số tiền 0, âm hoặc không hợp lệ (số âm không thành cộng tiền)', () => {
    const { deductions } = sanitizeEntry(
      { deductions: [{ amount: 0 }, { amount: -5 }, { amount: 'abc' }, { amount: 20_000, reason: 'Ok' }] },
      4,
    );
    expect(deductions).toEqual([{ amount: 20_000, reason: 'Ok' }]);
  });

  it('cắt lý do quá dài và giới hạn số khoản', () => {
    const many = Array.from({ length: 50 }, () => ({ amount: 1_000, reason: 'x'.repeat(300) }));
    const { deductions } = sanitizeEntry({ deductions: many }, 4);
    expect(deductions).toHaveLength(30);
    expect(deductions[0].reason).toHaveLength(200);
  });
});

describe('sanitizeConfig: mức phụ cấp', () => {
  it('công thức đã lưu từ trước lấy mức mặc định 1 triệu cho cả 3 loại', () => {
    expect(sanitizeConfig({}).allowances).toEqual(DEFAULT_PAYROLL_CONFIG.allowances);
    expect(DEFAULT_PAYROLL_CONFIG.allowances).toEqual({ manager: 1_000_000, training: 1_000_000, posting: 1_000_000 });
  });

  it('giữ số Admin nhập cho từng loại, loại thiếu lấy mặc định', () => {
    expect(sanitizeConfig({ allowances: { training: 500_000 } }).allowances).toEqual({
      manager: 1_000_000,
      training: 500_000,
      posting: 1_000_000,
    });
  });

  it('mức trưởng phòng của bản lưu cũ (managerAllowance) vẫn được giữ', () => {
    expect(sanitizeConfig({ managerAllowance: 1_500_000 }).allowances.manager).toBe(1_500_000);
  });
});
