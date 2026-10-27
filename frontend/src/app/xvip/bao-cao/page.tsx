'use client';

import { useToast } from '@/features/xvip/toast';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ClipboardText,
  FileXls,
  HandCoins,
  Medal,
  Percent,
  Ticket,
  TrendUp,
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
import { ORDERS_ALL_SIZE } from '@/features/orders/constants';
import { ScrollTable } from '@/features/xvip/ScrollTable';
import {
  ThCommission,
  ThCustomerName,
  ThDeposit,
  ThDepartureTime,
  ThOrderCode,
  ThPartner,
  ThPhone,
  ThRoute,
  ThSellPrice,
  ThSms,
  ThValueList,
  ThStaff,
} from '@/features/xvip/OrderColumnFilters';
import { formatDateVN, formatDateTimeShort, formatOrderCode } from '@/lib/format';
import { MultiCheckSelect } from '@/features/xvip/MultiCheckSelect';
import { OptionFilterInput } from '@/features/xvip/OptionFilterInput';
import {
  DateRangeFilter,
  rangeParams,
  useDateFilter,
} from '@/features/xvip/date-filter';

/** Thẻ nhỏ cho một mục đang lọc, bấm × để bỏ */
/** Bộ lọc cột chọn theo danh sách giá trị, dọn đi khi đổi khoảng ngày */
const VALUE_LIST_FILTER_KEYS = [
  'deposits',
  'sellPrices',
  'commissions',
  'entryDates',
  'departureDates',
  'vehicleTypes',
  'notes',
  'pickupPoints',
  'dropoffPoints',
  'cancelReasons',
  'seatFronts',
  'seatMiddles',
  'seatBacks',
  'seatCounts',
  'costPrices',
  'collectOnDeliveries',
] as const satisfies ReadonlyArray<keyof OrderFilters>;

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
  );
  const activeStaffIds = staffOptions?.staffIds;
  const routeOptions = useMemo(() => {
    if (!staffOptions) return routeList;
    const ids = new Set(staffOptions.routeIds);
    return routeList.filter((r) => ids.has(r.id));
  }, [staffOptions, routeList]);
  const partnerOptions = useMemo(() => {
    if (!staffOptions) return partnerList;
    const names = new Set(staffOptions.partners.map((p) => p.toLowerCase()));
    return partnerList.filter((p) => names.has(p.name.trim().toLowerCase()));
  }, [staffOptions, partnerList]);

  const partnerNames = useMemo(
    () =>
      partnerList.filter((p) => partnerIds.includes(p.id)).map((p) => p.name),
    [partnerList, partnerIds],
  );

  // Bộ lọc theo cột của bảng đơn (giống trang Quản lý vé)
  const [colFilters, setColFilters] = useState<Partial<OrderFilters>>({});

  const colPartners = useMemo(() => {
    const list = [...(colFilters.partners ?? [])];
    if (colFilters.partner && !list.includes(colFilters.partner)) {
      list.push(colFilters.partner);
    }
    return list;
  }, [colFilters.partners, colFilters.partner]);

  const effectivePartners = useMemo(() => {
    return Array.from(new Set([...partnerNames, ...colPartners]));
  }, [partnerNames, colPartners]);

  const colStaffIds = useMemo(() => {
    const list = [...(colFilters.staffIds ?? [])];
    if (typeof colFilters.staffId === 'number' && colFilters.staffId > 0 && !list.includes(colFilters.staffId)) {
      list.push(colFilters.staffId);
    }
    return list;
  }, [colFilters.staffIds, colFilters.staffId]);

  const effectiveStaffIds = useMemo(() => {
    const topIds = isAdmin && staffFilter !== 'all' ? [Number(staffFilter)] : [];
    return Array.from(new Set([...topIds, ...colStaffIds]));
  }, [isAdmin, staffFilter, colStaffIds]);

  const { data: kpiData, isLoading: kpiLoading } = useKpi(undefined, {
    ...dates,
    staffId: effectiveStaffIds.length === 1 ? effectiveStaffIds[0] : undefined,
    staffIds: effectiveStaffIds.length > 0 ? effectiveStaffIds : undefined,
    routeIds,
    partners: effectivePartners.length > 0 ? effectivePartners : undefined,
  });
  // API người dùng chỉ dành cho Admin
  const { data: usersData } = useUsers({ page: 1, search: '' }, isAdmin);
  const showToast = useToast();

  // Bảng vé chi tiết bên dưới: cùng bộ lọc với báo cáo (thời gian, nhân viên, tuyến, đối tác)
  // Bấm thẻ "Đã cọc xvip" thì bảng đơn chỉ còn các đơn khách đã cọc
  const [depositOnly, setDepositOnly] = useState(false);
  const orderListRef = useRef<HTMLDivElement>(null);
  const toggleDepositOnly = () => {
    const next = !depositOnly;
    setDepositOnly(next);
    // Bật lọc thì cuộn xuống bảng đơn để xem ngay
    if (next) {
      requestAnimationFrame(() =>
        orderListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const ticketFilters = useMemo<OrderFilters>(() => {
    // Lọc tuyến ở cột giao với tuyến đã chọn ở bộ lọc trên cùng
    const colRoutes = colFilters.routeIds ?? [];
    let effectiveRoutes = routeIds;
    if (colRoutes.length) {
      if (routeIds.length) {
        const both = colRoutes.filter((id) => routeIds.includes(id));
        effectiveRoutes = both.length ? both : [-1];
      } else {
        effectiveRoutes = colRoutes;
      }
    }
    return {
      search: '',
      routeId: 'all',
      partners: effectivePartners.length > 0 ? effectivePartners : undefined,
      activeOnly: true,
      depositOnly,
      dateFrom: null,
      dateTo: null,
      ...colFilters,
      staffId: effectiveStaffIds.length === 1 ? effectiveStaffIds[0] : 'all',
      staffIds: effectiveStaffIds.length > 0 ? effectiveStaffIds : undefined,
      routeIds: effectiveRoutes,
      ...dates,
      // Không phân trang: tải hết đơn khớp bộ lọc
      page: 1,
      pageSize: ORDERS_ALL_SIZE,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, depositOnly, colFilters, effectivePartners, effectiveStaffIds, routeIds]);
  const colProps = {
    local: {
      search: '',
      staffId: effectiveStaffIds.length === 1 ? effectiveStaffIds[0] : 'all',
      staffIds: effectiveStaffIds,
      routeId: 'all',
      routeIds: ticketFilters.routeIds ?? [],
      partner: effectivePartners.length === 1 ? effectivePartners[0] : undefined,
      partners: effectivePartners,
      dateFrom: null,
      dateTo: null,
      ...colFilters,
      depositOnly,
    } as OrderFilters,
    filters: ticketFilters,
    onChange: (patch: Partial<OrderFilters>) => {
      // Lọc "Đã cọc" dùng chung trạng thái với thẻ Đã cọc xvip ở trên
      const { depositOnly: dep, ...rest } = patch;
      if ('depositOnly' in patch) setDepositOnly(!!dep);
      if ('partners' in patch) {
        const nextPartners = patch.partners ?? [];
        const nextIds = partnerList.filter((p) => nextPartners.includes(p.name)).map((p) => p.id);
        setPartnerIds(nextIds);
      }
      if ('staffIds' in patch) {
        const nextStaff = patch.staffIds ?? [];
        setStaffFilter(nextStaff.length === 1 ? String(nextStaff[0]) : (nextStaff.length === 0 ? 'all' : staffFilter));
      }
      if (Object.keys(rest).length) setColFilters((prev) => ({ ...prev, ...rest }));
    },
  };
  const { data: ticketData, isLoading: ticketsLoading } = useOrders(ticketFilters);
  const ticketList = ticketData?.data ?? [];
  const ticketTotal = ticketData?.total ?? 0;

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

  // Đổi ngày thì dọn các lựa chọn theo giá trị (mức tiền, ngày, ghế, văn bản...) không còn hợp lệ
  useEffect(() => {
    setColFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of VALUE_LIST_FILTER_KEYS) {
        if (next[key]?.length) {
          next[key] = undefined;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [range, basis]);

  // Đổi ngày / nhân viên mà tuyến hoặc đối tác đang chọn không còn đơn thì bỏ chọn mục đó
  useEffect(() => {
    if (!staffOptions) return;
    const routeOk = new Set(staffOptions.routeIds);
    const partnerOk = new Set(staffOptions.partners.map((p) => p.toLowerCase()));
    setRouteIds((prev) => {
      const next = prev.filter((id) => routeOk.has(id));
      return next.length === prev.length ? prev : next;
    });
    setPartnerIds((prev) => {
      const next = prev.filter((id) => {
        const name = partnerList.find((p) => p.id === id)?.name.trim().toLowerCase();
        return !!name && partnerOk.has(name);
      });
      return next.length === prev.length ? prev : next;
    });
    setColFilters((prev) => {
      let changed = false;
      const next = { ...prev };
      if (prev.staffIds?.length) {
        const keepStaff = prev.staffIds.filter((id) => staffOptions.staffIds.includes(id));
        if (keepStaff.length !== prev.staffIds.length) {
          next.staffIds = keepStaff;
          changed = true;
        }
      }
      if (prev.partners?.length) {
        const keepPartners = prev.partners.filter(
          (name) => partnerOk.has(name.trim().toLowerCase()) || name.toLowerCase() === 'xvip',
        );
        if (keepPartners.length !== prev.partners.length) {
          next.partners = keepPartners;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [staffOptions, partnerList]);

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
  // Cần cố gắng: chỉ hiện khi bảng vinh danh hiện (cả kỳ có người bán được vé), nên hai mục luôn đi cùng nhau
  const needsEffort = podium.length > 0 && podium[0].seats > 0 ? (kpiData?.needsEffort ?? []) : [];

  // Xuất Excel đúng theo bộ lọc đang chọn (chỉ Admin; server cũng chặn nhân viên)
  const handleExportExcel = async () => {
    try {
      const filters: OrderFilters = {
        search: '',
        staffId: effectiveStaffIds.length === 1 ? effectiveStaffIds[0] : 'all',
        staffIds: effectiveStaffIds.length > 0 ? effectiveStaffIds : undefined,
        routeId: 'all',
        routeIds: ticketFilters.routeIds,
        partners: effectivePartners.length > 0 ? effectivePartners : undefined,
        dateFrom: null,
        dateTo: null,
        ...colFilters,
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
                value={
                  effectiveStaffIds.length === 1
                    ? String(effectiveStaffIds[0])
                    : staffFilter === 'all'
                      ? ''
                      : staffFilter
                }
                customLabel={
                  effectiveStaffIds.length > 1
                    ? `${effectiveStaffIds.length} đã chọn`
                    : undefined
                }
                allLabel="Tất cả nhân viên"
                onChange={(v) => {
                  setStaffFilter(v || 'all');
                  setColFilters((prev) => ({
                    ...prev,
                    staffId: v ? Number(v) : 'all',
                    staffIds: v ? [Number(v)] : [],
                  }));
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
              onChange={(ids) => {
                setPartnerIds(ids);
                const names = partnerList.filter((p) => ids.includes(p.id)).map((p) => p.name);
                setColFilters((prev) => ({ ...prev, partners: names }));
              }}
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
                setColFilters((prev) => ({ ...prev, routeIds: [], partners: [], partner: undefined }));
              }}
            >
              Xóa lọc tuyến &amp; đối tác
            </button>
          </div>
        )}
      </Card>

      {/* 3D KPI Metrics Cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #6b21a8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex min-w-0 items-center gap-3 sm:gap-3.5 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-700 p-3.5 sm:p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-10 sm:size-11 xl:size-10 2xl:size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <ClipboardText size={22} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-xs font-semibold uppercase tracking-wider text-white/80 leading-tight">
              Tổng số đơn
            </div>
            <div className="tnum whitespace-nowrap text-lg sm:text-xl xl:text-lg 2xl:text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-tight my-0.5">
              {totalOrders.toLocaleString('vi-VN')} đơn
            </div>
            <div className="break-words text-[11px] font-medium text-white/90 leading-tight">
              Mỗi đơn có thể gồm nhiều vé
            </div>
          </div>
        </div>

        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex min-w-0 items-center gap-3 sm:gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-3.5 sm:p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-10 sm:size-11 xl:size-10 2xl:size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Ticket size={22} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-xs font-semibold uppercase tracking-wider text-white/80 leading-tight">
              Tổng vé bán ra
            </div>
            <div className="tnum whitespace-nowrap text-lg sm:text-xl xl:text-lg 2xl:text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-tight my-0.5">
              {totalTickets.toLocaleString('vi-VN')} vé
            </div>
            <div className="break-words text-[11px] font-medium text-white/90 leading-tight">
              Tính theo số ghế của từng đơn
            </div>
          </div>
        </div>

        {isAdmin && (
        <div
          role="button"
          tabIndex={0}
          aria-pressed={depositOnly}
          title={depositOnly ? 'Bấm để xem lại tất cả đơn' : 'Bấm để chỉ xem các đơn khách đã cọc'}
          onClick={toggleDepositOnly}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDepositOnly();
            }
          }}
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #0f766e, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className={`group relative flex min-w-0 items-center gap-3 sm:gap-3.5 rounded-2xl bg-gradient-to-b from-teal-600 to-teal-700 p-3.5 sm:p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none ${
            depositOnly ? 'ring-4 ring-teal-300 dark:ring-teal-400' : ''
          }`}
        >
          <span className="flex size-10 sm:size-11 xl:size-10 2xl:size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <HandCoins size={22} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-xs font-semibold uppercase tracking-wider text-white/80 leading-tight">
              Đã cọc xvip
            </div>
            <div className="tnum whitespace-nowrap text-lg sm:text-xl xl:text-lg 2xl:text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-tight my-0.5">
              {money(totalDeposit)}đ
            </div>
            <div className="break-words text-[11px] font-medium text-white/90 leading-tight">
              {depositOnly ? 'Đang lọc đơn đã cọc · bấm để bỏ lọc' : 'Bấm để xem các đơn đã cọc'}
            </div>
          </div>
        </div>
        )}

        <div
          style={{
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #b45309, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex min-w-0 items-center gap-3 sm:gap-3.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 p-3.5 sm:p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-10 sm:size-11 xl:size-10 2xl:size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Percent size={22} weight="fill" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-xs font-semibold uppercase tracking-wider text-white/80 leading-tight">
              Doanh số
            </div>
            <div className="tnum whitespace-nowrap text-lg sm:text-xl xl:text-lg 2xl:text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] leading-tight my-0.5">
              {money(totalCommission)}đ
            </div>
            <div className="break-words text-[11px] font-medium text-white/90 leading-tight">
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

      {/* Top nhân viên cần cố gắng: nằm ngay dưới bảng vinh danh, top 1 là người ít vé nhất */}
      {needsEffort.length > 0 && (
        <Card title="Nhân viên cần cố gắng thêm" className="mt-5">
          <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-3">
            {needsEffort.map((p, i) => {
              const tone = [
                {
                  box: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
                  badge: 'bg-rose-500 text-white',
                  text: 'text-rose-700 dark:text-rose-300',
                  label: 'Cần cố gắng nhất',
                },
                {
                  box: 'border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30',
                  badge: 'bg-orange-500 text-white',
                  text: 'text-orange-700 dark:text-orange-300',
                  label: 'Cần cố gắng thứ hai',
                },
                {
                  box: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
                  badge: 'bg-amber-500 text-white',
                  text: 'text-amber-700 dark:text-amber-300',
                  label: 'Cần cố gắng thứ ba',
                },
              ][i];
              return (
                <div
                  key={p.staffId}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm ${tone.box}`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${tone.badge}`}
                    aria-label={`Top ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-black text-slate-900 dark:text-white">{p.fullName}</div>
                    <div className={`text-xs font-bold ${tone.text}`}>
                      Top {i + 1} · {tone.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {p.total === 0 && p.seats === 0 ? (
                        <strong>Chưa có đơn nào</strong>
                      ) : (
                        <strong>
                          {p.total} đơn · {p.seats} vé
                        </strong>
                      )}
                    </div>
                  </div>
                  <TrendUp size={22} weight="bold" className={`shrink-0 ${tone.text}`} />
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Cố lên! Bán thêm vé là sẽ rời khỏi danh sách này. Danh sách xếp theo số vé ít nhất (bằng vé thì theo số đơn).
          </p>
        </Card>
      )}

      {/* 3D Table List */}
      <Card className="mt-5 !p-0 overflow-hidden">
        {/* Điện thoại: danh sách thẻ, tên xuống dòng đầy đủ */}
        <ol className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {kpiLoading ? (
            <li className="p-6 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
              Đang tải dữ liệu báo cáo hiệu suất...
            </li>
          ) : sortedStaff.length === 0 ? (
            <li className="p-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
              Không có dữ liệu nào khớp bộ lọc đã chọn.
            </li>
          ) : (
            sortedStaff.map((staff, index) => (
              <li
                key={staff.id || staff.name}
                className={`flex items-start gap-3 px-3 py-3 ${
                  !isAdmin && staff.id === me?.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                }`}
              >
                <span
                  className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm ${
                    index === 0
                      ? 'bg-amber-400 text-slate-950'
                      : index === 1
                        ? 'bg-slate-300 text-slate-900'
                        : index === 2
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {index + 1}
                </span>
                <Avatar name={staff.name} />
                <div className="min-w-0 flex-1">
                  <div className="break-words font-extrabold text-slate-900 dark:text-white">
                    {staff.name}
                    {!isAdmin && staff.id === me?.id && (
                      <span className="ml-2 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
                        Bạn
                      </span>
                    )}
                  </div>
                  <div className="tnum mt-0.5 text-xs font-bold">
                    <span className="text-purple-700 dark:text-purple-400">
                      {staff.orders.toLocaleString('vi-VN')} đơn
                    </span>
                    <span className="text-slate-400"> · </span>
                    <span className="text-blue-700 dark:text-blue-400">
                      {staff.tickets.toLocaleString('vi-VN')} vé
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="tnum mt-1 flex flex-wrap items-center justify-between gap-x-3 text-xs font-bold">
                      <span className="text-teal-700 dark:text-teal-400">
                        Cọc xvip: {money(staff.deposit)}đ
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        DS: {money(staff.commission)}đ
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))
          )}
        </ol>

        {/* Máy tính: bảng đầy đủ cột */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>Thứ hạng</th>
                <th className={TH}>Nhân viên</th>
                <th className={`${TH} text-right`}>Số đơn</th>
                <th className={`${TH} text-right`}>Tổng vé</th>
                {isAdmin && (
                  <>
                    <th className={`${TH} text-right`}>Đã cọc xvip</th>
                    <th className={`${TH} text-right`}>Doanh số</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {kpiLoading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 4}
                    className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                  >
                    Đang tải dữ liệu báo cáo hiệu suất từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : sortedStaff.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 4}
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

      {/* Bảng đơn: toàn bộ đơn khớp bộ lọc (chọn nhân viên thì ra mọi đơn của người đó) */}
      <div ref={orderListRef} className="scroll-mt-20" />
      <Card
        title={`${depositOnly ? 'Danh sách đơn đã cọc xvip' : 'Danh sách đơn'} (${ticketTotal.toLocaleString('vi-VN')})`}
        className="mt-5 !p-0 overflow-clip"
      >
        <ScrollTable>
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <ThOrderCode {...colProps} />
                <ThValueList title="Ngày vào sổ" column="entryDate" field="entryDates" {...colProps} />
                <ThStaff showFilter={isAdmin} {...colProps} />
                <ThCustomerName {...colProps} />
                <ThPhone {...colProps} />
                <ThRoute {...colProps} />
                <ThDepartureTime {...colProps} />
                <ThValueList title="Ngày khởi hành" column="departureDate" field="departureDates" {...colProps} />
                <ThValueList title="Loại hình" column="vehicleType" field="vehicleTypes" {...colProps} />
                <ThValueList title="Ghế đầu" column="seatFront" field="seatFronts" numeric {...colProps} />
                <ThValueList title="Ghế giữa" column="seatMiddle" field="seatMiddles" numeric {...colProps} />
                <ThValueList title="Ghế cuối" column="seatBack" field="seatBacks" numeric {...colProps} />
                <ThValueList title="Số ghế" column="seatCount" field="seatCounts" numeric {...colProps} />
                <ThValueList title="Giá nhập" column="costPrice" field="costPrices" numeric right {...colProps} />
                <ThSellPrice {...colProps} />
                {isAdmin && <ThDeposit {...colProps} />}
                <ThValueList title="Nhờ thu" column="collectOnDelivery" field="collectOnDeliveries" numeric right {...colProps} />
                <ThCommission {...colProps} title="Doanh số" />
                <ThPartner {...colProps} />
                <ThValueList title="Ghi chú" column="note" field="notes" {...colProps} />
                <ThValueList title="Điểm đón" column="pickupPoint" field="pickupPoints" {...colProps} />
                <ThValueList title="Điểm trả" column="dropoffPoint" field="dropoffPoints" {...colProps} />
                <ThSms {...colProps} />
                <ThValueList title="Lý do hủy" column="cancelReason" field="cancelReasons" {...colProps} />
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 25 : 24}
                    className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                  >
                    Đang tải danh sách đơn...
                  </td>
                </tr>
              ) : ticketList.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 25 : 24}
                    className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                  >
                    Không có đơn nào khớp bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                ticketList.map((t, i) => (
                  <tr
                    key={t.id}
                    onClick={() => setDetailOrder(t)}
                    title="Bấm để xem chi tiết"
                    className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ${
                      t.cancelledAt ? 'order-row-cancelled bg-rose-50/60 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>
                      {i + 1}
                    </td>
                    <td className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                      {formatOrderCode(t.id)}
                      {t.cancelledAt && (
                        <span className="cancel-badge mt-1 block w-fit rounded-md bg-rose-100 px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Đã hủy
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-slate-700 dark:text-slate-300 tnum`}>
                      {formatDateVN(t.entryDate)}
                    </td>
                    <td className={`${TD} text-slate-800 dark:text-slate-300 font-semibold`}>
                      {t.staff?.fullName || 'NV'}
                    </td>
                    <td className={`${TD} w-48 min-w-48 max-w-48 !whitespace-normal [overflow-wrap:anywhere] font-bold text-slate-900 dark:text-white`}>
                      {t.customerName || 'Khách lẻ'}
                    </td>
                    <td className={`${TD} tnum font-semibold text-slate-600 dark:text-slate-300`}>
                      {t.phone}
                    </td>
                    <td className={`${TD} font-semibold text-slate-700 dark:text-slate-300`}>
                      {t.route?.name || 'Tuyến liên tỉnh'}
                    </td>
                    <td className={`${TD} font-bold text-blue-700 dark:text-blue-400 tnum`}>
                      {t.departureTime}
                    </td>
                    <td className={`${TD} text-slate-800 dark:text-slate-200 font-bold tnum`}>
                      {formatDateVN(t.departureDate)}
                    </td>
                    <td className={`${TD} text-slate-700 dark:text-slate-300`}>
                      {t.vehicleType || '—'}
                    </td>
                    <td className={`${TD} text-center tnum text-slate-700 dark:text-slate-300`}>
                      {t.seatFront ?? 0}
                    </td>
                    <td className={`${TD} text-center tnum text-slate-700 dark:text-slate-300`}>
                      {t.seatMiddle ?? 0}
                    </td>
                    <td className={`${TD} text-center tnum text-slate-700 dark:text-slate-300`}>
                      {t.seatBack ?? 0}
                    </td>
                    <td className={`${TD} text-center font-bold tnum text-slate-800 dark:text-slate-200`}>
                      {t.seatCount ?? 0}
                    </td>
                    <td className={`${TD} ${NUM} text-slate-700 dark:text-slate-300`}>
                      {money(t.costPrice)}đ
                    </td>
                    <td className={`${TD} ${NUM} text-slate-900 dark:text-white`}>
                      {money(t.sellPrice)}đ
                    </td>
                    {isAdmin && (
                      <td className={`${TD} ${NUM} text-teal-700 dark:text-teal-400 font-bold`}>
                        {money(t.deposit)}đ
                      </td>
                    )}
                    <td className={`${TD} ${NUM} text-slate-700 dark:text-slate-300 font-semibold`}>
                      {money(t.collectOnDelivery)}đ
                    </td>
                    <td className={`${TD} ${NUM} font-black text-red-600 dark:text-red-400`}>
                      {money(t.commission)}đ
                    </td>
                    <td className={`${TD} font-bold text-slate-800 dark:text-slate-200`}>
                      {t.partner || 'XVIP'}
                    </td>
                    <td className={`${TD} w-48 min-w-48 max-w-48 !whitespace-normal [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300 text-xs`}>
                      {t.note || '—'}
                    </td>
                    <td className={`${TD} w-48 min-w-48 max-w-48 !whitespace-normal [overflow-wrap:anywhere] text-slate-700 dark:text-slate-300`}>
                      {t.pickupPoint || '—'}
                    </td>
                    <td className={`${TD} w-48 min-w-48 max-w-48 !whitespace-normal [overflow-wrap:anywhere] text-slate-700 dark:text-slate-300`}>
                      {t.dropoffPoint || '—'}
                    </td>
                    <td className={TD}>
                      {t.smsSent ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                              {t.messageChannel === 'ZALO' ? 'Đã gửi Zalo' : 'Đã gửi SMS'}
                            </span>
                          </div>
                          {t.smsSentAt && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tnum whitespace-nowrap">
                              {formatDateTimeShort(t.smsSentAt)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                          Chưa gửi
                        </span>
                      )}
                    </td>
                    <td className={`${TD} w-48 min-w-48 max-w-48 !whitespace-normal [overflow-wrap:anywhere] text-rose-600 dark:text-rose-400 text-xs`}>
                      {t.cancelledAt && t.cancelReason ? t.cancelReason : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>
      </Card>

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}
    </>
  );
}
