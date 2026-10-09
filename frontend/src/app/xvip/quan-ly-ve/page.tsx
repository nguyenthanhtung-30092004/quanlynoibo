'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle,
  Copy,
  FileXls,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Repeat,
  Trash,
  XCircle,
  Ticket as TicketIcon,
} from '@phosphor-icons/react';
import { useOrders, useCreateOrder, useUpdateOrder, useDeleteOrder, useCancelOrder } from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { useActiveRoutes } from '@/features/routes/hooks';
import { usePartners } from '@/features/partners/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { SEAT_ZONE_LABELS, SeatZone, type CreateOrderInput, type MessageChannel, type Order, type OrderFilters } from '@/features/orders/types';
import { Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { formatDateVN } from '@/lib/format';

import { Modal } from '@/features/xvip/Modal';
import { RouteCombobox } from '@/features/xvip/RouteCombobox';
import { SuggestInput } from '@/features/xvip/SuggestInput';
import { DateInput, TimeInput } from '@/features/xvip/PickerInput';
const ALL = 'all';

/** Loại hình cho sẵn để chọn */
const VEHICLE_TYPES = [
  'Xe Limousine',
  'Xe Riêng',
  'Cabin Đơn',
  'Cabin Đôi',
  'Giường Nằm',
  'Gửi Hàng',
  'Khách Sạn',
  'Vé Fan',
];

/**
 * Ô nhập số: cho phép xóa trống rồi gõ lại (không tự ép về giá trị mặc định
 * giữa chừng). Khi rời ô mà để trống thì mới điền lại giá trị nhỏ nhất.
 */
function NumInput({
  value,
  onChange,
  min = 0,
  max,
  step,
  className,
  required,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(String(value));

  // Đồng bộ khi giá trị đổi từ bên ngoài (mở vé khác, chọn tuyến có giá mặc định...)
  useEffect(() => {
    setText((t) => (Number(t || 0) === value ? t : String(value)));
  }, [value]);

  return (
    <input
      className={className}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      required={required}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === '' ? 0 : Number(e.target.value));
      }}
      onBlur={() => {
        if (text === '') {
          setText(String(min));
          onChange(min);
        }
      }}
    />
  );
}

/** Ô nhập tiền VNĐ: để trống khi bằng 0, tự phân cách hàng nghìn bằng dấu chấm (15000 -> 15.000) */
function MoneyInput({
  value,
  onChange,
  className,
  required,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  required?: boolean;
}) {
  const fmt = (n: number) => (n ? n.toLocaleString('vi-VN') : '');
  const [text, setText] = useState(fmt(value));

  // Đồng bộ khi giá trị đổi từ bên ngoài (mở vé khác, chọn tuyến có giá mặc định...)
  useEffect(() => {
    setText((t) => (Number(t.replace(/\D/g, '') || 0) === value ? t : fmt(value)));
  }, [value]);

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      required={required}
      placeholder="0"
      value={text}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, '').slice(0, 10) || 0);
        setText(fmt(n));
        onChange(n);
      }}
    />
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

interface OrderFormState {
  customerName: string;
  phone: string;
  routeId: number;
  partner: string;
  vehicleType: string;
  seatFront: number;
  seatMiddle: number;
  seatBack: number;
  departureTime: string;
  departureDate: string;
  sellPrice: number;
  costPrice: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
  pickupPoint: string;
  dropoffPoint: string;
  note: string;
  staffId?: number;
}

export default function TicketManagementPage() {
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    staffId: ALL,
    routeId: ALL,
    dateFrom: null,
    dateTo: null,
    page: 1,
  });

  const { data: ordersData, isLoading, refetch } = useOrders(filters);
  const { data: activeRoutes = [] } = useActiveRoutes();
  const { data: partnerList = [] } = usePartners();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  // Danh sách nhân viên chỉ Admin được xem (backend trả 403 cho nhân viên)
  const { data: activeStaff = [] } = useActiveStaff(isAdmin);

  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const deleteMutation = useDeleteOrder();
  const cancelMutation = useCancelOrder();

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Đang đặt lại từ đơn nào (tạo đơn mới dựa trên đơn cũ)
  const [rebookFromId, setRebookFromId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [smsOrder, setSmsOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  // Kênh tự động gửi cho khách ngay khi lưu vé mới
  const [autoSend, setAutoSend] = useState<'NONE' | 'SMS' | 'ZALO' | 'BOTH'>('SMS');
  const [sendingChannel, setSendingChannel] = useState<MessageChannel | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const defaultFormState: OrderFormState = useMemo(
    () => ({
      customerName: '',
      phone: '',
      routeId: 0,
      partner: '',
      vehicleType: '',
      seatFront: 1,
      seatMiddle: 0,
      seatBack: 0,
      departureTime: '13:00',
      departureDate: todayStr,
      sellPrice: 0,
      costPrice: 0,
      deposit: 0,
      collectOnDelivery: 0,
      commission: 0,
      pickupPoint: '',
      dropoffPoint: '',
      note: '',
    }),
    [todayStr],
  );

  const [formState, setFormState] = useState<OrderFormState>(defaultFormState);

  const handleOpenCreate = () => {
    setEditingId(null);
    setRebookFromId(null);
    setFormState(defaultFormState);
    setIsOpenModal(true);
  };

  /** Đặt lại: điền sẵn dữ liệu đơn cũ, ngày đi về hôm nay; lưu sẽ tạo đơn mới */
  const handleOpenRebook = (o: Order) => {
    setEditingId(null);
    setRebookFromId(o.id);
    setFormState({
      customerName: o.customerName ?? '',
      phone: o.phone,
      routeId: o.route?.id ?? 0,
      partner: o.partner ?? '',
      vehicleType: o.vehicleType ?? '',
      seatFront: o.seatFront,
      seatMiddle: o.seatMiddle,
      seatBack: o.seatBack,
      departureTime: o.departureTime,
      departureDate: todayStr,
      sellPrice: o.sellPrice,
      costPrice: o.costPrice,
      deposit: o.deposit,
      collectOnDelivery: o.collectOnDelivery,
      commission: o.commission,
      pickupPoint: o.pickupPoint ?? '',
      dropoffPoint: o.dropoffPoint ?? '',
      note: o.note ?? '',
      staffId: isAdmin ? o.staff?.id : undefined,
    });
    setIsOpenModal(true);
  };

  const handleOpenEdit = (o: Order) => {
    setRebookFromId(null);
    setEditingId(o.id);
    setFormState({
      customerName: o.customerName ?? '',
      phone: o.phone,
      routeId: o.route?.id ?? 0,
      partner: o.partner ?? '',
      vehicleType: o.vehicleType ?? '',
      seatFront: o.seatFront,
      seatMiddle: o.seatMiddle,
      seatBack: o.seatBack,
      departureTime: o.departureTime,
      departureDate: o.departureDate,
      sellPrice: o.sellPrice,
      costPrice: o.costPrice,
      deposit: o.deposit,
      collectOnDelivery: o.collectOnDelivery,
      commission: o.commission,
      pickupPoint: o.pickupPoint ?? '',
      dropoffPoint: o.dropoffPoint ?? '',
      note: o.note ?? '',
      staffId: o.staff?.id,
    });
    setIsOpenModal(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formState.routeId) {
      showToast('Vui lòng chọn tuyến đường.');
      return;
    }
    if ((Number(formState.seatFront) || 0) + (Number(formState.seatMiddle) || 0) + (Number(formState.seatBack) || 0) < 1) {
      showToast('Vui lòng nhập ít nhất 1 ghế (đầu, giữa hoặc cuối).');
      return;
    }
    if (!formState.phone.trim()) {
      showToast('Vui lòng nhập số điện thoại khách hàng.');
      return;
    }

    const payload: CreateOrderInput = {
      customerName: formState.customerName.trim() || undefined,
      phone: formState.phone.replace(/\s+/g, ''),
      routeId: Number(formState.routeId),
      partner: formState.partner.trim() || undefined,
      vehicleType: formState.vehicleType.trim() || undefined,
      departureTime: formState.departureTime,
      departureDate: formState.departureDate,
      sellPrice: Number(formState.sellPrice),
      costPrice: Number(formState.costPrice),
      deposit: Number(formState.deposit),
      collectOnDelivery: Number(formState.collectOnDelivery),
      commission: Number(formState.commission),
      seatFront: Number(formState.seatFront) || 0,
      seatMiddle: Number(formState.seatMiddle) || 0,
      seatBack: Number(formState.seatBack) || 0,
      pickupPoint: formState.pickupPoint.trim() || undefined,
      dropoffPoint: formState.dropoffPoint.trim() || undefined,
      note: formState.note.trim() || undefined,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        showToast('Đã cập nhật vé thành công trên hệ thống!');
      } else {
        const created = await createMutation.mutateAsync({
          ...payload,
          // Chỉ Admin được chỉ định nhân viên; nhân viên luôn là chính mình
          staffId: isAdmin ? formState.staffId : undefined,
        });
        const base = rebookFromId
          ? `Đã đặt lại đơn #${rebookFromId} thành đơn mới thành công!`
          : 'Đã thêm mới đơn vé vào cơ sở dữ liệu thành công!';
        const channels: MessageChannel[] =
          autoSend === 'BOTH' ? ['SMS', 'ZALO'] : autoSend === 'NONE' ? [] : [autoSend];
        if (channels.length === 0) {
          showToast(base);
        } else {
          // Vé đã lưu; gửi tin lỗi thì báo riêng, vẫn có thể bấm gửi lại ở danh sách
          const results = await Promise.allSettled(
            channels.map((ch) => ordersApi.sendMessage(created.id, ch)),
          );
          const parts = results.map((r, i) => {
            const label = channels[i] === 'ZALO' ? 'Zalo' : 'SMS';
            if (r.status === 'rejected') return `${label}: lỗi`;
            return r.value.dryRun ? `${label}: chạy thử` : `${label}: đã gửi`;
          });
          showToast(`${base} Gửi tin cho khách — ${parts.join(', ')}.`);
        }
      }
      refetch();
      setIsOpenModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lưu đơn vé.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMutation.mutateAsync(cancelTarget.id);
      showToast(`Đã hủy vé #${cancelTarget.id}. Vé không còn tính vào doanh thu.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi hủy vé.';
      showToast(`Lỗi: ${msg}`);
    }
    setCancelTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast(`Đã xóa đơn vé #${deleteTarget.id} khỏi hệ thống.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xóa đơn vé.';
      showToast(`Lỗi: ${msg}`);
    }
    setDeleteTarget(null);
  };

  const handleSendMessage = async (id: number, channel: MessageChannel) => {
    const label = channel === 'ZALO' ? 'Zalo' : 'SMS';
    setSendingChannel(channel);
    try {
      const res = await ordersApi.sendMessage(id, channel);
      showToast(
        res.dryRun
          ? `Chế độ thử: chưa gửi ${label} thật tới khách (Sandbox hoặc chưa cấu hình nhà cung cấp).`
          : `Đã gửi tin ${label} cho khách hàng thành công!`,
      );
      setSmsOrder(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Có lỗi khi gửi tin ${label}.`;
      showToast(`Lỗi: ${msg}`);
    } finally {
      setSendingChannel(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      const { blob, filename } = await ordersApi.exportExcel(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã kết xuất dữ liệu vé ra file Excel thành công!');
    } catch {
      showToast('Lỗi khi xuất file Excel từ máy chủ.');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ordersList: Order[] = ordersData?.data ?? [];

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
              onClick={handleExportExcel}
            >
              <FileXls size={18} weight="bold" /> Xuất Excel
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm vé mới
            </button>
          </div>
        }
      >
        Quản lý vé &amp; Đơn đặt xe
      </PageTitle>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300 shadow-[0_4px_0_#a7f3d0] dark:shadow-[0_4px_0_#064e3b] animate-in fade-in">
          <CheckCircle size={20} weight="fill" className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bộ lọc 3D dập chìm */}
      <Card>
        <div className="flex flex-wrap items-end gap-3.5">
          <label className="block min-w-64 flex-[2]">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Tìm kiếm nhanh</span>
            <span className="relative block">
              <MagnifyingGlass size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                className="input-3d pl-9"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Tên khách hàng, số điện thoại, điểm đón..."
              />
            </span>
          </label>

          <label className="block min-w-36 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Tuyến đường</span>
            <select
              className="input-3d"
              value={filters.routeId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  routeId: e.target.value === ALL ? ALL : Number(e.target.value),
                  page: 1,
                }))
              }
            >
              <option value={ALL}>Tất cả tuyến</option>
              {activeRoutes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          {activeStaff.length > 0 && (
            <label className="block min-w-36 flex-1">
              <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Nhân viên</span>
              <select
                className="input-3d"
                value={filters.staffId}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    staffId: e.target.value === ALL ? ALL : Number(e.target.value),
                    page: 1,
                  }))
                }
              >
                <option value={ALL}>Tất cả nhân viên</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Card>

      {/* Bảng danh sách 3D */}
      <Card className="mt-5 overflow-hidden !p-0">
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
                <th className={`${TH} text-right`}>Hoa hồng</th>
                <th className={TH}>NV tạo</th>
                <th className={TH}>Tin nhắn</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải danh sách vé từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : ordersList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <TicketIcon size={36} className="text-slate-400" />
                      <span>Chưa có đơn vé nào trong hệ thống.</span>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="btn-3d btn-3d-blue px-4 py-2 text-xs"
                      >
                        + Tạo đơn vé đầu tiên
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                ordersList.map((t, i) => (
                  <tr
                    key={t.id}
                    className={`hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors ${
                      t.cancelledAt ? 'bg-slate-50 opacity-60 dark:bg-slate-900/60' : ''
                    }`}
                  >
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{i + 1}</td>
                    <td className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                      #{t.id}
                      {t.cancelledAt && (
                        <span className="mt-1 block w-fit rounded-md bg-rose-100 px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Đã hủy
                        </span>
                      )}
                    </td>
                    <td className={`${TD} font-bold text-blue-700 dark:text-blue-400`}>
                      {t.departureTime}
                      <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">{formatDateVN(t.departureDate)}</span>
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
                    <td className={`${TD} ${NUM} font-black text-red-600 dark:text-red-400`}>
                      {money(t.commission)}đ
                    </td>
                    <td className={`${TD} text-slate-800 dark:text-slate-300 font-semibold`}>
                      {t.staff?.fullName || 'NV'}
                    </td>
                    <td className={TD}>
                      {t.smsSent ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle size={17} weight="fill" className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Đã gửi{t.messageChannel ? ` ${t.messageChannel === 'ZALO' ? 'Zalo' : 'SMS'}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSmsOrder(t)}
                            className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold underline ml-1 hover:text-blue-800"
                          >
                            Xem
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSmsOrder(t)}
                          className="btn-3d btn-3d-blue px-2.5 py-1 text-[11px] flex items-center gap-1"
                        >
                          <PaperPlaneTilt size={13} weight="bold" /> Gửi tin
                        </button>
                      )}
                    </td>
                    <td className={`${TD} text-center`}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenRebook(t)}
                          title="Đặt lại (tạo đơn mới từ đơn này)"
                          className="btn-3d btn-3d-green px-2.5 py-1 text-[11px] flex items-center gap-1 whitespace-nowrap"
                        >
                          <Repeat size={13} weight="bold" /> Đặt lại
                        </button>
                        {!t.cancelledAt && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t)}
                              title="Sửa vé"
                              className="btn-3d-mini text-blue-600 hover:text-blue-700"
                            >
                              <PencilSimple size={16} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(t)}
                              title="Hủy vé (khách không đặt nữa)"
                              className="btn-3d-mini text-amber-600 hover:text-amber-700"
                            >
                              <XCircle size={16} weight="bold" />
                            </button>
                          </>
                        )}
                        {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          title="Xóa vé"
                          className="btn-3d-mini text-rose-600 hover:text-rose-700"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Thêm / Sửa Vé */}
      {isOpenModal && (
        <Modal
          title={
            editingId
              ? `Cập nhật đơn vé #${editingId}`
              : rebookFromId
                ? `Đặt lại đơn #${rebookFromId} (tạo đơn mới)`
                : 'Thêm vé / Đơn đặt xe mới'
          }
          onClose={() => setIsOpenModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Tuyến đường" required>
                <RouteCombobox
                  routes={activeRoutes}
                  value={formState.routeId}
                  onChange={(rId) => {
                    const selRoute = activeRoutes.find((r) => r.id === rId);
                    setFormState((p) => ({
                      ...p,
                      routeId: rId,
                      // Chỉ gợi ý giá bán theo giá mặc định của tuyến, vẫn sửa được
                      sellPrice: selRoute?.defaultPrice ? selRoute.defaultPrice : p.sellPrice,
                    }));
                  }}
                />
              </Field>

              <Field label="Đối tác">
                <SuggestInput
                  options={partnerList.map((c) => c.name)}
                  value={formState.partner}
                  onChange={(v) => setFormState((p) => ({ ...p, partner: v }))}
                  placeholder="Gõ để tìm đối tác…"
                  maxLength={100}
                />
              </Field>

              <Field label="Giờ đi" required>
                <TimeInput
                  value={formState.departureTime}
                  onChange={(v) => setFormState((p) => ({ ...p, departureTime: v }))}
                  required
                />
              </Field>

              <Field label="Ngày khởi hành" required>
                <DateInput
                  value={formState.departureDate}
                  onChange={(v) => setFormState((p) => ({ ...p, departureDate: v }))}
                  required
                />
              </Field>

              <Field label="Tên khách hàng">
                <input
                  className="input-3d"
                  value={formState.customerName}
                  onChange={(e) => setFormState((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Nguyễn Văn An"
                  maxLength={100}
                  autoFocus
                />
              </Field>

              <Field label="Số điện thoại" required>
                <input
                  className="input-3d font-mono font-bold"
                  inputMode="tel"
                  value={formState.phone}
                  onChange={(e) => setFormState((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0983456789"
                  required
                />
              </Field>

              <Field label="Loại hình">
                <select
                  className="input-3d"
                  value={formState.vehicleType}
                  onChange={(e) => setFormState((p) => ({ ...p, vehicleType: e.target.value }))}
                >
                  <option value="">Chọn loại hình</option>
                  {/* Vé cũ có loại hình ngoài danh sách vẫn hiển thị đúng khi sửa */}
                  {formState.vehicleType && !VEHICLE_TYPES.includes(formState.vehicleType) && (
                    <option value={formState.vehicleType}>{formState.vehicleType}</option>
                  )}
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                    Số ghế theo vị trí <span className="text-red-500">*</span>
                  </span>
                  <span className="rounded-lg bg-blue-600 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-[0_2px_0_#1e3a8a]">
                    Tổng: {(Number(formState.seatFront) || 0) + (Number(formState.seatMiddle) || 0) + (Number(formState.seatBack) || 0)} vé
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { key: 'seatFront', label: 'Ghế đầu' },
                      { key: 'seatMiddle', label: 'Ghế giữa' },
                      { key: 'seatBack', label: 'Ghế cuối' },
                    ] as const
                  ).map((z) => (
                    <label
                      key={z.key}
                      className="block rounded-xl border border-slate-200 bg-slate-50 p-2.5 shadow-[0_3px_0_#cbd5e1] dark:border-slate-700 dark:bg-slate-800/60 dark:shadow-[0_3px_0_#0b1220]"
                    >
                      <span className="mb-1 block text-center text-xs font-bold text-slate-600 dark:text-slate-300">{z.label}</span>
                      <NumInput
                        className="input-3d text-center"
                        value={formState[z.key]}
                        onChange={(n) => setFormState((p) => ({ ...p, [z.key]: n }))}
                        min={0}
                        max={60}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <Field label="Giá nhập (VNĐ)">
                <MoneyInput className="input-3d" value={formState.costPrice} onChange={(n) => setFormState((p) => ({ ...p, costPrice: n }))} />
              </Field>

              <Field label="Giá bán (VNĐ)" required>
                <MoneyInput className="input-3d font-bold text-blue-900 dark:text-blue-400" value={formState.sellPrice} onChange={(n) => setFormState((p) => ({ ...p, sellPrice: n }))} required />
              </Field>

              <Field label="Đã cọc (VNĐ)">
                <MoneyInput className="input-3d" value={formState.deposit} onChange={(n) => setFormState((p) => ({ ...p, deposit: n }))} />
              </Field>

              <Field label="Nhờ thu (VNĐ)">
                <MoneyInput className="input-3d" value={formState.collectOnDelivery} onChange={(n) => setFormState((p) => ({ ...p, collectOnDelivery: n }))} />
              </Field>

              <Field label="Hoa hồng (VNĐ)">
                <MoneyInput className="input-3d font-bold text-red-600 dark:text-red-400" value={formState.commission} onChange={(n) => setFormState((p) => ({ ...p, commission: n }))} />
              </Field>

              {isAdmin && !editingId && (
                <Field label="Nhân viên phụ trách">
                  <select
                    className="input-3d"
                    value={formState.staffId ?? ''}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, staffId: e.target.value ? Number(e.target.value) : undefined }))
                    }
                  >
                    <option value="">Mặc định: tôi</option>
                    {activeStaff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Điểm đón">
                <input
                  className="input-3d"
                  value={formState.pickupPoint}
                  onChange={(e) => setFormState((p) => ({ ...p, pickupPoint: e.target.value }))}
                  placeholder="VD: Sảnh Keangnam, Phạm Hùng"
                  maxLength={255}
                />
              </Field>
              <Field label="Điểm trả">
                <input
                  className="input-3d"
                  value={formState.dropoffPoint}
                  onChange={(e) => setFormState((p) => ({ ...p, dropoffPoint: e.target.value }))}
                  placeholder="VD: Bến xe Cẩm Phả"
                  maxLength={255}
                />
              </Field>
            </div>

            {!editingId && (
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4 shadow-[0_4px_0_#bfdbfe] dark:border-slate-700 dark:from-slate-800 dark:to-slate-900 dark:shadow-[0_4px_0_#0b1220]">
                <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                  <PaperPlaneTilt size={18} weight="fill" className="text-blue-600" />
                  Gửi tin xác nhận cho khách ngay khi lưu vé
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {(
                    [
                      { id: 'SMS', label: 'SMS', hint: 'Tin nhắn thường' },
                      { id: 'ZALO', label: 'Zalo', hint: 'Zalo ZNS' },
                      { id: 'BOTH', label: 'Cả hai', hint: 'SMS + Zalo' },
                      { id: 'NONE', label: 'Không gửi', hint: 'Gửi sau' },
                    ] as const
                  ).map((o) => {
                    const active = autoSend === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setAutoSend(o.id)}
                        aria-pressed={active}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all active:translate-y-0.5 ${
                          active
                            ? 'border-blue-700 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_3px_0_#1e3a8a]'
                            : 'border-slate-200 bg-white text-slate-700 shadow-[0_3px_0_#cbd5e1] hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-[0_3px_0_#0b1220]'
                        }`}
                      >
                        <span className="block text-sm font-extrabold">{o.label}</span>
                        <span className={`block text-[11px] font-medium ${active ? 'text-white/80' : 'text-slate-400'}`}>
                          {o.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Ghi chú">
              <input
                className="input-3d"
                value={formState.note}
                onChange={(e) => setFormState((p) => ({ ...p, note: e.target.value }))}
                placeholder="VD: Khách có 2 vali lớn, đến sớm 15 phút..."
                maxLength={1000}
              />
            </Field>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="btn-3d btn-3d-blue px-5 py-2 text-sm"
              >
                {editingId ? 'Cập nhật vé' : rebookFromId ? 'Đặt đơn mới' : 'Lưu vé'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal SMS */}
      {smsOrder && (
        <Modal
          title={`Gửi tin nhắn cho đơn #${smsOrder.id}`}
          onClose={() => setSmsOrder(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 p-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="mb-1 font-bold text-blue-900 dark:text-blue-300">Nội dung tin nhắn khách hàng:</div>
              <div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 font-mono text-[11px] border border-blue-100 dark:border-blue-800 shadow-inner">
                {smsOrder.smsContent ||
                  `Thông tin: Quý khách ${smsOrder.customerName || ''} đặt thành công vé xe tuyến ${smsOrder.route?.name || ''} lúc ${smsOrder.departureTime} ngày ${formatDateVN(smsOrder.departureDate)}. Tổng đài 1900 1977. Trân trọng!`}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    smsOrder.smsContent ||
                      `Thông tin: Quý khách ${smsOrder.customerName || ''} đặt thành công vé xe tuyến ${smsOrder.route?.name || ''} lúc ${smsOrder.departureTime} ngày ${formatDateVN(smsOrder.departureDate)}. Tổng đài 1900 1977. Trân trọng!`
                  )
                }
                className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-2 text-xs"
              >
                <Copy size={16} weight="bold" /> {copied ? 'Đã sao chép!' : 'Sao chép tin'}
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={sendingChannel !== null}
                  onClick={() => handleSendMessage(smsOrder.id, 'ZALO')}
                  className="btn-3d btn-3d-blue flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  <PaperPlaneTilt size={16} weight="bold" />
                  {sendingChannel === 'ZALO' ? 'Đang gửi…' : 'Gửi Zalo'}
                </button>
                <button
                  type="button"
                  disabled={sendingChannel !== null}
                  onClick={() => handleSendMessage(smsOrder.id, 'SMS')}
                  className="btn-3d btn-3d-green flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  <PaperPlaneTilt size={16} weight="bold" />
                  {sendingChannel === 'SMS' ? 'Đang gửi…' : 'Gửi SMS'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Hủy vé */}
      {cancelTarget && (
        <Modal title="Hủy vé" onClose={() => setCancelTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Khách <strong className="text-slate-900 dark:text-white">{cancelTarget.customerName || cancelTarget.phone}</strong> không đặt nữa? Vé{' '}
              <strong className="text-slate-900 dark:text-white">#{cancelTarget.id}</strong> sẽ được đánh dấu <strong>Đã hủy</strong>, vẫn lưu lại trong danh sách nhưng không tính vào doanh thu và không sửa được nữa.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Giữ vé
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="btn-3d btn-3d-red px-5 py-2 text-sm"
              >
                Xác nhận hủy vé
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Xóa */}
      {deleteTarget && (
        <Modal title="Xác nhận xóa vé" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa đơn vé <strong className="text-slate-900 dark:text-white">#{deleteTarget.id}</strong> của khách hàng{' '}
              <strong className="text-slate-900 dark:text-white">{deleteTarget.customerName || deleteTarget.phone}</strong> không?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-3d btn-3d-red px-5 py-2 text-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
