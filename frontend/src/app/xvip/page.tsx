'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  CurrencyCircleDollar,
  Percent,
  Ticket,
  UsersThree,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import { useKpi, useOrders } from '@/features/orders/hooks';
import { usePartners } from '@/features/partners/hooks';
import { useRoutes } from '@/features/routes/hooks';
import { useUsers } from '@/features/users/hooks';
import { Avatar, Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';

const ROUTE_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function OverviewPage() {
  const { data: kpiData, isLoading: kpiLoading } = useKpi();
  const { data: ordersData, isLoading: ordersLoading } = useOrders({
    search: '',
    staffId: 'all',
    routeId: 'all',
    dateFrom: null,
    dateTo: null,
    page: 1,
  });
  const { data: partnerData } = usePartners();
  const { data: routesData } = useRoutes();
  const { data: usersData } = useUsers({ page: 1, search: '' });

  const orders = useMemo(() => ordersData?.data ?? [], [ordersData]);
  const carriers = useMemo(() => partnerData ?? [], [partnerData]);
  const routes = useMemo(() => routesData?.data ?? [], [routesData]);

  // Thống kê chỉ số thật
  const totalTickets = kpiData?.total ?? orders.length;
  const totalRevenue = kpiData?.revenue ?? orders.reduce((sum, o) => sum + (o.sellPrice || 0), 0);
  const totalCommission = kpiData?.commission ?? orders.reduce((sum, o) => sum + (o.commission || 0), 0);
  const totalStaffCount = usersData?.total ?? 1;
  const smsSentCount = kpiData?.smsSent ?? orders.filter((o) => o.smsSent).length;

  const STATS = [
    {
      label: 'Tổng vé điều hành',
      value: `${totalTickets.toLocaleString('vi-VN')} vé`,
      note: totalTickets > 0 ? 'Dữ liệu vận hành trực tiếp' : 'Hệ thống sẵn sàng lên đơn',
      color: 'from-blue-600 to-blue-700',
      borderBottom: '#1d4ed8',
      icon: Ticket,
    },
    {
      label: 'Tổng tiền vé',
      value: `${money(totalRevenue)}đ`,
      note: 'Doanh số vé thực tế',
      color: 'from-emerald-600 to-emerald-700',
      borderBottom: '#15803d',
      icon: CurrencyCircleDollar,
    },
    {
      label: 'Tổng hoa hồng',
      value: `${money(totalCommission)}đ`,
      note: 'Lợi nhuận điều hành',
      color: 'from-amber-500 to-amber-600',
      borderBottom: '#b45309',
      icon: Percent,
    },
    {
      label: 'Nhân viên hệ thống',
      value: `${totalStaffCount} người`,
      note: 'Tài khoản hoạt động',
      color: 'from-purple-600 to-purple-700',
      borderBottom: '#6b21a8',
      icon: UsersThree,
    },
    {
      label: 'Tin SMS đã gửi',
      value: `${smsSentCount} tin`,
      note: 'Xác nhận tới khách',
      color: 'from-cyan-600 to-cyan-700',
      borderBottom: '#0e7490',
      icon: PaperPlaneTilt,
    },
  ];

  // Doanh số theo đối tác thật
  const carrierStats = useMemo(() => {
    return carriers.map((c) => {
      const matchOrders = orders.filter((o) => o.partner?.toLowerCase() === c.name.toLowerCase());
      const cRevenue = matchOrders.reduce((sum, o) => sum + (o.sellPrice || 0), 0);
      return {
        name: c.name,
        tickets: matchOrders.length,
        revenue: cRevenue,
      };
    });
  }, [carriers, orders]);

  const maxCarrierTickets = Math.max(1, ...carrierStats.map((c) => c.tickets));

  // Tỷ lệ vé theo tuyến thật
  const routeStats = useMemo(() => {
    return routes.map((r, idx) => {
      const matchOrders = orders.filter((o) => o.route?.id === r.id);
      const pct = totalTickets > 0 ? Math.round((matchOrders.length / totalTickets) * 100) : 0;
      return {
        id: r.id,
        name: r.name,
        count: matchOrders.length,
        pct,
        color: ROUTE_PALETTE[idx % ROUTE_PALETTE.length],
      };
    });
  }, [routes, orders, totalTickets]);

  const donutGradient = useMemo(() => {
    if (routeStats.length === 0 || totalTickets === 0) {
      return 'conic-gradient(#3b82f6 0% 100%)';
    }
    let acc = 0;
    const parts = routeStats.map((r) => {
      const from = acc;
      acc += r.pct;
      return `${r.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }, [routeStats, totalTickets]);

  // Top nhân viên thật từ kpiData.byStaff hoặc usersData
  const staffPodium = useMemo(() => {
    if (kpiData?.byStaff && kpiData.byStaff.length > 0) {
      return kpiData.byStaff;
    }
    const staffUsers = usersData?.data?.filter((u) => u.role === 'STAFF') ?? [];
    return staffUsers.map((u) => {
      const matchOrders = orders.filter((o) => o.staff?.id === u.id);
      return {
        staffId: u.id,
        fullName: u.fullName,
        total: matchOrders.length,
        commission: matchOrders.reduce((sum, o) => sum + (o.commission || 0), 0),
      };
    });
  }, [kpiData, usersData, orders]);

  return (
    <>
      <PageTitle>Tổng quan điều hành hệ thống</PageTitle>

      {/* 5 Thẻ chỉ số 3D kết nối API thật */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {STATS.map(({ label, value, note, color, borderBottom, icon: StatIcon }) => (
          <div
            key={label}
            style={{
              boxShadow: `inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 ${borderBottom}, 0 12px 24px -4px rgba(15,23,42,0.18)`,
            }}
            className={`group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b ${color} p-4 text-white transition-all duration-100 hover:-translate-y-1 hover:brightness-105 active:translate-y-1 cursor-pointer select-none`}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
              <StatIcon size={26} weight="fill" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-white/80">{label}</div>
              <div className="tnum truncate text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
                {kpiLoading ? '...' : value}
              </div>
              <div className="text-[11px] font-medium text-white/90">{note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Doanh số theo nhà xe thật */}
        <Card
          title="Doanh số theo đối tác"
          action={
            <Link href="/xvip/doi-tac" className="btn-3d btn-3d-white px-3 py-1 text-xs">
              Xem chi tiết
            </Link>
          }
        >
          {carrierStats.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có đối tác nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <ul className="space-y-3 pt-1">
              {carrierStats.slice(0, 5).map((c) => (
                <li key={c.name} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-2 text-sm">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-300">{c.name}</span>
                  <span className="h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner border border-slate-200 dark:border-slate-700">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-xv-blue shadow-[0_1px_3px_rgba(37,99,235,0.4)]"
                      style={{ width: `${Math.max(6, (c.tickets / maxCarrierTickets) * 100)}%` }}
                    />
                  </span>
                  <span className="tnum text-right font-bold text-slate-900 dark:text-white">
                    {money(c.revenue)}đ
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Tỷ lệ vé theo tuyến thật */}
        <Card
          title="Tỷ lệ vé theo tuyến đường"
          action={
            <Link href="/xvip/tuyen-duong" className="btn-3d btn-3d-white px-3 py-1 text-xs">
              Xem chi tiết
            </Link>
          }
        >
          {routeStats.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có tuyến đường nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
              <Link
                href="/xvip/tuyen-duong"
                className="relative size-40 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,0.3)] border border-slate-200 dark:border-slate-700 transition-transform hover:scale-105 active:scale-95"
                style={{ background: donutGradient }}
                role="img"
                aria-label="Biểu đồ tỷ lệ vé theo tuyến - Bấm để xem chi tiết"
              >
                <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.08)] border border-slate-100 dark:border-slate-800">
                  <span className="tnum text-xl font-black text-slate-900 dark:text-white">
                    {totalTickets.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vé bán
                  </span>
                </div>
              </Link>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {routeStats.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      href="/xvip/tuyen-duong"
                      className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-blue-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="size-3 rounded-full shadow-sm" style={{ background: r.color }} />
                      <span className="flex-1 hover:text-blue-600 transition-colors">{r.name}</span>
                      <span className="tnum font-bold text-slate-900 dark:text-white">
                        {r.count} vé {totalTickets > 0 ? `(${r.pct}%)` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Top nhân viên thật */}
        <Card
          title="Nhân viên điều hành bán vé"
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
            <ol className="space-y-3 pt-1">
              {staffPodium.slice(0, 5).map((s, i) => (
                <li
                  key={s.staffId || s.fullName}
                  className="flex items-center gap-3 text-sm rounded-lg p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                    {i + 1}
                  </span>
                  <Avatar name={s.fullName} />
                  <span className="flex-1 truncate font-semibold text-slate-800 dark:text-slate-200">
                    {s.fullName}
                  </span>
                  <span className="tnum text-xs font-bold text-slate-500 dark:text-slate-400">{s.total} vé</span>
                  <span className="tnum w-24 text-right font-black text-emerald-700 dark:text-emerald-400">
                    {money(s.commission || 0)}đ
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Danh sách vé mới nhất từ API thật */}
      <Card
        title="Danh sách đơn vé điều hành mới nhất"
        action={
          <Link href="/xvip/quan-ly-ve" className="btn-3d btn-3d-blue px-3.5 py-1.5 text-xs">
            Vào quản lý toàn bộ vé ➔
          </Link>
        }
        className="mt-5 !p-0 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Mã đơn</th>
                <th className={TH}>Giờ xe</th>
                <th className={TH}>Nhà xe</th>
                <th className={TH}>Tuyến đường</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Số điện thoại</th>
                <th className={`${TH} text-right`}>Giá vé</th>
                <th className={`${TH} text-right`}>Hoa hồng</th>
                <th className={TH}>NV tạo</th>
                <th className={TH}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải danh sách vé mới nhất từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có đơn vé nào trong hệ thống.{' '}
                    <Link href="/xvip/quan-ly-ve" className="text-blue-600 hover:underline font-bold ml-1">
                      Bấm vào đây để tạo đơn vé mới!
                    </Link>
                  </td>
                </tr>
              ) : (
                orders.slice(0, 8).map((t, i) => (
                  <tr key={t.id} className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors">
                    <td className={TD}>{i + 1}</td>
                    <td className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                      #{t.id}
                    </td>
                    <td className={`${TD} font-bold text-blue-700 dark:text-blue-400`}>
                      {t.departureTime}
                      <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">
                        {t.departureDate}
                      </span>
                    </td>
                    <td className={`${TD} font-bold text-slate-800 dark:text-slate-200`}>
                      <Link href="/xvip/doi-tac" className="hover:text-blue-600 hover:underline transition-colors">
                        {t.partner || 'XVIP'}
                      </Link>
                    </td>
                    <td className={`${TD} font-semibold text-slate-700 dark:text-slate-300`}>
                      <Link href="/xvip/tuyen-duong" className="hover:text-blue-600 hover:underline transition-colors">
                        {t.route?.name || 'Tuyến liên tỉnh'}
                      </Link>
                    </td>
                    <td className={`${TD} font-bold text-slate-900 dark:text-white`}>
                      {t.customerName || 'Khách lẻ'}
                    </td>
                    <td className={`${TD} tnum font-semibold text-slate-600 dark:text-slate-300`}>{t.phone}</td>
                    <td className={`${TD} ${NUM} text-slate-900 dark:text-white`}>{money(t.sellPrice)}đ</td>
                    <td className={`${TD} ${NUM} font-black text-red-600 dark:text-red-400`}>
                      {money(t.commission)}đ
                    </td>
                    <td className={`${TD} text-slate-800 dark:text-slate-300 font-semibold`}>
                      {t.staff?.fullName || 'NV'}
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {t.smsSent ? 'Đã gửi SMS' : 'Chưa gửi'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
