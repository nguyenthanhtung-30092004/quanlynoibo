import { describe, expect, it } from 'vitest';
import { buildRouteStats, rankRoutes } from './route-stats';

const routes = [
  { id: 1, name: 'Hà Nội - Hạ Long' },
  { id: 2, name: 'Hạ Long - Hà Nội' },
  { id: 3, name: 'Hà Nội - Hải Phòng' },
];
const row = (routeId: number, total: number, seats: number, commission: number, extra = {}) => ({
  routeId,
  total,
  seats,
  commission,
  ...extra,
});

describe('buildRouteStats', () => {
  it('gộp hai chiều của cùng một tuyến, đặt Hà Nội lên đầu và lấy tên theo chiều nhiều vé hơn', () => {
    const out = buildRouteStats(
      [row(1, 10, 12, 100, { regularOrders: 4, newOrders: 6 }), row(2, 5, 8, 50, { regularOrders: 1, newOrders: 4 }), row(3, 3, 3, 30)],
      routes,
    );
    expect(out.map((r) => r.name)).toEqual(['Hà Nội ↔ Hạ Long', 'Hà Nội ↔ Hải Phòng']);
    expect(out[0]).toMatchObject({ ids: [1, 2], orders: 15, seats: 20, commission: 150, regularOrders: 5, newOrders: 10 });
  });

  it('bỏ tuyến không có đơn', () => {
    expect(buildRouteStats([row(1, 0, 0, 0)], routes)).toEqual([]);
  });
});

describe('rankRoutes', () => {
  const base = buildRouteStats([row(1, 10, 20, 100, { regularOrders: 3, newOrders: 7 }), row(3, 30, 10, 900)], routes);

  it('xếp theo chỉ số đã chọn và chia phần trăm trên tổng chỉ số đó', () => {
    const bySeats = rankRoutes(base, 'seats');
    expect(bySeats.map((r) => r.pct)).toEqual([67, 33]);
    const byCommission = rankRoutes(base, 'commission');
    expect(byCommission[0].name).toBe('Hà Nội ↔ Hải Phòng');
    expect(byCommission.map((r) => r.pct)).toEqual([90, 10]);
  });

  it('tỷ lệ khách quen + lạ luôn đủ 100%, null khi chưa phân loại được đơn nào', () => {
    const [hl, hp] = rankRoutes(base, 'seats');
    expect(hl.regularPct).toBe(30);
    expect(hl.newPct).toBe(70);
    expect(hp.regularPct).toBeNull();
  });
});
