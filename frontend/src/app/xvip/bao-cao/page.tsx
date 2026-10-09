'use client';

import { useToast } from '@/features/xvip/toast';
import { useMemo, useState } from 'react';
import {
  ClipboardText,
  CurrencyCircleDollar,
  FileXls,
  Medal,
  Percent,
  Printer,
  Ticket,
  Trophy,
} from '@phosphor-icons/react';
import { useKpi, useOrders } from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { useCurrentUser } from '@/features/auth/hooks';
import { useUsers } from '@/features/users/hooks';
import { money } from '@/features/xvip/data';
import { Avatar, Card, PageTitle, TD, TH } from '@/features/xvip/ui';
import { DateInput } from '@/features/xvip/PickerInput';

export default function StaffReportPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staffFilter, setStaffFilter] = useState('all');

  const { data: kpiData, isLoading: kpiLoading } = useKpi(selectedDate);
  const { data: ordersData, isLoading: ordersLoading } = useOrders({
    search: '',
    staffId: 'all',
    routeId: 'all',
    dateFrom: null,
    dateTo: null,
    page: 1,
  });
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  // API người dùng chỉ dành cho Admin
  const { data: usersData } = useUsers({ page: 1, search: '' }, isAdmin);
  const showToast = useToast();

  const staffList = useMemo(() => {
    return usersData?.data ?? [];
  }, [usersData]);

  // Danh sách nhân viên và thành tích thực tế
  const staffPerformance = useMemo(() => {
    const orders = ordersData?.data ?? [];

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
        },
      ];
    }

    if (kpiData?.byStaff && kpiData.byStaff.length > 0) {
      return kpiData.byStaff.map((s) => ({
        id: s.staffId,
        name: s.fullName,
        orders: s.total,
        tickets: s.seats,
        revenue: s.revenue ?? 0,
        commission: s.commission,
      }));
    }

    return staffList.map((u) => {
      const matchOrders = orders.filter((o) => o.staff?.id === u.id && !o.cancelledAt);
      const rev = matchOrders.reduce((sum, o) => sum + (o.sellPrice || 0), 0);
      const comm = matchOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
      return {
        id: u.id,
        name: u.fullName,
        orders: matchOrders.length,
        tickets: matchOrders.reduce((sum, o) => sum + (o.seatCount || 1), 0),
        revenue: rev,
        commission: comm,
      };
    });
  }, [kpiData, ordersData, staffList, isAdmin, me]);

  const filteredStaff = useMemo(() => {
    if (staffFilter === 'all') return staffPerformance;
    return staffPerformance.filter((s) => String(s.id) === staffFilter);
  }, [staffPerformance, staffFilter]);

  const totalOrders = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.orders, 0),
    [filteredStaff]
  );
  const totalTickets = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.tickets, 0),
    [filteredStaff]
  );
  const totalRevenue = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.revenue, 0),
    [filteredStaff]
  );
  const totalCommission = useMemo(
    () => filteredStaff.reduce((acc, s) => acc + s.commission, 0),
    [filteredStaff]
  );

  const sortedStaff = useMemo(
    () => [...filteredStaff].sort((a, b) => b.tickets - a.tickets),
    [filteredStaff]
  );

  const topPerformer = sortedStaff[0];

  const handleExportExcel = async () => {
    try {
      const { blob, filename } = await ordersApi.exportExcel({
        search: '',
        staffId: staffFilter === 'all' ? 'all' : Number(staffFilter),
        routeId: 'all',
        dateFrom: selectedDate,
        dateTo: selectedDate,
        page: 1,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất báo cáo nhân sự ra file Excel thành công!');
    } catch {
      showToast('Lỗi khi xuất file Excel từ máy chủ.');
    }
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <FileXls size={18} weight="bold" /> Xuất Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-3d btn-3d-white flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Printer size={18} weight="bold" /> In báo cáo
            </button>
          </div>
        }
      >
        Báo cáo hiệu suất &amp; Doanh số nhân viên
      </PageTitle>


      {/* 3D Filter Bar */}
      <Card>
        <div className="flex flex-wrap items-end gap-3.5">
          <label className="block min-w-44">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Ngày báo cáo</span>
            <DateInput value={selectedDate} onChange={setSelectedDate} />
          </label>

          {isAdmin && (
          <label className="block min-w-48 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Nhân viên</span>
            <select
              className="input-3d"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
            >
              <option value="all">Tất cả nhân viên</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.username})
                </option>
              ))}
            </select>
          </label>
          )}
        </div>
      </Card>

      {/* 3D KPI Metrics Cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #6b21a8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <ClipboardText size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng số đơn</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {totalOrders.toLocaleString('vi-VN')} đơn
            </div>
            <div className="text-[11px] font-medium text-white/90">Mỗi đơn có thể gồm nhiều vé</div>
          </div>
        </div>

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Ticket size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng vé bán ra</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {totalTickets.toLocaleString('vi-VN')} vé
            </div>
            <div className="text-[11px] font-medium text-white/90">Tính theo số ghế của từng đơn</div>
          </div>
        </div>

        {isAdmin && (
        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #15803d, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <CurrencyCircleDollar size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng doanh thu vé</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalRevenue)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">Giá trị vé khách thanh toán</div>
          </div>
        </div>
        )}

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #b45309, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Percent size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng hoa hồng đại lý</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalCommission)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">Lợi nhuận gộp từ đơn vé</div>
          </div>
        </div>
      </div>

      {/* 3D Podium: Top 3 Nhân Viên Xuất Sắc Nhất */}
      {sortedStaff.length > 0 && topPerformer && topPerformer.tickets > 0 && (
        <Card title="Vinh danh nhân viên bán vé xuất sắc" className="mt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-2">
            {/* Top 2 */}
            {sortedStaff[1] && (
              <div className="flex flex-col items-center justify-end rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center order-2 md:order-1">
                <Medal size={28} weight="fill" className="text-slate-400 mb-2" />
                <Avatar name={sortedStaff[1].name} />
                <span className="mt-2 font-black text-slate-900 dark:text-white text-base">{sortedStaff[1].name}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Á quân bán vé</span>
                <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="text-xs text-slate-500">Số lượng: <strong>{sortedStaff[1].orders} đơn · {sortedStaff[1].tickets} vé</strong></div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{money(sortedStaff[1].commission)}đ</div>
                </div>
              </div>
            )}

            {/* Top 1 Quán Quân */}
            <div className="flex flex-col items-center justify-end rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 p-5 border-2 border-amber-400 shadow-[0_8px_20px_rgba(245,158,11,0.2)] text-center order-1 md:order-2">
              <Trophy size={36} weight="fill" className="text-amber-500 mb-2 animate-bounce" />
              <Avatar name={topPerformer.name} />
              <span className="mt-2 font-black text-slate-900 dark:text-white text-lg">{topPerformer.name}</span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Quán quân doanh số</span>
              <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-3 border border-amber-300 dark:border-amber-700 shadow-inner">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Đạt: <strong>{topPerformer.orders} đơn · {topPerformer.tickets} vé</strong></div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{money(topPerformer.commission)}đ hoa hồng</div>
              </div>
            </div>

            {/* Top 3 */}
            {sortedStaff[2] && (
              <div className="flex flex-col items-center justify-end rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center order-3">
                <Medal size={28} weight="fill" className="text-amber-700 mb-2" />
                <Avatar name={sortedStaff[2].name} />
                <span className="mt-2 font-black text-slate-900 dark:text-white text-base">{sortedStaff[2].name}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Hạng ba</span>
                <div className="mt-3 w-full rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 shadow-inner">
                  <div className="text-xs text-slate-500">Số lượng: <strong>{sortedStaff[2].orders} đơn · {sortedStaff[2].tickets} vé</strong></div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{money(sortedStaff[2].commission)}đ</div>
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
                {isAdmin && <th className={`${TH} text-right`}>Tổng doanh thu vé</th>}
                <th className={`${TH} text-right`}>Hoa hồng đạt được</th>
                {isAdmin && <th className={`${TH} text-right`}>Giá trị TB / vé</th>}
              </tr>
            </thead>
            <tbody>
              {kpiLoading || ordersLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải dữ liệu báo cáo hiệu suất từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : sortedStaff.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có dữ liệu nhân viên nào cho ngày đã chọn.
                  </td>
                </tr>
              ) : (
                sortedStaff.map((staff, index) => {
                  const avgPrice = staff.tickets > 0 ? Math.round(staff.revenue / staff.tickets) : 0;
                  return (
                    <tr key={staff.id || staff.name} className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors">
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
                          <span className="text-slate-500 dark:text-slate-400">{index + 1}</span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={staff.name} />
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white">{staff.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`${TD} text-right font-bold text-purple-700 dark:text-purple-400 tnum`}>
                        {staff.orders.toLocaleString('vi-VN')} đơn
                      </td>
                      <td className={`${TD} text-right font-black text-blue-700 dark:text-blue-400 tnum`}>
                        {staff.tickets.toLocaleString('vi-VN')} vé
                      </td>
                      {isAdmin && (
                        <td className={`${TD} text-right font-bold text-slate-900 dark:text-white tnum`}>
                          {money(staff.revenue)}đ
                        </td>
                      )}
                      <td className={`${TD} text-right font-black text-emerald-600 dark:text-emerald-400 tnum`}>
                        {money(staff.commission)}đ
                      </td>
                      {isAdmin && (
                        <td className={`${TD} text-right font-semibold text-slate-600 dark:text-slate-300 tnum`}>
                          {money(avgPrice)}đ
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
