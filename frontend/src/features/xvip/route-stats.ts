import type { Kpi } from '@/features/orders/types';

export const ROUTE_PALETTE = [
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#ea580c', '#14b8a6', '#6366f1', '#84cc16', '#e11d48', '#d946ef',
  '#3b82f6', '#22c55e', '#eab308', '#a855f7',
];

/** Một tuyến đã gộp hai chiều (Hà Nội - Hạ Long + Hạ Long - Hà Nội) */
export interface RouteStat {
  id: number;
  /** Id của mọi chiều thuộc tuyến này, dùng để lọc danh sách vé */
  ids: number[];
  name: string;
  orders: number;
  seats: number;
  revenue: number;
  /** Doanh số (hoa hồng) */
  commission: number;
  regularOrders: number;
  newOrders: number;
  regularSeats: number;
  newSeats: number;
  regularCommission: number;
  newCommission: number;
}

/** Chỉ số dùng để xếp hạng và chia tỷ lệ */
export type RouteMetric = 'seats' | 'orders' | 'commission';

export interface RankedRoute extends RouteStat {
  /** Giá trị của chỉ số đang chọn */
  value: number;
  /** Phần trăm làm tròn trên tổng chỉ số */
  pct: number;
  /** Phần trăm chính xác, dùng để vẽ biểu đồ */
  share: number;
  color: string;
  /** Tỷ lệ khách quen / khách lạ theo số đơn đã phân loại; null khi chưa phân loại được đơn nào */
  regularPct: number | null;
  newPct: number | null;
}

/**
 * Gộp hai chiều của cùng một tuyến, tên hiển thị theo chiều có nhiều vé hơn và đặt Hà Nội lên đầu ("Hà Nội ↔ ...").
 * Kết quả xếp nhiều vé nhất trước.
 */
export function buildRouteStats(
  byRoute: NonNullable<Kpi['byRoute']>,
  routes: ReadonlyArray<{ id: number; name: string }>,
): RouteStat[] {
  const nameById = new Map(routes.map((r) => [r.id, r.name]));
  const groups = new Map<string, RouteStat>();
  // Số vé của chiều nhiều vé nhất trong mỗi tuyến, để chọn tên hiển thị
  const topSeats = new Map<string, number>();
  for (const r of byRoute) {
    if (r.total <= 0) continue;
    const name = nameById.get(r.routeId) ?? `Tuyến #${r.routeId}`;
    const parts = name.split(/\s+[-–]\s+/).map((p) => p.trim().toLowerCase());
    const forward = parts.join('|');
    const key = [forward, [...parts].reverse().join('|')].sort()[0];
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, {
        id: r.routeId,
        ids: [r.routeId],
        name,
        orders: r.total,
        seats: r.seats,
        revenue: r.revenue ?? 0,
        commission: r.commission ?? 0,
        regularOrders: r.regularOrders ?? 0,
        newOrders: r.newOrders ?? 0,
        regularSeats: r.regularSeats ?? 0,
        newSeats: r.newSeats ?? 0,
        regularCommission: r.regularCommission ?? 0,
        newCommission: r.newCommission ?? 0,
      });
      topSeats.set(key, r.seats);
      continue;
    }
    cur.ids.push(r.routeId);
    cur.orders += r.total;
    cur.seats += r.seats;
    cur.revenue += r.revenue ?? 0;
    cur.commission += r.commission ?? 0;
    cur.regularOrders += r.regularOrders ?? 0;
    cur.newOrders += r.newOrders ?? 0;
    cur.regularSeats += r.regularSeats ?? 0;
    cur.newSeats += r.newSeats ?? 0;
    cur.regularCommission += r.regularCommission ?? 0;
    cur.newCommission += r.newCommission ?? 0;
    if (r.seats > (topSeats.get(key) ?? 0)) {
      cur.name = name;
      topSeats.set(key, r.seats);
    }
  }
  return [...groups.values()]
    .map((g) => {
      let parts = g.name.split(/\s+[-–]\s+/);
      const hasHn = (t: string) => t.toLowerCase().includes('hà nội');
      if (parts.length > 1 && !hasHn(parts[0]) && hasHn(parts[parts.length - 1])) parts = [...parts].reverse();
      return { ...g, name: parts.join(' ↔ ') };
    })
    .sort((x, y) => y.seats - x.seats);
}

/** Xếp hạng theo chỉ số đã chọn (bằng nhau thì nhiều vé hơn, rồi theo tên), kèm phần trăm và màu */
export function rankRoutes(rows: readonly RouteStat[], metric: RouteMetric): RankedRoute[] {
  const valueOf = (r: RouteStat) => (metric === 'seats' ? r.seats : metric === 'orders' ? r.orders : r.commission);
  const sorted = [...rows].sort(
    (a, b) => valueOf(b) - valueOf(a) || b.seats - a.seats || a.name.localeCompare(b.name, 'vi'),
  );
  const total = sorted.reduce((sum, r) => sum + valueOf(r), 0);
  return sorted.map((r, idx) => {
    const value = valueOf(r);
    const classified = r.regularOrders + r.newOrders;
    const regularPct = classified > 0 ? Math.round((r.regularOrders / classified) * 100) : null;
    return {
      ...r,
      value,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
      share: total > 0 ? (value / total) * 100 : 0,
      color: ROUTE_PALETTE[idx % ROUTE_PALETTE.length],
      regularPct,
      newPct: regularPct === null ? null : 100 - regularPct,
    };
  });
}
