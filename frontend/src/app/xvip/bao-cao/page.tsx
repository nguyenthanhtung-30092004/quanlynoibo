'use client';

import { useToast } from '@/features/xvip/toast';
import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardText,
  CurrencyCircleDollar,
  FileXls,
  HandCoins,
  Medal,
  Percent,
  Ticket,
  Trophy,
  X,
} from '@phosphor-icons/react';
import { useKpi, useKpiFilterOptions, useOrders } from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import type { Order, OrderFilters } from '@/features/orders/types';
import { OrderDetailModal } from '@/features/orders/components/OrderDetailModal';
import { useCurrentUser } from '@/features/auth/hooks';
import { useUsers } from '@/features/users/hooks';
import { useActiveRoutes } from '@/features/routes/hooks';
import { usePartners } from '@/features/partners/hooks';
import { money } from '@/features/xvip/data';
import { Avatar, Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { Pagination } from '@/features/xvip/Pagination';
import { ORDERS_PAGE_SIZE } from '@/features/orders/constants';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { MultiCheckSelect } from '@/features/xvip/MultiCheckSelect';
import { OptionFilterInput } from '@/features/xvip/OptionFilterInput';
import {
  DateRangeFilter,
  rangeParams,
  useDateFilter,
} from '@/features/xvip/date-filter';

/** Thẻ nhỏ cho một mục đang lọc, bấm × để bỏ */
function FilterChip({
  label,
  tone,
  onRemove,
}: {
  label: string;
  tone: 'blue' | 'amber';
  onRemove: () => void;
}) {
  const color =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200';
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-xs font-bold ${color}`}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ ${label}`}
        className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}

export default function StaffReportPage() {
  const [staffFilter, setStaffFilter] = useState('all');
  // Tuyến / đối tác chọn nhiều bằng ô tích; không chọn gì = tất cả
  const [routeIds, setRouteIds] = useState<number[]>([]);
  const [partnerIds, setPartnerIds] = useState<number[]>([]);

  // Khoảng ngày lấy từ nút ngày trên header; ở đây chỉ chọn lọc theo ngày đi hay ngày tạo vé
  const { range, basis } = useDateFilter();
  const dates = rangeParams(range, basis);

  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const { data: routeList = [] } = useActiveRoutes();
  const { data: partnerList = [] } = usePartners();

  // Ô nhân viên chỉ gợi ý người có đơn trong khoảng ngày đang lọc;
  // chọn một nhân viên thì ô tuyến / đối tác cũng chỉ gợi ý những mục người đó có đơn
  const staffSelected = isAdmin && staffFilter !== 'all';
  const { data: staffOptions } = useKpiFilterOptions(
    { ...dates, staffId: staffSelected ? Number(staffFilter) : undefined },
    isAdmin,
  );
  const activeStaffIds = staffOptions?.staffIds;
  const routeOptions = useMemo(() => {
    if (!staffSelected || !staffOptions) return routeList;
    const ids = new Set(staffOptions.routeIds);
    return routeList.filter((r) => ids.has(r.id));
  }, [staffSelected, staffOptions, routeList]);
  const partnerOptions = useMemo(() => {
    if (!staffSelected || !staffOptions) return partnerList;
    const names = new Set(staffOptions.partners.map((p) => p.toLowerCase()));
    return partnerList.filter((p) => names.has(p.name.trim().toLowerCase()));
  }, [staffSelected, staffOptions, partnerList]);

  const partnerNames = useMemo(
    () =>
      partnerList.filter((p) => partnerIds.includes(p.id)).map((p) => p.name),
    [partnerList, partnerIds],
  );

  const { data: kpiData, isLoading: kpiLoading } = useKpi(undefined, {
    ...dates,
    staffId: isAdmin && staffFilter !== 'all' ? Number(staffFilter) : undefined,
    routeIds,
    partners: partnerNames,
  });
  // API người dùng chỉ dành cho Admin
  const { data: usersData } = useUsers({ page: 1, search: '' }, isAdmin);
  const showToast = useToast();

  // Bảng vé chi tiết bên dưới: cùng bộ lọc với báo cáo (thời gian, nhân viên, tuyến, đối tác)
  const [ticketPage, setTicketPage] = useState(1);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const ticketFilters = useMemo<OrderFilters>(
    () => ({
      search: '',
      staffId: isAdmin && staffFilter !== 'all' ? Number(staffFilter) : 'all',
      routeId: 'all',
      routeIds,
      partners: partnerNames,
      dateFrom: null,
      dateTo: null,
      ...dates,
      page: ticketPage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, staffFilter, routeIds, partnerNames, dates.dateFrom, dates.dateTo, dates.departureFrom, dates.departureTo, ticketPage],
  );
  const { data: ticketData, isLoading: ticketsLoading } = useOrders(ticketFilters);
  const ticketList = ticketData?.data ?? [];
  const ticketTotal = ticketData?.total ?? 0;
  useEffect(() => {
    setTicketPage(1);
  }, [staffFilter, routeIds, partnerNames, range, basis]);

  const allStaff = useMemo(() => usersData?.data ?? [], [usersData]);
  const staffList = useMemo(() => {
    if (!activeStaffIds) return allStaff;
    const ids = new Set(activeStaffIds);
    return allStaff.filter((s) => ids.has(s.id));
  }, [allStaff, activeStaffIds]);

  // Đổi khoảng ngày mà nhân viên đang chọn không có đơn trong khoảng mới thì bỏ chọn
  useEffect(() => {
    if (staffSelected && activeStaffIds && !activeStaffIds.includes(Number(staffFilter))) {
      setStaffFilter('all');
      setRouteIds([]);
      setPartnerIds([]);
    }
  }, [staffSelected, activeStaffIds, staffFilter]);

  // Thành tích từng nhân viên theo đúng bộ lọc đang chọn (server đã lọc)
  const filteredStaff = useMemo(() => {
    // Nhân viên chỉ thấy số liệu của chính mình (server cũng đã lọc theo người đăng nhập)
    if (!isAdmin) {
      if (!me) return [];
      return [
        {
          id: me.id,
          name: me.fullName,
          orders: kpiData?.total ?? 0,
          tickets: kpiData?.seats ?? 0,
          revenue: kpiData?.revenue ?? 0,
          commission: kpiData?.commission ?? 0,
          deposit: kpiData?.deposit ?? 0,
        },
      ];
    }
    return (kpiData?.byStaff ?? []).map((s) => ({
      id: s.staffId,
      name: s.fullName,
      orders: s.total,
      tickets: s.seats,
      revenue: s.revenue ?? 0,
      commission: s.commission,
      deposit: s.deposit ?? 0,
    }));
  }, [kpiData, isAdmin, me]);

  const totalOrders = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.orders, 0),
    [filteredStaff],
  );
  const totalTickets = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.tickets, 0),
    [filteredStaff],
  );
  const totalRevenue = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.revenue, 0),
    [filteredStaff],
  );
  const totalCommission = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.commission, 0),
    [filteredStaff],
  );

  const totalDeposit = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.deposit, 0),
    [filteredStaff],
  );

  // Bảng xếp hạng: Admin xem số liệu đầy đủ theo bộ lọc; nhân viên xem thứ hạng của mọi người
  // nhưng chỉ có số đơn và vé (số liệu thẻ KPI phía trên vẫn là của riêng mình)
  const sortedStaff = useMemo(() => {
    if (!isAdmin) {
      return (kpiData?.ranking ?? []).map((r) => ({
        id: r.staffId,
        name: r.fullName,
        orders: r.total,
        tickets: r.seats,
        revenue: 0,
        commission: 0,
        deposit: 0,
      }));
    }
    return [...filteredStaff].sort((a, b) => b.tickets - a.tickets);
  }, [isAdmin, kpiData, filteredStaff]);

  // Vinh danh toàn hệ thống: server trả cho cả nhân viên, không phụ thuộc phần số liệu cá nhân
  const podium = kpiData?.leaderboard ?? [];

  // Xuất Excel đúng theo bộ lọc đang chọn (chỉ Admin; server cũng chặn nhân viên)
  const handleExportExcel = async () => {
    try {
      const filters: OrderFilters = {
        search: '',
        staffId: isAdmin && staffFilter !== 'all' ? Number(staffFilter) : 'all',
        routeId: 'all',
        routeIds,
        partners: partnerNames,
        dateFrom: null,
        dateTo: null,
        ...dates,
        page: 1,
      };
      const { blob, filename } = await ordersApi.exportExcel(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất báo cáo ra file Excel thành công!');
    } catch {
      showToast('Lỗi khi xuất file Excel từ máy chủ.');
    }
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            {isAdmin && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
              >
                <FileXls size={18} weight="bold" /> Xuất Excel
              </button>
            )}
          </div>
        }
      >
        Báo cáo hiệu suất &amp; Doanh số nhân viên
      </PageTitle>

      {/* 3D Filter Bar */}
      <Card className="print:hidden">
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="block min-w-64 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Thời gian
            </span>
            <DateRangeFilter align="right" />
          </div>

          {isAdmin && (
            <label className="block min-w-44 flex-1">
              <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nhân viên
              </span>
              <OptionFilterInput
                options={staffList.map((s) => ({
                  value: String(s.id),
                  label: `${s.fullName} (${s.username})`,
                }))}
                value={staffFilter === 'all' ? '' : staffFilter}
                allLabel="Tất cả nhân viên"
                onChange={(v) => {
                  setStaffFilter(v || 'all');
                  // Đổi nhân viên thì bỏ tuyến / đối tác đã chọn vì có thể người mới không có
                  setRouteIds([]);
                  setPartnerIds([]);
                }}
              />
            </label>
          )}

          <div className="block min-w-48 sm:min-w-56 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tuyến đường
            </span>
            <MultiCheckSelect
              options={routeOptions.map((r) => ({ value: r.id, label: r.name }))}
              value={routeIds}
              onChange={setRouteIds}
              allLabel="Tất cả tuyến"
              searchPlaceholder="Tìm tuyến..."
            />
          </div>

          <div className="block min-w-44 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Đối tác
            </span>
            <MultiCheckSelect
              options={partnerOptions.map((p) => ({ value: p.id, label: p.name }))}
              value={partnerIds}
              onChange={setPartnerIds}
              allLabel="Tất cả đối tác"
              searchPlaceholder="Tìm đối tác..."
            />
          </div>
        </div>

        {(routeIds.length > 0 || partnerIds.length > 0) && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Đang lọc:
            </span>
            {routeList
              .filter((r) => routeIds.includes(r.id))
              .map((r) => (
                <FilterChip
                  key={`r${r.id}`}
                  tone="blue"
                  label={r.name}
                  onRemove={() =>
                    setRouteIds((prev) => prev.filter((x) => x !== r.id))
                  }
                />
              ))}
            {partnerList
              .filter((p) => partnerIds.includes(p.id))
              .map((p) => (
                <FilterChip
                  key={`p${p.id}`}
                  tone="amber"
                  label={p.name}
                  onRemove={() =>
                    setPartnerIds((prev) => prev.filter((x) => x !== p.id))
                  }
                />
              ))}
            <button
              type="button"
              className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 hover:underline dark:text-slate-400"
              onClick={() => {
                setRouteIds([]);
                setPartnerIds([]);
              }}
            >
              Xóa lọc tuyến &amp; đối tác
            </button>
          </div>
        )}
      </Card>

      {/* 3D KPI Metrics Cards */}
      <div className={`mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #6b21a8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <ClipboardText size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Tổng số đơn
            </div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {totalOrders.toLocaleString('vi-VN')} đơn
            </div>
            <div className="text-[11px] font-medium text-white/90">
              Mỗi đơn có thể gồm nhiều vé
            </div>
          </div>
        </div>

        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Ticket size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Tổng vé bán ra
            </div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {totalTickets.toLocaleString('vi-VN')} vé
            </div>
            <div className="text-[11px] font-medium text-white/90">
              Tính theo số ghế của từng đơn
            </div>
          </div>
        </div>

        {isAdmin && (
          <div
            style={{
              boxShadow:
                'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #15803d, 0 12px 24px -4px rgba(15,23,42,0.18)',
            }}
            className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
              <CurrencyCircleDollar size={26} weight="fill" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Tổng doanh thu vé
              </div>
              <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
                {money(totalRevenue)}đ
              </div>
              <div className="text-[11px] font-medium text-white/90">
                Giá trị vé khách thanh toán
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #0f766e, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-teal-600 to-teal-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <HandCoins size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Tổng tiền đã cọc
            </div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalDeposit)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">
              Khách đã đặt cọc trước
            </div>
          </div>
        </div>

        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #b45309, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Percent size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Doanh số
            </div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalCommission)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">
              Lợi nhuận gộp từ đơn vé
            </div>
          </div>
        </div>
      </div>

      {/* 3D Podium: Top 3 Nhân Viên Xuất Sắc Nhất */}
      {podium.length > 0 && podium[0].seats > 0 && (
        <Card title="Vinh danh nhân viên bán vé xuất sắc" className="mt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-2">
            {/* Top 2 */}
            {podium[1] && (
              <div className="flex flex-col items-center justify-end rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center order-2 md:order-1">
                <Medal
                  size={28}
                  weight="fill"
                  className="text-slate-400 mb-2"
                />
                <Avatar name={podium[1].fullName} />
                <span className="mt-2 font-black text-slate-900 dark:text-white text-base">
                  {podium[1].fullName}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Á quân bán vé
                </span>
                <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="text-xs text-slate-500">
                    Số lượng:{' '}
                    <strong>
                      {podium[1].total} đơn · {podium[1].seats} vé
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Top 1 Quán Quân */}
            <div className="flex flex-col items-center justify-end rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 p-5 border-2 border-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.2)] text-center order-1 md:order-2">
              <Trophy
                size={36}
                weight="fill"
                className="text-amber-500 mb-2 animate-bounce"
              />
              <Avatar name={podium[0].fullName} />
              <span className="mt-2 font-black text-slate-900 dark:text-white text-lg">
                {podium[0].fullName}
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Quán quân toàn hệ thống
              </span>
              <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-3 border border-amber-300 dark:border-amber-700 shadow-inner">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Đạt:{' '}
                  <strong>
                    {podium[0].total} đơn · {podium[0].seats} vé
                  </strong>
                </div>
              </div>
            </div>

            {/* Top 3 */}
            {podium[2] && (
              <div className="flex flex-col items-center justify-end rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center order-3">
                <Medal
                  size={28}
                  weight="fill"
                  className="text-amber-700 mb-2"
                />
                <Avatar name={podium[2].fullName} />
                <span className="mt-2 font-black text-slate-900 dark:text-white text-base">
                  {podium[2].fullName}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Hạng ba
                </span>
                <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="text-xs text-slate-500">
                    Số lượng:{' '}
                    <strong>
                      {podium[2].total} đơn · {podium[2].seats} vé
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 3D Table List */}
      <Card className="mt-5 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Thứ hạng</th>
                <th className={TH}>Nhân viên</th>
                <th className={`${TH} text-right`}>Số đơn</th>
                <th className={`${TH} text-right`}>Số vé bán ra</th>
                {isAdmin && (
                  <th className={`${TH} text-right`}>Tổng doanh thu vé</th>
                )}
                {isAdmin && (
                  <>
                    <th className={`${TH} text-right`}>Tiền đã cọc</th>
                    <th className={`${TH} text-right`}>Hoa hồng đạt được</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {kpiLoading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 4}
                    className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                  >
                    Đang tải dữ liệu báo cáo hiệu suất từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : sortedStaff.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 4}
                    className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Không có dữ liệu nào khớp bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                sortedStaff.map((staff, index) => {
                  return (
                    <tr
                      key={staff.id || staff.name}
                      className={`hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors ${
                        !isAdmin && staff.id === me?.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      <td className={`${TD} font-black text-center`}>
                        {index === 0 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-sm">
                            1
                          </span>
                        ) : index === 1 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-300 text-slate-900 text-xs font-black shadow-sm">
                            2
                          </span>
                        ) : index === 2 ? (
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-600 text-white text-xs font-black shadow-sm">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            {index + 1}
                          </span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={staff.name} />
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {staff.name}
                            </span>
                            {!isAdmin && staff.id === me?.id && (
                              <span className="ml-2 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                                Bạn
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`${TD} text-right font-bold text-purple-700 dark:text-purple-400 tnum`}
                      >
                        {staff.orders.toLocaleString('vi-VN')} đơn
                      </td>
                      <td
                        className={`${TD} text-right font-black text-blue-700 dark:text-blue-400 tnum`}
                      >
                        {staff.tickets.toLocaleString('vi-VN')} vé
                      </td>
                      {isAdmin && (
                        <td
                          className={`${TD} text-right font-bold text-slate-900 dark:text-white tnum`}
                        >
                          {money(staff.revenue)}đ
                        </td>
                      )}
                      {isAdmin && (
                        <>
                          <td
                            className={`${TD} text-right font-bold text-teal-700 dark:text-teal-400 tnum`}
                          >
                            {money(staff.deposit)}đ
                          </td>
                          <td
                            className={`${TD} text-right font-black text-emerald-600 dark:text-emerald-400 tnum`}
                          >
                            {money(staff.commission)}đ
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bảng vé: toàn bộ vé khớp bộ lọc (chọn nhân viên thì ra mọi vé của người đó) */}
      <Card
        title={`Danh sách vé (${ticketTotal.toLocaleString('vi-VN')})`}
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
                <th className={`${TH} text-right`}>Giá bán</th>
                <th className={`${TH} text-right`}>Đã cọc</th>
                <th className={`${TH} text-right`}>Hoa hồng</th>
                <th className={TH}>NV tạo</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                  >
                    Đang tải danh sách vé...
                  </td>
                </tr>
              ) : ticketList.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Không có vé nào khớp bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                ticketList.map((t, i) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetailOrder(t)}
                    title="Bấm để xem chi tiết"
                    className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ${
                      t.cancelledAt ? 'bg-slate-50 opacity-60 dark:bg-slate-900/60' : ''
                    }`}
                  >
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>
                      {(ticketPage - 1) * ORDERS_PAGE_SIZE + i + 1}
                    </td>
                    <td className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                      {formatOrderCode(t.id)}
                      {t.cancelledAt && (
                        <span className="mt-1 block w-fit rounded-md bg-rose-100 px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Đã hủy
                        </span>
                      )}
                    </td>
                    <td className={`${TD} font-bold text-blue-700 dark:text-blue-400`}>
                      {t.departureTime}
                      <span className="mt-0.5 block text-[13px] font-bold text-slate-800 dark:text-slate-200">
                        {formatDateVN(t.departureDate)}
                      </span>
                    </td>
                    <td className={`${TD} font-bold text-slate-800 dark:text-slate-200`}>
                      {t.partner || 'XVIP'}
                    </td>
                    <td className={`${TD} font-semibold text-slate-700 dark:text-slate-300`}>
                      {t.route?.name || 'Tuyến liên tỉnh'}
                    </td>
                    <td className={`${TD} font-bold text-slate-900 dark:text-white`}>
                      {t.customerName || 'Khách lẻ'}
                    </td>
                    <td className={`${TD} tnum font-semibold text-slate-600 dark:text-slate-300`}>
                      {t.phone}
                    </td>
                    <td className={`${TD} ${NUM} text-slate-900 dark:text-white`}>
                      {money(t.sellPrice)}đ
                    </td>
                    <td className={`${TD} ${NUM} text-teal-700 dark:text-teal-400`}>
                      {money(t.deposit)}đ
                    </td>
                    <td className={`${TD} ${NUM} font-black text-red-600 dark:text-red-400`}>
                      {money(t.commission)}đ
                    </td>
                    <td className={`${TD} text-slate-800 dark:text-slate-300 font-semibold`}>
                      {t.staff?.fullName || 'NV'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!ticketsLoading && ticketTotal > 0 && (
          <Pagination
            page={ticketPage}
            pageSize={ORDERS_PAGE_SIZE}
            total={ticketTotal}
            onChange={setTicketPage}
          />
        )}
      </Card>

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}
    </>
  );
}
