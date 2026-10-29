'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, MapTrifold, Ticket, Receipt, HandCoins } from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import { DashboardOrdersModal } from '@/features/orders/components/DashboardOrdersModal';
import { useKpi } from '@/features/orders/hooks';
import { useRoutes } from '@/features/routes/hooks';
import { Card, PageTitle } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { NEW_COLOR, REGULAR_COLOR } from '@/features/xvip/customer-type-chart';
import { DateRangeFilter, rangeParams, useDateFilter } from '@/features/xvip/date-filter';
import {
  buildRouteStats,
  rankRoutes,
  type RankedRoute,
  type RouteMetric,
} from '@/features/xvip/route-stats';

const METRICS: Array<{ key: RouteMetric; label: string }> = [
  { key: 'seats', label: 'Theo vé' },
  { key: 'orders', label: 'Theo đơn' },
  { key: 'commission', label: 'Theo doanh số' },
];

const MEDAL = [
  'from-yellow-300 to-amber-500 text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.55)]',
  'from-slate-200 to-slate-400 text-slate-800 shadow-[0_2px_8px_rgba(100,116,139,0.5)]',
  'from-orange-300 to-amber-700 text-orange-950 shadow-[0_2px_8px_rgba(194,65,12,0.45)]',
];

const fmt = (n: number) => n.toLocaleString('vi-VN');

/** Số tiền gọn để đặt giữa biểu đồ: 12,3 tr / 1,25 tỷ */
function compactMoney(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace('.', ',')} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} tr`;
  return `${fmt(n)}đ`;
}

/** Chỉ Admin xem trang này (có doanh số); nhân viên được chuyển sang trang Quản lý vé */
export default function RouteSharePage() {
  const router = useRouter();
  const { data: me, isLoading } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';

  useEffect(() => {
    if (me && !isAdmin) router.replace('/xvip/quan-ly-ve');
  }, [me, isAdmin, router]);

  if (isLoading || !isAdmin) return null;
  return <RouteShareContent />;
}

function RouteShareContent() {
  const { range, basis } = useDateFilter();
  const dates = rangeParams(range, basis);
  const { data: kpiData, isLoading } = useKpi(undefined, dates);
  const { data: routesData } = useRoutes();
  const routes = useMemo(() => routesData?.data ?? [], [routesData]);

  const [metric, setMetric] = useState<RouteMetric>('seats');
  const [search, setSearch] = useState('');
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ ids: number[]; name: string } | null>(null);

  const base = useMemo(() => buildRouteStats(kpiData?.byRoute ?? [], routes), [kpiData, routes]);
  const ranked = useMemo(() => rankRoutes(base, metric), [base, metric]);

  const totals = useMemo(
    () => ({
      seats: base.reduce((s, r) => s + r.seats, 0),
      orders: base.reduce((s, r) => s + r.orders, 0),
      commission: base.reduce((s, r) => s + r.commission, 0),
    }),
    [base],
  );
  const metricTotal = totals[metric];

  const needle = search.trim().toLocaleLowerCase('vi');
  const visible = needle ? ranked.filter((r) => r.name.toLocaleLowerCase('vi').includes(needle)) : ranked;
  const topValue = ranked[0]?.value ?? 0;

  const TILES = [
    {
      label: 'Tổng vé',
      value: `${fmt(totals.seats)} vé`,
      note: 'Trên mọi tuyến',
      icon: Ticket,
      color: 'from-blue-600 to-blue-700',
      edge: '#1d4ed8',
    },
    {
      label: 'Tổng đơn',
      value: `${fmt(totals.orders)} đơn`,
      note: 'Không tính vé đã hủy',
      icon: Receipt,
      color: 'from-emerald-500 to-emerald-700',
      edge: '#047857',
    },
    {
      label: 'Doanh số',
      value: `${money(totals.commission)}đ`,
      note: 'Tổng hoa hồng',
      icon: HandCoins,
      color: 'from-amber-500 to-amber-600',
      edge: '#b45309',
    },
    {
      label: 'Số tuyến',
      value: `${fmt(base.length)} tuyến`,
      note: 'Có vé trong kỳ lọc',
      icon: MapTrifold,
      color: 'from-violet-600 to-violet-700',
      edge: '#6d28d9',
    },
  ];

  return (
    <>
      <PageTitle actions={<DateRangeFilter align="right" className="w-auto min-w-56" />}>
        Tỷ lệ vé theo tuyến đường
      </PageTitle>

      {/* Bốn ô tổng quan */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {TILES.map(({ label, value, note, icon: Icon, color, edge }) => (
          <div
            key={label}
            style={{ boxShadow: `inset 0 1px 1px rgba(255,255,255,0.45), 0 4px 0 ${edge}, 0 10px 20px -6px rgba(15,23,42,0.25)` }}
            className={`relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-b ${color} px-3.5 py-3 text-white`}
          >
            <Icon
              weight="fill"
              className="pointer-events-none absolute -bottom-2 -right-1 size-16 text-white/15"
              aria-hidden="true"
            />
            <div className="text-[11px] font-black uppercase tracking-wider text-white/85">{label}</div>
            <div className="tnum mt-1 break-words text-xl font-black leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] sm:text-2xl">
              {isLoading ? '...' : value}
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-white/85">{note}</div>
          </div>
        ))}
      </div>

      {base.length === 0 ? (
        <Card className="mt-5">
          <div className="py-12 text-center text-sm font-bold text-slate-400">
            {isLoading ? 'Đang tải...' : 'Chưa có vé nào trong khoảng thời gian đã chọn.'}
          </div>
        </Card>
      ) : (
        <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Biểu đồ tròn */}
          <Card title="Biểu đồ tỷ lệ" className="lg:sticky lg:top-24">
            <MetricToggle value={metric} onChange={setMetric} />
            <Donut
              rows={ranked}
              hover={hover}
              onHover={setHover}
              onPick={(r) => setSelected({ ids: r.ids, name: r.name })}
              centerValue={metric === 'commission' ? compactMoney(metricTotal) : fmt(metricTotal)}
              centerLabel={metric === 'seats' ? 'Vé bán' : metric === 'orders' ? 'Đơn' : 'Doanh số'}
            />
            {/* Ba tuyến dẫn đầu */}
            <ol className="mt-5 space-y-2">
              {ranked.slice(0, 3).map((r, i) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b text-xs font-black ${MEDAL[i]}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-xs font-bold text-slate-800 dark:text-slate-200">
                    {r.name}
                  </span>
                  <span className="tnum text-sm font-black" style={{ color: r.color }}>
                    {r.pct}%
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          {/* Danh sách chi tiết */}
          <Card title="Chi tiết từng tuyến">
            <label className="relative mb-4 block">
              <MagnifyingGlass
                size={16}
                weight="bold"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tuyến (ví dụ: Hạ Long)"
                aria-label="Tìm tuyến"
                className="input-3d !h-10 !w-full !pl-9 text-sm"
              />
            </label>

            {visible.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Không có tuyến nào khớp.</div>
            ) : (
              <ul className="space-y-2.5">
                {visible.map((r) => (
                  <RouteRow
                    key={r.id}
                    r={r}
                    rank={ranked.indexOf(r)}
                    metric={metric}
                    topValue={topValue}
                    dim={hover !== null && hover !== r.id}
                    onHover={setHover}
                    onPick={() => setSelected({ ids: r.ids, name: r.name })}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {selected && (
        <DashboardOrdersModal
          title={`Vé tuyến ${selected.name}`}
          filters={{
            staffId: 'all',
            routeId: 'all',
            routeIds: selected.ids,
            dateFrom: null,
            dateTo: null,
            ...dates,
          }}
          showRoute={false}
          showStaff
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/** Ba nút chọn chỉ số dùng để xếp hạng và chia tỷ lệ */
function MetricToggle({ value, onChange }: { value: RouteMetric; onChange: (m: RouteMetric) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Chọn chỉ số"
      className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
    >
      {METRICS.map((m) => {
        const active = m.key === value;
        return (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.key)}
            className={`rounded-lg px-1.5 py-1.5 text-xs font-extrabold transition-all ${
              active
                ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/** Biểu đồ tròn SVG có khe hở giữa các tuyến; rê chuột để sáng tuyến, bấm để xem vé của tuyến */
function Donut({
  rows,
  hover,
  onHover,
  onPick,
  centerValue,
  centerLabel,
}: {
  rows: RankedRoute[];
  hover: number | null;
  onHover: (id: number | null) => void;
  onPick: (r: RankedRoute) => void;
  centerValue: string;
  centerLabel: string;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  // Khe hở giữa hai tuyến, tính theo độ dài cung; tuyến quá nhỏ thì không bị khe ăn hết
  const GAP = rows.length > 1 ? 0.9 : 0;
  // Vị trí bắt đầu của từng cung = tổng độ dài các cung trước nó
  const starts = rows.map((_, i) => rows.slice(0, i).reduce((sum, x) => sum + (x.share / 100) * C, 0));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Biểu đồ tỷ lệ vé theo tuyến">
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="13" className="stroke-slate-100 dark:stroke-slate-800" />
        {rows.map((r, i) => {
          const len = (r.share / 100) * C;
          const drawn = Math.max(len - GAP, len * 0.35);
          const offset = -starts[i];
          const active = hover === r.id;
          return (
            <circle
              key={r.id}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={r.color}
              strokeWidth={active ? 16 : 13}
              strokeDasharray={`${drawn} ${C - drawn}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              opacity={hover === null || active ? 1 : 0.35}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHover(r.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onPick(r)}
            >
              <title>{`${r.name}: ${r.pct}%`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.08)] dark:bg-slate-900">
        <span className="tnum text-xl font-black leading-none text-slate-900 dark:text-white sm:text-2xl">
          {centerValue}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

function RouteRow({
  r,
  rank,
  metric,
  topValue,
  dim,
  onHover,
  onPick,
}: {
  r: RankedRoute;
  rank: number;
  metric: RouteMetric;
  topValue: number;
  dim: boolean;
  onHover: (id: number | null) => void;
  onPick: () => void;
}) {
  // Thanh dài theo tuyến dẫn đầu để thấy rõ chênh lệch, không phải theo tổng
  const width = topValue > 0 ? Math.max(3, (r.value / topValue) * 100) : 0;
  const groups = [
    { label: 'Quen', pct: r.regularPct, orders: r.regularOrders, seats: r.regularSeats, commission: r.regularCommission, color: REGULAR_COLOR },
    { label: 'Lạ', pct: r.newPct, orders: r.newOrders, seats: r.newSeats, commission: r.newCommission, color: NEW_COLOR },
  ];
  const stat = (key: RouteMetric, text: string) => (
    <span className={metric === key ? 'font-black text-slate-900 dark:text-white' : ''}>{text}</span>
  );
  return (
    <li className={`transition-opacity duration-200 ${dim ? 'opacity-45' : ''}`}>
      <button
        type="button"
        onClick={onPick}
        onMouseEnter={() => onHover(r.id)}
        onMouseLeave={() => onHover(null)}
        title="Bấm để xem toàn bộ vé của tuyến này"
        className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60"
        style={{ borderLeft: `4px solid ${r.color}` }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
              rank < 3
                ? `bg-gradient-to-b ${MEDAL[rank]}`
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {rank + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-extrabold text-slate-900 dark:text-white">{r.name}</div>
            <div className="tnum mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {stat('orders', `${fmt(r.orders)} đơn`)}
              <span aria-hidden="true">·</span>
              {stat('seats', `${fmt(r.seats)} vé`)}
              <span aria-hidden="true">·</span>
              {stat('commission', `DS ${money(r.commission)}đ`)}
            </div>
          </div>
          <span className="tnum shrink-0 text-xl font-black leading-none" style={{ color: r.color }}>
            {r.pct}%
          </span>
        </div>

        {/* Thanh tỷ lệ theo chỉ số đang chọn */}
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${width}%`, background: `linear-gradient(90deg, ${r.color}, ${r.color}cc)` }}
          />
        </div>

        {/* Khách quen / khách lạ */}
        {r.regularPct !== null && (
          <div className="mt-3">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true">
              <div style={{ width: `${r.regularPct}%`, background: REGULAR_COLOR }} />
              <div style={{ width: `${r.newPct}%`, background: NEW_COLOR }} />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {groups.map((g) => (
                <div key={g.label} className="min-w-0 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: g.color }} />
                    {g.label} {g.pct}%
                  </div>
                  <div className="tnum mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {fmt(g.orders)} đơn · {fmt(g.seats)} vé
                  </div>
                  <div className="tnum text-xs font-bold text-slate-900 dark:text-white">DS {money(g.commission)}đ</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </button>
    </li>
  );
}
