'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle,
  FileXls,
  MagnifyingGlass,
  PencilSimple,
  ClockCounterClockwise,
  Plus,
  Copy,
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
import { type CreateOrderInput, type MessageChannel, type Order, type OrderFilters } from '@/features/orders/types';
import { useToast } from '@/features/xvip/toast';
import { Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { formatDateVN } from '@/lib/format';

import { Modal } from '@/features/xvip/Modal';
import { OrderHistoryModal } from '@/features/orders/components/OrderHistoryModal';
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
  blankZero,
}: {
  value: number;
  onChange: (n: number) => void;
  blankZero?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  required?: boolean;
}) {
  const shown = (n: number) => (blankZero && !n ? '' : String(n));
  const [text, setText] = useState(shown(value));

  // Đồng bộ khi giá trị đổi từ bên ngoài (mở vé khác, chọn tuyến có giá mặc định...)
  useEffect(() => {
    setText((t) => (Number(t || 0) === value ? t : shown(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (text === '' && !blankZero) {
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
      value={text}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, '').slice(0, 10) || 0);
        setText(fmt(n));
        onChange(n);
      }}
    />
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

/** Khối nhóm các ô nhập trong form vé, đánh số bước để dễ theo dõi */
function Section({
  step,
  title,
  className = '',
  children,
}: {
  step?: number;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
        {step !== undefined && (
          <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-[0_2px_0_#1e3a8a]">
            {step}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
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
  seatCount: number;
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
  const [historyOrderId, setHistoryOrderId] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<{ customerName?: string; phone?: string; seats?: string }>({});
  // Kênh tự động gửi cho khách ngay khi lưu vé mới
  const [autoSend, setAutoSend] = useState<Record<MessageChannel, boolean>>({ SMS: false, ZALO: false });

  const showToast = useToast();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const defaultFormState: OrderFormState = useMemo(
    () => ({
      customerName: '',
      phone: '',
      routeId: 0,
      partner: '',
      vehicleType: '',
      seatFront: 0,
      seatMiddle: 0,
      seatBack: 0,
      seatCount: 0,
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
    setFormErrors({});
    setAutoSend({ SMS: false, ZALO: false });
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
      seatCount: o.seatCount,
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
    setFormErrors({});
    setAutoSend({ SMS: false, ZALO: false });
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
      seatCount: o.seatCount,
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
    setFormErrors({});
    setAutoSend({ SMS: false, ZALO: false });
    setIsOpenModal(true);
  };

  /** Nội dung đơn dạng chữ, điền tới đâu hiện tới đó, để xem và sao chép gửi đi nơi khác */
  const previewLines = (() => {
    const join = (parts: (string | false | undefined)[], sep = ' - ') => parts.filter(Boolean).join(sep);
    const f = formState;
    const seats = Number(f.seatCount) || 0;
    const zones = [
      Number(f.seatFront) > 0 && `đầu ${Number(f.seatFront)}`,
      Number(f.seatMiddle) > 0 && `giữa ${Number(f.seatMiddle)}`,
      Number(f.seatBack) > 0 && `cuối ${Number(f.seatBack)}`,
    ].filter(Boolean);
    return [
      join([f.departureTime, f.departureDate && formatDateVN(f.departureDate)], ' ngày '),
      join([f.customerName.trim(), f.phone.trim()]),
      f.pickupPoint.trim() && `Đón: ${f.pickupPoint.trim()}`,
      f.dropoffPoint.trim() && `Trả: ${f.dropoffPoint.trim()}`,
      seats > 0 && `${seats} ghế`,
      zones.length > 0 && `Ghế ${zones.join(', ')}`,
    ].filter((line): line is string => !!line);
  })();

  const handleCopyPreview = async () => {
    if (previewLines.length === 0) {
      showToast('Chưa có nội dung để sao chép.', 'info');
      return;
    }
    const text = previewLines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Trình duyệt chặn clipboard (http, quyền...): dùng cách cũ
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!ok) {
        showToast('Không sao chép được, hãy bôi đen và copy thủ công.', 'error');
        return;
      }
    }
    showToast('Đã sao chép nội dung đơn.');
  };

  /** Gửi tin theo các kênh đã tích; trả về câu kết quả để nối vào thông báo (rỗng nếu không tích kênh nào) */
  const sendSelectedChannels = async (orderId: number) => {
    const channels = (['SMS', 'ZALO'] as const).filter((ch) => autoSend[ch]);
    if (channels.length === 0) return '';
    const results = await Promise.allSettled(channels.map((ch) => ordersApi.sendMessage(orderId, ch)));
    const parts = results.map((r, i) => {
      const label = channels[i] === 'ZALO' ? 'Zalo' : 'SMS';
      if (r.status === 'rejected') return `${label}: lỗi`;
      return r.value.dryRun ? `${label}: chạy thử` : `${label}: đã gửi`;
    });
    return ` Gửi tin cho khách — ${parts.join(', ')}.`;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formState.routeId) {
      showToast('Vui lòng chọn tuyến đường.');
      return;
    }
    const errors: { customerName?: string; phone?: string; seats?: string } = {};
    if (!formState.customerName.trim()) errors.customerName = 'Vui lòng nhập tên khách hàng.';
    const phoneClean = formState.phone.replace(/\s+/g, '');
    if (!phoneClean) errors.phone = 'Vui lòng nhập số điện thoại.';
    else if (!/^(0|\+84)\d{9,10}$/.test(phoneClean)) errors.phone = 'Số điện thoại không hợp lệ (VD: 0912345678).';
    const total = Number(formState.seatCount) || 0;
    const split = (Number(formState.seatFront) || 0) + (Number(formState.seatMiddle) || 0) + (Number(formState.seatBack) || 0);
    // Số ghế và đầu/giữa/cuối độc lập: nhà xe nào chỉ cần một trong hai, chỉ cần có ít nhất một
    if (total + split < 1) errors.seats = 'Vui lòng nhập số ghế, hoặc ghế đầu/giữa/cuối.';
    setFormErrors(errors);
    if (errors.customerName || errors.phone || errors.seats) {
      // Hộp thoại che mất vùng trang bên dưới nên báo bằng toast nổi phía trên
      showToast([errors.customerName, errors.phone, errors.seats].filter(Boolean)[0] as string, 'error');
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
      seatCount: Number(formState.seatCount) || 0,
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
        const sent = await sendSelectedChannels(editingId);
        showToast(`Đã cập nhật vé thành công trên hệ thống!${sent}`);
      } else {
        const created = await createMutation.mutateAsync({
          ...payload,
          // Chỉ Admin được chỉ định nhân viên; nhân viên luôn là chính mình
          staffId: isAdmin ? formState.staffId : undefined,
        });
        const base = rebookFromId
          ? `Đã đặt lại đơn #${rebookFromId} thành đơn mới thành công!`
          : 'Đã thêm mới đơn vé vào cơ sở dữ liệu thành công!';
        showToast(`${base}${await sendSelectedChannels(created.id)}`);
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
                      <span className="mt-0.5 block text-[13px] font-bold text-slate-800 dark:text-slate-200">{formatDateVN(t.departureDate)}</span>
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
                            {t.messageChannel === 'ZALO' ? 'Đã gửi Zalo' : 'Đã gửi SMS'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Chưa gửi</span>
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
                        <button
                          type="button"
                          onClick={() => setHistoryOrderId(t.id)}
                          title="Xem lịch sử thay đổi của đơn"
                          className="btn-3d btn-3d-white px-2.5 py-1 text-[11px] flex items-center gap-1 whitespace-nowrap"
                        >
                          <ClockCounterClockwise size={13} weight="bold" /> Lịch sử
                        </button>
                        {!t.cancelledAt && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(t)}
                              title="Sửa vé"
                              className="btn-3d btn-3d-amber px-2.5 py-1 text-[11px] flex items-center gap-1 whitespace-nowrap"
                            >
                              <PencilSimple size={13} weight="bold" /> Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(t)}
                              title="Hủy vé (khách không đặt nữa)"
                              className="btn-3d btn-3d-red px-2.5 py-1 text-[11px] flex items-center gap-1 whitespace-nowrap"
                            >
                              <XCircle size={13} weight="bold" /> Hủy
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
          size="xl"
        >
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Cột trái: khách hàng + chuyến đi + ghi chú (ghi chú giãn cho bằng chiều cao cột phải) */}
              <div className="flex flex-col gap-4">
                <Section step={1} title="Khách hàng">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="Tên khách hàng" required error={formErrors.customerName}>
                      <input
                        className={`input-3d ${formErrors.customerName ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                        value={formState.customerName}
                        onChange={(e) => {
                          setFormState((p) => ({ ...p, customerName: e.target.value }));
                          setFormErrors((er) => ({ ...er, customerName: undefined }));
                        }}
                        maxLength={100}
                        aria-invalid={!!formErrors.customerName}
                        autoFocus
                      />
                    </Field>

                    <Field label="Số điện thoại" required error={formErrors.phone}>
                      <input
                        className={`input-3d font-mono font-bold ${formErrors.phone ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                        inputMode="tel"
                        value={formState.phone}
                        onChange={(e) => {
                          setFormState((p) => ({ ...p, phone: e.target.value }));
                          setFormErrors((er) => ({ ...er, phone: undefined }));
                        }}
                        aria-invalid={!!formErrors.phone}
                      />
                    </Field>

                    {isAdmin && !editingId && (
                      <div className="sm:col-span-2">
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
                      </div>
                    )}
                  </div>
                </Section>

                <Section step={2} title="Chuyến đi">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
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
                    </div>

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

                    <Field label="Đối tác">
                      <SuggestInput
                        options={partnerList.map((c) => c.name)}
                        value={formState.partner}
                        onChange={(v) => setFormState((p) => ({ ...p, partner: v }))}
                        maxLength={100}
                      />
                    </Field>

                    <Field label="Loại hình">
                      <select
                        className="input-3d"
                        value={formState.vehicleType}
                        onChange={(e) => setFormState((p) => ({ ...p, vehicleType: e.target.value }))}
                      >
                        {/* Ô trống ẩn: lúc chưa chọn hiện trống, mở danh sách chỉ thấy các loại hình */}
                        <option value="" hidden disabled />
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

                    <Field label="Điểm đón">
                      <input
                        className="input-3d"
                        value={formState.pickupPoint}
                        onChange={(e) => setFormState((p) => ({ ...p, pickupPoint: e.target.value }))}
                        maxLength={255}
                      />
                    </Field>

                    <Field label="Điểm trả">
                      <input
                        className="input-3d"
                        value={formState.dropoffPoint}
                        onChange={(e) => setFormState((p) => ({ ...p, dropoffPoint: e.target.value }))}
                        maxLength={255}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Ghi chú" className="flex min-h-[7rem] flex-1 flex-col">
                  <textarea
                    className="input-3d min-h-[5rem] flex-1 resize-none p-3"
                    value={formState.note}
                    onChange={(e) => setFormState((p) => ({ ...p, note: e.target.value }))}
                    maxLength={1000}
                  />
                </Section>
              </div>

              {/* Cột phải: số ghế + giá tiền */}
              <div className="space-y-4">
                <Section step={3} title="Số ghế">
                  <div className="grid max-w-sm grid-cols-4 gap-2">
                    {(
                      [
                        { key: 'seatCount', label: 'Số ghế' },
                        { key: 'seatFront', label: 'Đầu' },
                        { key: 'seatMiddle', label: 'Giữa' },
                        { key: 'seatBack', label: 'Cuối' },
                      ] as const
                    ).map((z) => (
                      <label
                        key={z.key}
                        className={`block rounded-lg border p-2 ${
                          z.key === 'seatCount'
                            ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60'
                        }`}
                      >
                        <span className="mb-1 block text-center text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {z.label}
                        </span>
                        <NumInput
                          className={`input-3d text-center font-bold ${formErrors.seats ? '!border-red-500' : ''}`}
                          value={formState[z.key]}
                          onChange={(n) => {
                            setFormState((p) => ({ ...p, [z.key]: n }));
                            setFormErrors((er) => ({ ...er, seats: undefined }));
                          }}
                          min={0}
                          max={60}
                          blankZero
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Số ghế và đầu/giữa/cuối độc lập: điền một trong hai tùy nhà xe (hoặc cả hai).
                  </p>
                  {formErrors.seats && (
                    <span role="alert" className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400">
                      {formErrors.seats}
                    </span>
                  )}
                </Section>

                <Section step={4} title="Giá tiền (VNĐ)">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="Giá nhập">
                      <MoneyInput className="input-3d" value={formState.costPrice} onChange={(n) => setFormState((p) => ({ ...p, costPrice: n }))} />
                    </Field>

                    <Field label="Giá bán" required>
                      <MoneyInput className="input-3d font-bold text-blue-900 dark:text-blue-400" value={formState.sellPrice} onChange={(n) => setFormState((p) => ({ ...p, sellPrice: n }))} required />
                    </Field>

                    <Field label="Đã cọc">
                      <MoneyInput className="input-3d" value={formState.deposit} onChange={(n) => setFormState((p) => ({ ...p, deposit: n }))} />
                    </Field>

                    <Field label="Nhờ thu">
                      <MoneyInput className="input-3d" value={formState.collectOnDelivery} onChange={(n) => setFormState((p) => ({ ...p, collectOnDelivery: n }))} />
                    </Field>

                    <Field label="Hoa hồng">
                      <MoneyInput className="input-3d font-bold text-red-600 dark:text-red-400" value={formState.commission} onChange={(n) => setFormState((p) => ({ ...p, commission: n }))} />
                    </Field>
                  </div>
                </Section>

                <Section step={5} title="Nội dung đơn (để sao chép)">
                  <div className="relative rounded-xl border border-dashed border-blue-300 bg-white p-3.5 pr-24 shadow-inner dark:border-blue-800 dark:bg-slate-900">
                    {previewLines.length === 0 ? (
                      <p className="text-sm text-slate-400">Điền thông tin bên trái, nội dung sẽ hiện ở đây.</p>
                    ) : (
                      <div className="space-y-1 font-mono text-sm font-semibold leading-relaxed text-slate-900 dark:text-slate-100">
                        {previewLines.map((line, i) => (
                          <div key={i} className="select-all break-words">
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleCopyPreview}
                      className="btn-3d btn-3d-blue absolute right-2.5 top-2.5 flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <Copy size={14} weight="bold" /> Sao chép
                    </button>
                  </div>
                </Section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {editingId ? 'Gửi lại tin cho khách khi cập nhật:' : 'Gửi tin cho khách khi lưu:'}
                </span>
                {(
                  [
                    { id: 'SMS', label: 'SMS' },
                    { id: 'ZALO', label: 'Zalo' },
                  ] as const
                ).map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded accent-blue-600"
                      checked={autoSend[o.id]}
                      onChange={(e) => setAutoSend((p) => ({ ...p, [o.id]: e.target.checked }))}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2.5">
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
            </div>
          </form>
        </Modal>
      )}

      {historyOrderId !== null && (
        <OrderHistoryModal orderId={historyOrderId} onClose={() => setHistoryOrderId(null)} />
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
