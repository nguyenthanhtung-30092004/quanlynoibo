import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAYROLL_CONFIG, sanitizeConfig, sanitizeEntry } from './payroll.config.js';
import { PayrollService } from './payroll.service.js';

describe('sanitizeEntry: bảo hiểm', () => {
  it('thiếu, null hoặc rỗng là chưa chốt', () => {
    expect(sanitizeEntry({}, 4).insurance).toBeNull();
    expect(sanitizeEntry({ insurance: null }, 4).insurance).toBeNull();
    expect(sanitizeEntry({ insurance: '' }, 4).insurance).toBeNull();
  });

  it('có số thì giữ số, 0 là chốt không trừ, số âm bị đưa về 0', () => {
    expect(sanitizeEntry({ insurance: 678_000 }, 4).insurance).toBe(678_000);
    expect(sanitizeEntry({ insurance: 0 }, 4).insurance).toBe(0);
    expect(sanitizeEntry({ insurance: -5 }, 4).insurance).toBe(0);
  });
});

describe('sanitizeEntry: ứng lương', () => {
  it('phần nhập tay lưu từ trước (chưa có trường này) coi là chưa ứng', () => {
    expect(sanitizeEntry({}, 4).advance).toBe(0);
  });

  it('giữ số Admin nhập, số âm hoặc không hợp lệ đưa về 0', () => {
    expect(sanitizeEntry({ advance: 1_500_000 }, 4).advance).toBe(1_500_000);
    expect(sanitizeEntry({ advance: -1 }, 4).advance).toBe(0);
    expect(sanitizeEntry({ advance: 'abc' }, 4).advance).toBe(0);
  });
});

describe('sanitizeConfig: bảo hiểm mặc định', () => {
  it('công thức đã lưu từ trước (chưa có trường này) lấy mức mặc định của hệ thống', () => {
    expect(sanitizeConfig({}).insuranceDefault).toBe(DEFAULT_PAYROLL_CONFIG.insuranceDefault);
  });

  it('giữ số Admin nhập', () => {
    expect(sanitizeConfig({ insuranceDefault: 678_000 }).insuranceDefault).toBe(678_000);
  });
});

/** Bảng cài đặt giả: key -> value, đủ dùng cho `findOne` / `create` / `save` của PayrollService */
function fakeSettings() {
  const store = new Map<string, string>();
  return {
    store,
    findOne: async ({ where }: { where: { key: string } }) =>
      store.has(where.key) ? { key: where.key, value: store.get(where.key)! } : null,
    create: (row: { key: string; value: string }) => row,
    save: async (row: { key: string; value: string }) => {
      store.set(row.key, row.value);
      return row;
    },
  };
}

describe('PayrollService.save: chốt bảo hiểm theo tháng', () => {
  const newService = () => {
    const settings = fakeSettings();
    const service = new PayrollService(settings as never, {} as never, {} as never);
    vi.spyOn(service, 'get').mockResolvedValue({} as never);
    return { service, settings };
  };
  const saved = (settings: ReturnType<typeof fakeSettings>, month: string) =>
    JSON.parse(settings.store.get(`payroll_${month}`)!) as Record<string, { insurance: number | null }>;

  it('nhân viên chưa có số riêng thì ghi mức mặc định lúc lưu, ai có số riêng thì giữ', async () => {
    const { service, settings } = newService();
    await service.save('2026-07', { insuranceDefault: 567_000 }, { '1': { level: 0 }, '2': { insurance: 700_000 } });
    expect(saved(settings, '2026-07')).toMatchObject({
      '1': { insurance: 567_000 },
      '2': { insurance: 700_000 },
    });
  });

  it('đổi mức mặc định ở tháng 8 không làm đổi tháng 7 đã lưu', async () => {
    const { service, settings } = newService();
    await service.save('2026-07', { insuranceDefault: 567_000 }, { '1': { level: 0 } });
    await service.save('2026-08', { insuranceDefault: 678_000 }, { '1': { level: 0 } });
    expect(saved(settings, '2026-07')['1'].insurance).toBe(567_000);
    expect(saved(settings, '2026-08')['1'].insurance).toBe(678_000);
  });

  it('chỉnh riêng một người ở tháng 8 không đụng tới tháng 7', async () => {
    const { service, settings } = newService();
    await service.save('2026-07', { insuranceDefault: 567_000 }, { '1': { level: 0 } });
    await service.save('2026-08', { insuranceDefault: 567_000 }, { '1': { insurance: 900_000 } });
    expect(saved(settings, '2026-07')['1'].insurance).toBe(567_000);
    expect(saved(settings, '2026-08')['1'].insurance).toBe(900_000);
  });
});
