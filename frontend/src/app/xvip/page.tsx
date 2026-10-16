'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/hooks';
import { useKpi, useOrders } from '@/features/orders/hooks';
import { useRoutes } from '@/features/routes/hooks';
import { useActiveStaff, useUsers } from '@/features/users/hooks';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { PartnerChart } from '@/features/xvip/partner-chart';
import { DateRangeFilter, rangeParams, useDateFilter } from '@/features/xvip/date-filter';

const ROUTE_PALETTE = [
  '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#ea580c', '#14b8a6', '#6366f1', '#84cc16', '#e11d48', '#d946ef',
  '#3b82f6', '#22c55e', '#eab308', '#a855f7',
];


/** Chỉ Admin xem tổng quan; nhân viên được chuyển sang trang Quản lý vé */
export default function OverviewPage() {
  const router = useRouter();
  const { data: me, isLoading } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';

  useEffect(() => {
    if (me && !isAdmin) router.replace('/xvip/quan-ly-ve');
  }, [me, isAdmin, router]);

  if (isLoading || !isAdmin) return null;
  return <OverviewContent />;
}

function OverviewContent() {
  // Lọc theo ngày đi hoặc ngày tạo vé, chọn ở nút ngày trên header
  const { range, basis } = useDateFilter();
  const dates = rangeParams(range, basis);
  const { data: kpiData, isLoading: kpiLoading } = useKpi(undefined, dates);
  const { data: ordersData } = useOrders({
    search: '',
    staffId: 'all',
    routeId: 'all',
    activeOnly: true,
    dateFrom: null,
    dateTo: null,
    ...dates,
    page: 1,
  });
  const { data: routesData } = useRoutes();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  // API người dùng chỉ dành cho Admin; nhân viên không xem doanh thu
  const { data: usersData } = useUsers({ page: 1, search: '' }, isAdmin);
  const { data: activeStaffList = [] } = useActiveStaff(isAdmin);

  const orders = useMemo(() => ordersData?.data ?? [], [ordersData]);
  const routes = useMemo(() => routesData?.data ?? [], [routesData]);

  // Thống kê chỉ số thật
  const totalOrders = kpiData?.total ?? orders.length;
  const totalTickets = kpiData?.seats ?? 0;
  const totalCommission = kpiData?.commission ?? orders.reduce((sum, o) => sum + (o.commission || 0), 0);
  const totalStaffCount = activeStaffList.length > 0 ? activeStaffList.length : (usersData?.total ?? 1);
  const smsSentCount = kpiData?.smsSent ?? orders.filter((o) => o.smsSent).length;

  const STATS = [
    {
      label: 'Tổng vé',
      value: `${totalTickets.toLocaleString('vi-VN')} vé`,
      note: totalOrders > 0 ? `${totalOrders.toLocaleString('vi-VN')} đơn · mỗi đơn có thể nhiều vé` : 'Hệ thống sẵn sàng lên đơn',
      color: 'from-blue-600 to-blue-700',
      borderBottom: '#1d4ed8',
    },
    {
      label: 'Doanh số',
      value: `${money(totalCommission)}đ`,
      note: 'Tổng hoa hồng tích lũy',
      color: 'from-amber-500 to-amber-600',
      borderBottom: '#b45309',
    },
    {
      label: 'Nhân viên hệ thống',
      value: `${totalStaffCount} người`,
      note: 'Tài khoản hoạt động',
      color: 'from-purple-600 to-purple-700',
      borderBottom: '#6b21a8',
    },
    {
      label: 'Tin SMS đã gửi',
      value: `${smsSentCount} tin`,
      note: 'Xác nhận tới khách',
      color: 'from-cyan-600 to-cyan-700',
      borderBottom: '#0e7490',
    },
  ];

  // Doanh số theo đối tác: lấy từ KPI (toàn bộ vé trong khoảng lọc), top theo doanh thu
  // Đối tác nhiều vé xếp trước; bằng vé thì hoa hồng cao hơn trước
  const carrierStats = useMemo(
    () => [...(kpiData?.byPartner ?? [])].sort((a, b) => b.seats - a.seats || b.commission - a.commission),
    [kpiData],
  );

  // Tỷ lệ vé theo tuyến: gộp hai chiều của cùng một tuyến (Hà Nội - Hạ Long + Hạ Long - Hà Nội)
  const routeStats = useMemo(() => {
    const nameById = new Map(routes.map((r) => [r.id, r.name]));
    const groups = new Map<
      string,
      { id: number; name: string; orders: number; count: number; revenue: number; topSeats: number }
    >();
    for (const r of kpiData?.byRoute ?? []) {
      if (r.total <= 0) continue;
      const name = nameById.get(r.routeId) ?? `Tuyến #${r.routeId}`;
      const parts = name.split(/\s+[-–]\s+/).map((p) => p.trim().toLowerCase());
      const forward = parts.join('|');
      const key = [forward, [...parts].reverse().join('|')].sort()[0];
      const cur = groups.get(key);
      if (!cur) {
        groups.set(key, { id: r.routeId, name, orders: r.total, count: r.seats, revenue: r.revenue ?? 0, topSeats: r.seats });
        continue;
      }
      cur.orders += r.total;
      cur.count += r.seats;
      cur.revenue += r.revenue ?? 0;
      // Tên hiển thị theo chiều có nhiều vé hơn
      if (r.seats > cur.topSeats) {
        cur.name = name;
        cur.topSeats = r.seats;
      }
    }
    const rows = [...groups.values()]
      .map((g) => ({ ...g, name: g.name.replace(/\s+[-–]\s+/g, ' ↔ ') }))
      .sort((x, y) => y.count - x.count);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return rows.map((r, idx) => ({
      ...r,
      pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
      share: total > 0 ? (r.count / total) * 100 : 0,
      color: ROUTE_PALETTE[idx % ROUTE_PALETTE.length],
    }));
  }, [routes, kpiData]);

  const donutGradient = useMemo(() => {
    if (routeStats.length === 0) return 'conic-gradient(#334155 0% 100%)';
    let acc = 0;
    const parts = routeStats.map((r) => {
      const from = acc;
      acc += r.share;
      return `${r.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }, [routeStats]);

  // Toàn bộ nhân viên tổng đài và kết quả bán vé
  const staffPodium = useMemo(() => {
    const kpiByStaffMap = new Map((kpiData?.byStaff ?? []).map((s) => [s.staffId, s]));

    if (activeStaffList.length > 0) {
      return activeStaffList
        .map((u) => {
          const stats = kpiByStaffMap.get(u.id);
          return {
            staffId: u.id,
            fullName: u.fullName,
            total: stats?.total ?? 0,
            seats: stats?.seats ?? 0,
            commission: stats?.commission ?? 0,
          };
        })
        .sort((a, b) => b.seats - a.seats || b.total - a.total || b.commission - a.commission);
    }

    if (kpiData?.byStaff && kpiData.byStaff.length > 0) {
      return [...kpiData.byStaff].sort((a, b) => b.seats - a.seats || b.total - a.total || b.commission - a.commission);
    }

    const staffUsers = usersData?.data?.filter((u) => u.role === 'STAFF') ?? [];
    return staffUsers
      .map((u) => {
        const matchOrders = orders.filter((o) => o.staff?.id === u.id);
        return {
          staffId: u.id,
          fullName: u.fullName,
          total: matchOrders.length,
          seats: matchOrders.reduce((sum, o) => sum + (o.tickets || 0), 0),
          commission: matchOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
        };
      })
      .sort((a, b) => b.seats - a.seats || b.total - a.total || b.commission - a.commission);
  }, [activeStaffList, kpiData, usersData, orders]);

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter align="right" className="w-auto min-w-56" />
          </div>
        }
      >
        Tổng quan điều hành hệ thống
      </PageTitle>

      {/* 4 Thẻ chỉ số 3D kết nối API thật */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, note, color, borderBottom }) => (
          <div
            key={label}
            style={{
              boxShadow: `inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 ${borderBottom}, 0 12px 24px -4px rgba(15,23,42,0.18)`,
            }}
            className={`group relative min-w-0 rounded-2xl bg-gradient-to-b ${color} px-4 py-3.5 text-white transition-all duration-100 hover:-translate-y-1 hover:brightness-105 active:translate-y-1 cursor-pointer select-none`}
          >
            <div className="border-b border-white/25 pb-2 text-[15px] font-black uppercase leading-tight tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              {label}
            </div>
            <div className="tnum mt-2 whitespace-nowrap text-[1.7rem] font-black leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {kpiLoading ? '...' : value}
            </div>
            <div className="mt-1.5 text-xs font-medium text-white/85">{note}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* Hoa hồng & số vé theo đối tác */}
        <Card
          title="Hoa hồng, số đơn & vé theo đối tác"
        >
          {carrierStats.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có vé nào trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <PartnerChart data={carrierStats} />
          )}
        </Card>

        {/* Tỷ lệ vé theo tuyến thật */}
        <Card
          title="Tỷ lệ vé theo tuyến đường"
        >
          {routeStats.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có vé nào trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 pt-2">
              <div
                className="relative size-40 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.3)] border border-slate-200 dark:border-slate-700"
                style={{ background: donutGradient }}
                role="img"
                aria-label="Biểu đồ tỷ lệ vé theo tuyến"
              >
                <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.08)] border border-slate-100 dark:border-slate-800">
                  <span className="tnum text-xl font-black text-slate-900 dark:text-white">
                    {totalTickets.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vé bán
                  </span>
                </div>
              </div>
              <ul className="w-full max-h-56 overflow-y-auto space-y-2 pr-1 text-xs lg:max-h-none lg:overflow-visible font-semibold text-slate-700 dark:text-slate-300">
                {routeStats.map((r) => (
                  <li key={r.id}>
                    <div
                      className="flex items-center gap-2.5 rounded-lg p-1"
                    >
                      <span className="size-3 shrink-0 rounded-full shadow-sm" style={{ background: r.color }} />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="tnum shrink-0 font-bold text-slate-900 dark:text-white">
                        {r.orders} đơn · {r.count} vé ({r.pct}%)
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Nhân viên tổng đài */}
        <Card
          title="Nhân viên tổng đài"
          action={
            <Link href="/xvip/bao-cao" className="btn-3d btn-3d-white px-3 py-1 text-xs">
              Báo cáo chi tiết
            </Link>
          }
        >
          {staffPodium.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có nhân viên nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <ol className="space-y-3 pt-1 max-h-[380px] overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
              {staffPodium.map((s, i) => (
                <li
                  key={s.staffId || s.fullName}
                  className="flex items-center gap-3 text-sm rounded-lg p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                    {i + 1}
                  </span>
                  <Avatar name={s.fullName} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-200 sm:flex-1">
                      {s.fullName}
                    </span>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="tnum shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">{s.total} đơn · {s.seats} vé</span>
                      <span className="tnum shrink-0 text-right font-black text-emerald-700 dark:text-emerald-400 sm:w-24">
                        {money(s.commission || 0)}đ
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
