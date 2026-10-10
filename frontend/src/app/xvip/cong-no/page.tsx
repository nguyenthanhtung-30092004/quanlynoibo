'use client';

import { useMemo, useState } from 'react';
import {
  CurrencyCircleDollar,
  FileXls,
  HandCoins,
  Receipt,
  Scales,
  Bus,
} from '@phosphor-icons/react';
import { usePartners } from '@/features/partners/hooks';
import { useDebts } from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { money } from '@/features/xvip/data';
import { useToast } from '@/features/xvip/toast';
import { Card, PageTitle, TD, TH } from '@/features/xvip/ui';
import { DateRangeFilter, rangeParams, useDateFilter } from '@/features/xvip/date-filter';

import { Modal } from '@/features/xvip/Modal';
interface SettlementModalData {
  carrierId: number;
  carrierName: string;
  owed: number;
}

export default function DebtPage() {
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [settlementTarget, setSettlementTarget] = useState<SettlementModalData | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settledMap, setSettledMap] = useState<Record<string, number>>({});

  const { data: partnerData, isLoading: carriersLoading } = usePartners();
  // Công nợ tính trên server theo khoảng ngày ở header (không bị giới hạn 20 đơn như danh sách)
  const { range, basis } = useDateFilter();
  const dates = rangeParams(range, basis);
  const { data: debtData, isLoading: ordersLoading } = useDebts(dates);

  const showToast = useToast();

  const carriers = useMemo(() => partnerData ?? [], [partnerData]);

  // Tính toán công nợ thực tế cho từng đối tác từ danh sách đơn hàng
  const debtList = useMemo(() => {
    const byName = new Map((debtData ?? []).map((d) => [d.partner.toLowerCase(), d]));
    return carriers.map((c) => {
      const d = byName.get(c.name.toLowerCase());
      const totalTickets = d?.tickets ?? 0;
      const totalCollected = d?.revenue ?? 0;
      const totalCommission = d?.commission ?? 0;
      const carrierCost = d?.cost ?? 0;
      const paid = settledMap[c.name] ?? 0;
      const owed = Math.max(0, carrierCost - paid);

      return {
        id: c.id,
        carrier: c.name,
        tickets: totalTickets,
        totalAmount: totalCollected,
        commission: totalCommission,
        paid,
        owed,
        bankAccount: 'Chưa cập nhật',
        accountName: c.name.toUpperCase(),
      };
    });
  }, [carriers, debtData, settledMap]);

  const filteredDebts = useMemo(() => {
    if (carrierFilter === 'all') return debtList;
    return debtList.filter((d) => String(d.id) === carrierFilter);
  }, [debtList, carrierFilter]);

  const totalOwed = useMemo(
    () => filteredDebts.reduce((acc, d) => acc + d.owed, 0),
    [filteredDebts]
  );
  const totalPaid = useMemo(
    () => filteredDebts.reduce((acc, d) => acc + d.paid, 0),
    [filteredDebts]
  );
  const totalCommission = useMemo(
    () => filteredDebts.reduce((acc, d) => acc + d.commission, 0),
    [filteredDebts]
  );

  // Xuất Excel theo đúng khoảng ngày và đối tác đang lọc
  const handleExport = async () => {
    try {
      const partner = carriers.find((c) => String(c.id) === carrierFilter)?.name;
      const { blob, filename } = await ordersApi.exportDebts({ ...dates, partner });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất bảng công nợ ra file Excel.');
    } catch {
      showToast('Lỗi khi xuất bảng công nợ từ máy chủ.');
    }
  };

  const handleOpenSettlement = (carrierId: number, carrierName: string, owed: number) => {
    setSettlementTarget({ carrierId, carrierName, owed });
    setSettlementAmount(String(owed));
  };

  const handleConfirmSettlement = () => {
    if (!settlementTarget) return;
    const amount = Number(settlementAmount) || 0;
    if (amount <= 0) {
      showToast('Vui lòng nhập số tiền thanh toán hợp lệ.');
      return;
    }

    setSettledMap((prev) => ({
      ...prev,
      [settlementTarget.carrierName]: (prev[settlementTarget.carrierName] ?? 0) + amount,
    }));

    showToast(`Đã ghi nhận thanh toán ${money(amount)}đ cho đối tác ${settlementTarget.carrierName}.`);
    setSettlementTarget(null);
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <FileXls size={18} weight="bold" /> Xuất bảng công nợ
            </button>
          </div>
        }
      >
        Đối soát &amp; Công nợ nhà xe
      </PageTitle>


      {/* 3D Filter Bar */}
      <Card>
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="block min-w-64 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Thời gian đối soát
            </span>
            <DateRangeFilter />
          </div>

          <label className="block min-w-56 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Đối tác</span>
            <select
              className="input-3d"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            >
              <option value="all">Tất cả đối tác</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Số liệu công nợ và đối soát tính theo khoảng thời gian và đối tác đã chọn.
        </p>
      </Card>

      {/* 3D KPI Metrics Cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #be123c, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-rose-600 to-rose-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Scales size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Công nợ cần trả đối tác</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalOwed)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">Số tiền phải chuyển cho nhà xe</div>
          </div>
        </div>

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #15803d, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <HandCoins size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Đã thanh toán đối tác</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalPaid)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">Đã quyết toán chuyển khoản</div>
          </div>
        </div>

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <CurrencyCircleDollar size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Hoa hồng đại lý giữ lại</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
              {money(totalCommission)}đ
            </div>
            <div className="text-[11px] font-medium text-white/90">Lợi nhuận chênh lệch vé</div>
          </div>
        </div>
      </div>

      {/* 3D Table List */}
      <Card className="mt-5 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Đối tác</th>
                <th className={TH}>Thông tin tài khoản nhận</th>
                <th className={`${TH} text-right`}>Số vé chạy</th>
                <th className={`${TH} text-right`}>Tổng thu hộ</th>
                <th className={`${TH} text-right`}>Hoa hồng giữ</th>
                <th className={`${TH} text-right`}>Đã chuyển</th>
                <th className={`${TH} text-right`}>Còn phải trả</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {carriersLoading || ordersLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tính toán công nợ từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có dữ liệu nhà xe nào.
                  </td>
                </tr>
              ) : (
                filteredDebts.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors">
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{index + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-xv-blue text-white shadow-[0_2px_0_#1d4ed8]">
                          <Bus size={18} weight="bold" />
                        </span>
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white">{item.carrier}</span>
                          <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500">ID: #{item.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="leading-tight">
                        <span className="block font-bold text-slate-800 dark:text-slate-200">{item.bankAccount}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{item.accountName}</span>
                      </div>
                    </td>
                    <td className={`${TD} text-right font-black text-blue-700 dark:text-blue-400 tnum`}>
                      {item.tickets.toLocaleString('vi-VN')} vé
                    </td>
                    <td className={`${TD} text-right font-bold text-slate-900 dark:text-white tnum`}>
                      {money(item.totalAmount)}đ
                    </td>
                    <td className={`${TD} text-right font-black text-amber-600 dark:text-amber-400 tnum`}>
                      {money(item.commission)}đ
                    </td>
                    <td className={`${TD} text-right font-bold text-emerald-600 dark:text-emerald-400 tnum`}>
                      {money(item.paid)}đ
                    </td>
                    <td className={`${TD} text-right font-black text-rose-600 dark:text-rose-400 text-sm tnum`}>
                      {money(item.owed)}đ
                    </td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        onClick={() => handleOpenSettlement(item.id, item.carrier, item.owed)}
                        className="btn-3d btn-3d-blue px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Receipt size={14} weight="bold" /> Thanh toán
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Quyết Toán Thanh Toán Cho Nhà Xe */}
      {settlementTarget && (
        <Modal
          title={`Thanh toán công nợ: ${settlementTarget.carrierName}`}
          onClose={() => setSettlementTarget(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Số tiền đang nợ nhà xe</span>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {money(settlementTarget.owed)}đ
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Số tiền chuyển khoản quyết toán (VNĐ) <span className="text-red-500">*</span>
              </span>
              <input
                className="input-3d font-bold text-slate-900 dark:text-white"
                type="number"
                step="10000"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                autoFocus
              />
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                className="btn-3d btn-3d-green px-5 py-2 text-sm"
              >
                Xác nhận đã chuyển khoản
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
