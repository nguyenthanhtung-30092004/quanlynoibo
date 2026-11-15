import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYROLL_CONFIG, sanitizeConfig, sanitizeEntry } from './payroll.config.js';

describe('sanitizeEntry: trưởng phòng', () => {
  it('dữ liệu lưu từ trước (chưa có trường này) coi là không phải trưởng phòng', () => {
    expect(sanitizeEntry({}, 4).isManager).toBe(false);
  });

  it('chỉ true thật sự mới là trưởng phòng, chuỗi hay số không tính', () => {
    expect(sanitizeEntry({ isManager: true }, 4).isManager).toBe(true);
    expect(sanitizeEntry({ isManager: 'true' }, 4).isManager).toBe(false);
    expect(sanitizeEntry({ isManager: 1 }, 4).isManager).toBe(false);
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

describe('sanitizeConfig: phụ cấp trưởng phòng', () => {
  it('công thức đã lưu từ trước lấy mức mặc định 1 triệu', () => {
    expect(sanitizeConfig({}).managerAllowance).toBe(DEFAULT_PAYROLL_CONFIG.managerAllowance);
    expect(DEFAULT_PAYROLL_CONFIG.managerAllowance).toBe(1_000_000);
  });

  it('giữ số Admin nhập', () => {
    expect(sanitizeConfig({ managerAllowance: 1_500_000 }).managerAllowance).toBe(1_500_000);
  });
});
