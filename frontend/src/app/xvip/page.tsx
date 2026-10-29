'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/features/auth/hooks';
import { DashboardOrdersModal } from '@/features/orders/components/DashboardOrdersModal';
import { useKpi, useOrders } from '@/features/orders/hooks';
import { useRoutes } from '@/features/routes/hooks';
import { useActiveStaff, useUsers } from '@/features/users/hooks';
import { Modal } from '@/features/xvip/Modal';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { CustomerTypeChart } from '@/features/xvip/customer-type-chart';
import { buildRouteStats } from '@/features/xvip/route-stats';
import { PartnerChart } from '@/features/xvip/partner-chart';
import { DateRangeFilter, rangeParams, useDateFilter } from '@/features/xvip/date-filter';

function MessageStat({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'blue' | 'cyan' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  }[tone];
  return (
    <div className={`rounded-xl px-2 py-4 ${colors}`}>
      <div className="tnum text-3xl font-black leading-none">{value.toLocaleString('vi-VN')}</div>
      <div className="mt-1.5 text-xs font-bold uppercase tracking-wide">{label}</div>
    </div>
  );
}

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
  // Đang mở danh sách vé của một tuyến hoặc một nhân viên
  const [selected, setSelected] = useState<
    | { kind: 'staff'; id: number; name: string }
    | { kind: 'partner'; name: string }
    | null
  >(null);
  const [showMessages, setShowMessages] = useState(false);
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
  const smsSentCount = kpiData?.smsSent ?? orders.filter((o) => o.smsSent).length;
  const zaloSentCount = kpiData?.zaloSent ?? orders.filter((o) => o.smsSent && o.messageChannel === 'ZALO').length;
  const smsOnlyCount = kpiData?.smsOnlySent ?? smsSentCount - zaloSentCount;

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
      label: 'Tin SMS đã gửi',
      value: `${smsSentCount} tin`,
      note: 'Bấm để xem chi tiết Zalo / SMS',
      color: 'from-cyan-600 to-cyan-700',
      borderBottom: '#0e7490',
      onClick: () => setShowMessages(true),
    },
  ];

  // Doanh số theo đối tác: lấy từ KPI (toàn bộ vé trong khoảng lọc), top theo doanh thu
  // Đối tác nhiều vé xếp trước; bằng vé thì hoa hồng cao hơn trước
  const carrierStats = useMemo(
    () => [...(kpiData?.byPartner ?? [])].sort((a, b) => b.seats - a.seats || b.commission - a.commission),
    [kpiData],
  );

  // Hai chiều của cùng một tuyến được gộp lại; trang "Tỷ lệ vé theo tuyến" hiển thị đầy đủ, ở đây chỉ để tách khách quen / lạ
  const routeStats = useMemo(() => buildRouteStats(kpiData?.byRoute ?? [], routes), [kpiData, routes]);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STATS.map(({ label, value, note, color, borderBottom, onClick }) => (
          <div
            key={label}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
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
            <PartnerChart data={carrierStats} onSelect={(name) => setSelected({ kind: 'partner', name })} />
          )}
        </Card>

        {/* Khách quen / khách lạ theo số điện thoại */}
        <Card title="Khách quen & khách lạ">
          <CustomerTypeChart data={kpiData?.byCustomerType} routes={routeStats} />
        </Card>

        {/* Nhân viên tổng đài */}
        <Card title="Nhân viên tổng đài">
          {staffPodium.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400">
              Chưa có nhân viên nào trong cơ sở dữ liệu.
            </div>
          ) : (
            <ol className="space-y-3 pt-1">
              {staffPodium.map((s, i) => (
                <li key={s.staffId || s.fullName}>
                <button
                  type="button"
                  onClick={() => s.staffId && setSelected({ kind: 'staff', id: s.staffId, name: s.fullName })}
                  title="Bấm để xem toàn bộ vé của nhân viên này"
                  className="flex w-full cursor-pointer items-center gap-3 text-sm rounded-lg p-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
                </button>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {showMessages && (
        <Modal title="Tin nhắn đã gửi cho khách" onClose={() => setShowMessages(false)}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MessageStat label="Tổng" value={smsSentCount} tone="slate" />
            <MessageStat label="Zalo" value={zaloSentCount} tone="blue" />
            <MessageStat label="SMS" value={smsOnlyCount} tone="cyan" />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            Tính theo khoảng ngày đang lọc, không gồm vé đã hủy. Mỗi vé tính một tin, kênh là kênh đã gửi thành công.
          </p>
        </Modal>
      )}

      {selected && (
        <DashboardOrdersModal
          title={
            selected.kind === 'partner' ? `Vé của đối tác ${selected.name}` : `Vé của nhân viên ${selected.name}`
          }
          filters={{
            staffId: selected.kind === 'staff' ? selected.id : 'all',
            routeId: 'all',
            partner: selected.kind === 'partner' ? selected.name : undefined,
            dateFrom: null,
            dateTo: null,
            ...dates,
          }}
          showRoute
          showStaff={selected.kind !== 'staff'}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
