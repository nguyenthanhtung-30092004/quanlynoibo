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
  Trash,
  Ticket as TicketIcon,
} from '@phosphor-icons/react';
import { useOrders, useCreateOrder, useUpdateOrder, useDeleteOrder } from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { useActiveRoutes } from '@/features/routes/hooks';
import { usePartners } from '@/features/partners/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import { SEAT_ZONE_LABELS, SeatZone, type CreateOrderInput, type MessageChannel, type Order, type OrderFilters } from '@/features/orders/types';
import { Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { useSound } from '@/features/xvip/sound';

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
  seatZone: SeatZone | '';
  departureTime: string;
  departureDate: string;
  sellPrice: number;
  costPrice: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
  seatCount: number;
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

  const { playSuccess, playWarn } = useSound();

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [smsOrder, setSmsOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
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
      seatZone: '',
      departureTime: '13:00',
      departureDate: todayStr,
      sellPrice: 0,
      costPrice: 0,
      deposit: 0,
      collectOnDelivery: 0,
      commission: 0,
      seatCount: 1,
      pickupPoint: '',
      dropoffPoint: '',
      note: '',
    }),
    [todayStr],
  );

  const [formState, setFormState] = useState<OrderFormState>(defaultFormState);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormState(defaultFormState);
    setIsOpenModal(true);
  };

  const handleOpenEdit = (o: Order) => {
    setEditingId(o.id);
    setFormState({
      customerName: o.customerName ?? '',
      phone: o.phone,
      routeId: o.route?.id ?? 0,
      partner: o.partner ?? '',
      vehicleType: o.vehicleType ?? '',
      seatZone: o.seatZone ?? '',
      departureTime: o.departureTime,
      departureDate: o.departureDate,
      sellPrice: o.sellPrice,
      costPrice: o.costPrice,
      deposit: o.deposit,
      collectOnDelivery: o.collectOnDelivery,
      commission: o.commission,
      seatCount: o.seatCount,
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
      seatZone: formState.seatZone || undefined,
      departureTime: formState.departureTime,
      departureDate: formState.departureDate,
      sellPrice: Number(formState.sellPrice),
      costPrice: Number(formState.costPrice),
      deposit: Number(formState.deposit),
      collectOnDelivery: Number(formState.collectOnDelivery),
      commission: Number(formState.commission),
      seatCount: Number(formState.seatCount) || 1,
      pickupPoint: formState.pickupPoint.trim() || undefined,
      dropoffPoint: formState.dropoffPoint.trim() || undefined,
      note: formState.note.trim() || undefined,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        playSuccess();
        showToast('Đã cập nhật vé thành công trên hệ thống!');
      } else {
        await createMutation.mutateAsync({
          ...payload,
          // Chỉ Admin được chỉ định nhân viên; nhân viên luôn là chính mình
          staffId: isAdmin ? formState.staffId : undefined,
        });
        playSuccess();
        showToast('Đã thêm mới đơn vé vào cơ sở dữ liệu thành công!');
      }
      refetch();
      setIsOpenModal(false);
    } catch (err: unknown) {
      playWarn();
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lưu đơn vé.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      playSuccess();
      showToast(`Đã xóa đơn vé #${deleteTarget.id} khỏi hệ thống.`);
      refetch();
    } catch (err: unknown) {
      playWarn();
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
      playSuccess();
      showToast(
        res.dryRun
          ? `Chế độ thử: chưa gửi ${label} thật tới khách (Sandbox hoặc chưa cấu hình nhà cung cấp).`
          : `Đã gửi tin ${label} cho khách hàng thành công!`,
      );
      setSmsOrder(null);
      refetch();
    } catch (err: unknown) {
      playWarn();
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
      playSuccess();
      showToast('Đã kết xuất dữ liệu vé ra file Excel thành công!');
    } catch {
      playWarn();
      showToast('Lỗi khi xuất file Excel từ máy chủ.');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    playSuccess();
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
                  <tr key={t.id} className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors">
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{i + 1}</td>
                    <td className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}>
                      #{t.id}
                    </td>
                    <td className={`${TD} font-bold text-blue-700 dark:text-blue-400`}>
                      {t.departureTime}
                      <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">{t.departureDate}</span>
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
                      {isAdmin ? (
                      <div className="flex items-center justify-center gap-2">
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
                          onClick={() => setDeleteTarget(t)}
                          title="Xóa vé"
                          className="btn-3d-mini text-rose-600 hover:text-rose-700"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
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
          title={editingId ? `Cập nhật đơn vé #${editingId}` : 'Thêm vé / Đơn đặt xe mới'}
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

              <Field label="Vị trí ghế (Đầu / Giữa / Cuối)">
                <select
                  className="input-3d"
                  value={formState.seatZone}
                  onChange={(e) => setFormState((p) => ({ ...p, seatZone: e.target.value as SeatZone | '' }))}
                >
                  <option value="">Không chọn</option>
                  {Object.values(SeatZone).map((z) => (
                    <option key={z} value={z}>
                      {SEAT_ZONE_LABELS[z]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Số ghế" required>
                <NumInput className="input-3d" value={formState.seatCount} onChange={(n) => setFormState((p) => ({ ...p, seatCount: n }))} min={1} max={60} />
              </Field>

              <Field label="Giá nhập (VNĐ)">
                <NumInput className="input-3d" value={formState.costPrice} onChange={(n) => setFormState((p) => ({ ...p, costPrice: n }))} min={0} step={5000} />
              </Field>

              <Field label="Giá bán (VNĐ)" required>
                <NumInput className="input-3d font-bold text-blue-900 dark:text-blue-400" value={formState.sellPrice} onChange={(n) => setFormState((p) => ({ ...p, sellPrice: n }))} min={0} step={5000} required />
              </Field>

              <Field label="Đã cọc (VNĐ)">
                <NumInput className="input-3d" value={formState.deposit} onChange={(n) => setFormState((p) => ({ ...p, deposit: n }))} min={0} step={5000} />
              </Field>

              <Field label="Nhờ thu (VNĐ)">
                <NumInput className="input-3d" value={formState.collectOnDelivery} onChange={(n) => setFormState((p) => ({ ...p, collectOnDelivery: n }))} min={0} step={5000} />
              </Field>

              <Field label="Hoa hồng (VNĐ)">
                <NumInput className="input-3d font-bold text-red-600 dark:text-red-400" value={formState.commission} onChange={(n) => setFormState((p) => ({ ...p, commission: n }))} min={0} step={1000} />
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
                {editingId ? 'Cập nhật vé' : 'Lưu vé vào máy chủ'}
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
                  `Thông tin: Quý khách ${smsOrder.customerName || ''} đặt thành công vé xe tuyến ${smsOrder.route?.name || ''} lúc ${smsOrder.departureTime} ngày ${smsOrder.departureDate}. Tổng đài 1900 1977. Trân trọng!`}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    smsOrder.smsContent ||
                      `Thông tin: Quý khách ${smsOrder.customerName || ''} đặt thành công vé xe tuyến ${smsOrder.route?.name || ''} lúc ${smsOrder.departureTime} ngày ${smsOrder.departureDate}. Tổng đài 1900 1977. Trân trọng!`
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
