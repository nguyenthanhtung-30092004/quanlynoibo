'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  CheckCircle,
  FileXls,
  UploadSimple,
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
import {
  useKpiFilterOptions,
  useOrders,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useCancelOrder,
  useImportOrders,
} from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { useActiveRoutes } from '@/features/routes/hooks';
import { usePartners } from '@/features/partners/hooks';
import { partnersApi } from '@/features/partners/api';
import { useActiveStaff } from '@/features/users/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import {
  type CreateOrderInput,
  type ImportResult,
  type MessageChannel,
  type Order,
  type OrderFilters,
} from '@/features/orders/types';
import { useToast } from '@/features/xvip/toast';
import { Card, NUM, PageTitle, TD, TH } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { getVnToday } from '@/lib/time';
import { parseOrderText } from '@/features/orders/parse-order-text';

import { Modal } from '@/features/xvip/Modal';
import { handleArrowNav } from '@/features/xvip/arrow-nav';
import { OrderDetailModal } from '@/features/orders/components/OrderDetailModal';
import { OrderHistoryModal } from '@/features/orders/components/OrderHistoryModal';
import { Pagination } from '@/features/xvip/Pagination';
import { ORDERS_ALL_SIZE, ORDERS_PAGE_SIZE } from '@/features/orders/constants';
import { MultiCheckSelect } from '@/features/xvip/MultiCheckSelect';
import { RouteCombobox } from '@/features/xvip/RouteCombobox';
import { AutoGrowInput } from '@/features/xvip/AutoGrowInput';
import { OptionFilterInput } from '@/features/xvip/OptionFilterInput';
import { SuggestInput } from '@/features/xvip/SuggestInput';
import { DateInput, TimeInput } from '@/features/xvip/PickerInput';
import {
  BASIS_LABEL,
  DateRangeFilter,
  rangeParams,
  useDateFilter,
} from '@/features/xvip/date-filter';
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
    setText((t) =>
      Number(t.replace(/\D/g, '') || 0) === value ? t : fmt(value),
    );
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
        <span
          role="alert"
          className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400"
        >
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
    <section
      className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40 ${className}`}
    >
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

/** Nội dung đơn dạng chữ từ form, điền tới đâu hiện tới đó, để xem, sửa và sao chép gửi đi nơi khác */
function buildPreviewLines(f: OrderFormState): string[] {
  const join = (parts: (string | false | undefined)[], sep = ' - ') =>
    parts.filter(Boolean).join(sep);
  const seats = Number(f.seatCount) || 0;
  const zones = [
    Number(f.seatFront) > 0 && `${Number(f.seatFront)} ghế đầu`,
    Number(f.seatMiddle) > 0 && `${Number(f.seatMiddle)} ghế giữa`,
    Number(f.seatBack) > 0 && `${Number(f.seatBack)} ghế cuối`,
  ].filter(Boolean);
  return [
    join(
      [f.departureTime, f.departureDate && formatDateVN(f.departureDate)],
      ' ngày ',
    ),
    join([f.customerName.trim(), f.phone.trim()]),
    f.pickupPoint.trim() && `Đón: ${f.pickupPoint.trim()}`,
    f.dropoffPoint.trim() && `Trả: ${f.dropoffPoint.trim()}`,
    seats > 0 && `${seats} ghế`,
    zones.length > 0 && zones.join(' + '),
  ].filter((line): line is string => !!line);
}

/** Lý do hủy hay gặp, bấm để điền nhanh vào ô lý do */
const CANCEL_REASONS = [
  'Khách không đi nữa',
  'Khách đổi giờ / ngày',
  'Nhập nhầm vé',
  'Nhà xe hết chỗ',
  'Khách không liên lạc được',
];

/** Lỗi từng ô trong form vé, hiện chữ đỏ ngay dưới ô đó */
interface FormErrors {
  customerName?: string;
  phone?: string;
  routeId?: string;
  departureTime?: string;
  departureDate?: string;
  partner?: string;
  vehicleType?: string;
  seats?: string;
}

export default function TicketManagementPage() {
  const [localFilters, setFilters] = useState<OrderFilters>({
    search: '',
    staffId: ALL,
    routeId: ALL,
    routeIds: [],
    dateFrom: null,
    dateTo: null,
    page: 1,
  });

  // Khoảng ngày lấy từ bộ lọc ở header (theo ngày đi hoặc ngày tạo vé)
  const { range, basis, label: rangeLabel } = useDateFilter();
  // Đang gõ tìm kiếm thì tìm trong tất cả vé, bỏ qua mọi bộ lọc khác
  const searching = localFilters.search.trim() !== '';
  const filters = useMemo<OrderFilters>(
    () =>
      searching
        ? {
            search: localFilters.search,
            staffId: ALL,
            routeId: ALL,
            routeIds: [],
            dateFrom: null,
            dateTo: null,
            departureFrom: null,
            departureTo: null,
            page: localFilters.page,
          }
        : {
            ...localFilters,
            // Xem theo ngày: hiện hết vé của khoảng ngày đang chọn, không chia trang
            page: 1,
            pageSize: ORDERS_ALL_SIZE,
            dateFrom: null,
            dateTo: null,
            departureFrom: null,
            departureTo: null,
            ...rangeParams(range, basis),
          },
    [localFilters, range, basis, searching],
  );
  useEffect(() => {
    setFilters((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [range, basis]);

  const { data: ordersData, isLoading, refetch } = useOrders(filters);
  const { data: activeRoutes = [] } = useActiveRoutes();
  const { data: partnerList = [] } = usePartners();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  // Danh sách nhân viên chỉ Admin được xem (backend trả 403 cho nhân viên)
  const { data: activeStaff = [] } = useActiveStaff(isAdmin);

  // Các ô lọc chỉ gợi ý tuyến / đối tác có đơn trong khoảng ngày đang xem; chọn nhân viên thì
  // thu hẹp tiếp theo đơn của người đó. Đang tìm kiếm thì tìm trong tất cả vé nên không thu hẹp.
  const staffSelected = typeof filters.staffId === 'number';
  const { data: filterOptions } = useKpiFilterOptions(
    {
      ...rangeParams(range, basis),
      staffId: staffSelected ? (filters.staffId as number) : undefined,
    },
    !searching,
  );
  const staffOptions = useMemo(() => {
    if (!filterOptions) return activeStaff;
    const ids = new Set(filterOptions.staffIds);
    return activeStaff.filter((u) => ids.has(u.id));
  }, [activeStaff, filterOptions]);
  const routeFilterOptions = useMemo(() => {
    if (!filterOptions) return activeRoutes;
    const ids = new Set(filterOptions.routeIds);
    return activeRoutes.filter((r) => ids.has(r.id));
  }, [filterOptions, activeRoutes]);
  const partnerFilterOptions = useMemo(() => {
    if (!filterOptions) return partnerList;
    const names = new Set(filterOptions.partners.map((n) => n.toLowerCase()));
    return partnerList.filter((p) => names.has(p.name.trim().toLowerCase()));
  }, [filterOptions, partnerList]);

  // Đổi ngày / nhân viên mà mục đang chọn không còn trong gợi ý thì bỏ chọn mục đó
  useEffect(() => {
    if (!filterOptions) return;
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      if (typeof prev.staffId === 'number' && !filterOptions.staffIds.includes(prev.staffId)) {
        next.staffId = ALL;
        next.routeIds = [];
        next.partner = undefined;
        changed = true;
      } else {
        const keepRoutes = (prev.routeIds ?? []).filter((id) => filterOptions.routeIds.includes(id));
        if (keepRoutes.length !== (prev.routeIds ?? []).length) {
          next.routeIds = keepRoutes;
          changed = true;
        }
        if (
          prev.partner &&
          !filterOptions.partners.some((n) => n.toLowerCase() === prev.partner!.trim().toLowerCase())
        ) {
          next.partner = undefined;
          changed = true;
        }
      }
      return changed ? { ...next, page: 1 } : prev;
    });
  }, [filterOptions]);

  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const deleteMutation = useDeleteOrder();
  const cancelMutation = useCancelOrder();
  const importMutation = useImportOrders();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Đang đặt lại từ đơn nào (tạo đơn mới dựa trên đơn cũ)
  const [rebookFromId, setRebookFromId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [historyOrderId, setHistoryOrderId] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  // Kênh tự động gửi cho khách ngay khi lưu vé mới
  const [autoSend, setAutoSend] = useState<Record<MessageChannel, boolean>>({
    SMS: false,
    ZALO: false,
  });

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
      departureTime: '',
      departureDate: '',
      sellPrice: 0,
      costPrice: 0,
      deposit: 0,
      collectOnDelivery: 0,
      commission: 0,
      pickupPoint: '',
      dropoffPoint: '',
      note: '',
    }),
    [],
  );

  const [formState, setFormState] = useState<OrderFormState>(defaultFormState);

  // Ô "Nội dung đơn": vừa hiện chữ từ form, vừa cho dán/sửa chữ để tự điền ngược vào form
  const [boxText, setBoxText] = useState('');
  // Nội dung form tương ứng với chữ người dùng vừa gõ, để không ghi đè chữ đang gõ
  const ownText = useRef<string | null>(null);
  const [boxVersion, setBoxVersion] = useState(0);
  const generatedText = buildPreviewLines(formState).join('\n');

  useEffect(() => {
    if (ownText.current !== null && ownText.current === generatedText) return;
    ownText.current = null;
    setBoxText(generatedText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedText, boxVersion]);

  // Ô nội dung tự cao theo số dòng để thấy hết chữ, không phải cuộn trong ô
  const boxRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [boxText, isOpenModal]);

  // Hoa hồng tự tính = hoa hồng mỗi vé của nhà xe x số vé; chỉ chạy lại khi đổi nhà xe hoặc số vé
  const lastQuoteKey = useRef<string | null>(null);
  // Ghi chú nhỏ dưới ô Hoa hồng cho biết đã tự tính chưa, hay vì sao chưa tính được
  const [quoteNote, setQuoteNote] = useState('');
  const quoteTickets =
    Number(formState.seatCount) > 0
      ? Number(formState.seatCount)
      : (Number(formState.seatFront) || 0) +
        (Number(formState.seatMiddle) || 0) +
        (Number(formState.seatBack) || 0);
  useEffect(() => {
    if (!isOpenModal) return;
    const key = `${formState.partner.trim().toLowerCase()}|${quoteTickets}`;
    // Sửa vé cũ: lần đầu mở chỉ ghi nhớ, không ghi đè hoa hồng đã lưu
    if (editingId && lastQuoteKey.current === null) {
      lastQuoteKey.current = key;
      return;
    }
    if (key === lastQuoteKey.current) return;
    lastQuoteKey.current = key;
    // Xóa hết ghế thì hoa hồng cũng về trống, không giữ số của lần chọn ghế trước
    if (quoteTickets < 1) {
      setFormState((p) => (p.commission ? { ...p, commission: 0 } : p));
      setQuoteNote('');
      return;
    }
    if (!formState.partner.trim()) {
      setQuoteNote('');
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      partnersApi
        .commissionQuote(formState.partner, quoteTickets, ctrl.signal)
        .then((commission) => {
          if (commission !== null) {
            setFormState((p) => ({ ...p, commission }));
            setQuoteNote(`Tự tính theo nhà xe x ${quoteTickets} vé`);
          } else {
            setQuoteNote('Nhà xe này chưa có mức hoa hồng mỗi vé, bạn nhập tay');
          }
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          setQuoteNote(
            `Không tự tính được hoa hồng${err instanceof Error ? ` (${err.message})` : ''}, bạn nhập tay`,
          );
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpenModal, editingId, formState.partner, quoteTickets]);

  /** Mở form mới / vé khác: ô nội dung quay về hiện đúng theo form */
  const resetBox = () => {
    lastQuoteKey.current = null;
    setQuoteNote('');
    ownText.current = null;
    setBoxVersion((v) => v + 1);
  };

  const handleBoxChange = (text: string) => {
    const year = Number(getVnToday().slice(0, 4));
    const prev = parseOrderText(boxText, year);
    const next = parseOrderText(text, year);
    // Dòng nào bị xóa khỏi ô chữ thì ô tương ứng trong form về trống
    const cleared: Record<string, string | number> = {};
    for (const k of Object.keys(prev)) {
      if (!(k in next)) {
        cleared[k] = k.startsWith('seat') ? 0 : '';
      }
    }
    const merged = { ...formState, ...cleared, ...next };
    setBoxText(text);
    ownText.current = buildPreviewLines(merged).join('\n');
    setFormState(merged);
    setFormErrors((er) => {
      const out = { ...er };
      if (next.departureTime) delete out.departureTime;
      if (next.departureDate) delete out.departureDate;
      if (next.phone) delete out.phone;
      if (next.customerName) delete out.customerName;
      if (next.seatCount || next.seatFront || next.seatMiddle || next.seatBack)
        delete out.seats;
      return out;
    });
  };

  const handleOpenCreate = () => {
    resetBox();
    setEditingId(null);
    setRebookFromId(null);
    setFormState(defaultFormState);
    setFormErrors({});
    // Vé mới: mặc định gửi Zalo cho khách (nhân viên bỏ tích nếu không muốn gửi)
    setAutoSend({ SMS: false, ZALO: true });
    setIsOpenModal(true);
  };

  /** Đặt lại: điền sẵn dữ liệu đơn cũ, ngày đi về hôm nay; lưu sẽ tạo đơn mới */
  const handleOpenRebook = (o: Order) => {
    resetBox();
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
    // Đặt lại cũng là tạo vé mới nên mặc định gửi Zalo như vé mới
    setAutoSend({ SMS: false, ZALO: true });
    setIsOpenModal(true);
  };

  const handleOpenEdit =(o: Order) => {
    resetBox();
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

  const handleCopyPreview = async () => {
    const text = boxText.trim();
    if (!text) {
      showToast('Chưa có nội dung để sao chép.', 'info');
      return;
    }
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
        showToast(
          'Không sao chép được, hãy bôi đen và copy thủ công.',
          'error',
        );
        return;
      }
    }
    showToast('Đã sao chép nội dung đơn.');
  };

  /** Gửi tin theo các kênh đã tích; trả về câu kết quả để nối vào thông báo (rỗng nếu không tích kênh nào) */
  const sendSelectedChannels = async (orderId: number) => {
    const channels = (['SMS', 'ZALO'] as const).filter((ch) => autoSend[ch]);
    if (channels.length === 0) return '';
    const results = await Promise.allSettled(
      channels.map((ch) => ordersApi.sendMessage(orderId, ch)),
    );
    const parts = results.map((r, i) => {
      const label = channels[i] === 'ZALO' ? 'Zalo' : 'SMS';
      if (r.status === 'rejected') return `${label}: lỗi`;
      return r.value.dryRun ? `${label}: chạy thử` : `${label}: đã gửi`;
    });
    return ` Gửi tin cho khách — ${parts.join(', ')}.`;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const errors: FormErrors = {};
    if (!formState.customerName.trim())
      errors.customerName = 'Vui lòng nhập tên khách hàng.';
    if (!formState.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại.';
    } else if (/\s/.test(formState.phone)) {
      errors.phone = 'Số điện thoại không được chứa dấu cách.';
    } else if (!/^(0|\+84)\d{9,10}$/.test(formState.phone)) {
      errors.phone = 'Số điện thoại không hợp lệ (VD: 0912345678).';
    }
    if (!formState.routeId) errors.routeId = 'Vui lòng chọn tuyến đường.';
    if (!formState.departureTime)
      errors.departureTime = 'Vui lòng chọn giờ đi.';
    if (!formState.departureDate)
      errors.departureDate = 'Vui lòng chọn ngày khởi hành.';
    else if (!editingId && formState.departureDate < getVnToday())
      // Vé mới không được đặt cho ngày đã qua (kể cả khi dán nội dung vào ô chữ)
      errors.departureDate = 'Ngày khởi hành không được trước hôm nay.';
    if (!formState.partner.trim()) errors.partner = 'Vui lòng nhập đối tác.';
    if (!formState.vehicleType.trim())
      errors.vehicleType = 'Vui lòng chọn loại hình.';
    const total = Number(formState.seatCount) || 0;
    const split =
      (Number(formState.seatFront) || 0) +
      (Number(formState.seatMiddle) || 0) +
      (Number(formState.seatBack) || 0);
    // Điền số ghế, hoặc điền đầu/giữa/cuối; thiếu cả hai thì báo lỗi
    if (total + split < 1)
      errors.seats = 'Vui lòng nhập số ghế, hoặc ghế đầu/giữa/cuối.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: CreateOrderInput = {
      customerName: formState.customerName.trim() || undefined,
      phone: formState.phone.trim(),
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
          ? `Đã đặt lại đơn ${formatOrderCode(rebookFromId)} thành đơn mới thành công!`
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

  const openCancel = (o: Order) => {
    setCancelReason('');
    setCancelError('');
    setCancelTarget(o);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Vui lòng nhập lý do hủy vé.');
      return;
    }
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget.id, reason });
      showToast(
        `Đã hủy vé ${formatOrderCode(cancelTarget.id)}. Vé không còn tính vào doanh thu.`,
      );
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
      showToast(`Đã xóa đơn vé ${formatOrderCode(deleteTarget.id)} khỏi hệ thống.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xóa đơn vé.';
      showToast(`Lỗi: ${msg}`);
    }
    setDeleteTarget(null);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (importInputRef.current) importInputRef.current.value = '';
    if (!file) return;
    try {
      const result = await importMutation.mutateAsync(file);
      setImportResult(result);
      if (result.created > 0) refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không nhập được file.';
      showToast(`Lỗi: ${msg}`, 'error');
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

  const ordersList: Order[] = ordersData?.data ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const currentPage = filters.page;
  const pageSize = filters.pageSize ?? ORDERS_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(totalOrders / pageSize));
  // Xóa hết đơn ở trang cuối thì lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (ordersData && currentPage > lastPage) {
      setFilters((prev) => ({ ...prev, page: lastPage }));
    }
  }, [ordersData, currentPage, lastPage]);

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleImportFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn-3d btn-3d-white flex items-center gap-2 px-4 py-2.5 text-sm"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  <UploadSimple size={18} weight="bold" />{' '}
                  {importMutation.isPending ? 'Đang nhập...' : 'Nhập Excel'}
                </button>
                <button
                  type="button"
                  className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
                  onClick={handleExportExcel}
                >
                  <FileXls size={18} weight="bold" /> Xuất Excel
                </button>
              </>
            )}
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
          <label className="block min-w-64 flex-[1.6]">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tìm kiếm nhanh
            </span>
            <span className="relative block">
              <MagnifyingGlass
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                className="input-3d pl-9"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: e.target.value,
                    page: 1,
                  }))
                }
                placeholder="Mã đơn (XV116), tên khách, số điện thoại, điểm đón..."
              />
            </span>
          </label>

          <div className="block min-w-60 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Thời gian
            </span>
            <DateRangeFilter align="right" />
          </div>

          {activeStaff.length > 0 && (
            <label className="block min-w-44 flex-1">
              <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nhân viên
              </span>
              <OptionFilterInput
                options={staffOptions.map((s) => ({ value: String(s.id), label: s.fullName }))}
                value={filters.staffId === ALL ? '' : String(filters.staffId)}
                allLabel="Tất cả nhân viên"
                onChange={(v) =>
                  setFilters((prev) => ({
                    ...prev,
                    staffId: v === '' ? ALL : Number(v),
                    // Đổi nhân viên thì bỏ tuyến / đối tác đang chọn vì người mới có thể không có
                    routeIds: [],
                    partner: undefined,
                    page: 1,
                  }))
                }
              />
            </label>
          )}

          <div className="block min-w-48 sm:min-w-56 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tuyến đường
            </span>
            <MultiCheckSelect
              options={routeFilterOptions.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
              value={filters.routeIds ?? []}
              onChange={(routeIds) =>
                setFilters((prev) => ({ ...prev, routeIds, page: 1 }))
              }
              allLabel="Tất cả tuyến"
              searchPlaceholder="Tìm tuyến..."
            />
          </div>

          <label className="block min-w-44 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Đối tác
            </span>
            <OptionFilterInput
              options={partnerFilterOptions.map((p) => ({ value: p.name, label: p.name }))}
              value={filters.partner ?? ''}
              allLabel="Tất cả đối tác"
              onChange={(v) =>
                setFilters((prev) => ({ ...prev, partner: v || undefined, page: 1 }))
              }
            />
          </label>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {searching
            ? 'Đang tìm trong tất cả vé, không theo bộ lọc ngày, tuyến, đối tác, nhân viên. Xóa ô tìm kiếm để quay lại bộ lọc.'
            : `Đang lọc theo ${BASIS_LABEL[basis].toLowerCase()}: ${rangeLabel}.`}
        </p>
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
                  <td
                    colSpan={12}
                    className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse"
                  >
                    Đang tải danh sách vé từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : ordersList.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400"
                  >
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
                    onClick={() => setDetailOrder(t)}
                    title="Bấm để xem chi tiết"
                    className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors ${
                      t.cancelledAt
                        ? 'bg-slate-50 opacity-60 dark:bg-slate-900/60'
                        : ''
                    }`}
                  >
                    <td
                      className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}
                    >
                      {(currentPage - 1) * pageSize + i + 1}
                    </td>
                    <td
                      className={`${TD} font-mono text-xs font-bold text-blue-900 dark:text-blue-400`}
                    >
                      {formatOrderCode(t.id)}
                      {t.cancelledAt && (
                        <span className="mt-1 block w-fit rounded-md bg-rose-100 px-1.5 py-0.5 font-sans text-[10px] font-extrabold uppercase text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Đã hủy
                        </span>
                      )}
                    </td>
                    <td
                      className={`${TD} font-bold text-blue-700 dark:text-blue-400`}
                    >
                      {t.departureTime}
                      <span className="mt-0.5 block text-[13px] font-bold text-slate-800 dark:text-slate-200">
                        {formatDateVN(t.departureDate)}
                      </span>
                    </td>
                    <td
                      className={`${TD} font-bold text-slate-800 dark:text-slate-200`}
                    >
                      {t.partner || 'XVIP'}
                    </td>
                    <td
                      className={`${TD} font-semibold text-slate-700 dark:text-slate-300`}
                    >
                      {t.route?.name || 'Tuyến liên tỉnh'}
                    </td>
                    <td
                      className={`${TD} font-bold text-slate-900 dark:text-white`}
                    >
                      {t.customerName || 'Khách lẻ'}
                    </td>
                    <td
                      className={`${TD} tnum font-semibold text-slate-600 dark:text-slate-300`}
                    >
                      {t.phone}
                    </td>
                    <td
                      className={`${TD} ${NUM} text-slate-900 dark:text-white`}
                    >
                      {money(t.sellPrice)}đ
                    </td>
                    <td
                      className={`${TD} ${NUM} font-black text-red-600 dark:text-red-400`}
                    >
                      {money(t.commission)}đ
                    </td>
                    <td
                      className={`${TD} text-slate-800 dark:text-slate-300 font-semibold`}
                    >
                      {t.staff?.fullName || 'NV'}
                    </td>
                    <td className={TD}>
                      {t.smsSent ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle
                            size={17}
                            weight="fill"
                            className="text-emerald-600"
                          />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {t.messageChannel === 'ZALO'
                              ? 'Đã gửi Zalo'
                              : 'Đã gửi SMS'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          Chưa gửi
                        </span>
                      )}
                    </td>
                    <td
                      className={`${TD} text-center`}
                      onClick={(e) => e.stopPropagation()}
                    >
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
                          <ClockCounterClockwise size={13} weight="bold" /> Lịch
                          sử
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
                              onClick={() => openCancel(t)}
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
        {!isLoading && totalOrders > pageSize && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={totalOrders}
            onChange={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        )}
      </Card>

      {/* Modal Thêm / Sửa Vé */}
      {isOpenModal && (
        <Modal
          title={
            editingId
              ? `Cập nhật đơn vé ${formatOrderCode(editingId)}`
              : rebookFromId
                ? `Đặt lại đơn ${formatOrderCode(rebookFromId)} (tạo đơn mới)`
                : 'Thêm vé / Đơn đặt xe mới'
          }
          onClose={() => setIsOpenModal(false)}
          size="xl"
        >
          <form
            onSubmit={handleSave}
            onKeyDown={(e) => handleArrowNav(e, e.currentTarget)}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Cột trái: khách hàng + chuyến đi + ghi chú (ghi chú giãn cho bằng chiều cao cột phải) */}
              <div className="flex flex-col gap-4">
                <Section step={1} title="Khách hàng">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field
                      label="Tên khách hàng"
                      required
                      error={formErrors.customerName}
                    >
                      <AutoGrowInput
                        invalid={!!formErrors.customerName}
                        value={formState.customerName}
                        onChange={(v) => {
                          setFormState((p) => ({
                            ...p,
                            customerName: v,
                          }));
                          setFormErrors((er) => ({
                            ...er,
                            customerName: undefined,
                          }));
                        }}
                        maxLength={100}
                        autoFocus
                      />
                    </Field>

                    <Field
                      label="Số điện thoại"
                      required
                      error={formErrors.phone}
                    >
                      <input
                        className={`input-3d font-mono font-bold ${formErrors.phone ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                        inputMode="tel"
                        value={formState.phone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormState((p) => ({
                            ...p,
                            phone: val,
                          }));
                          if (/\s/.test(val)) {
                            setFormErrors((er) => ({
                              ...er,
                              phone: 'Số điện thoại không được chứa dấu cách.',
                            }));
                          } else {
                            setFormErrors((er) => ({ ...er, phone: undefined }));
                          }
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
                              setFormState((p) => ({
                                ...p,
                                staffId: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              }))
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
                      <Field
                        label="Tuyến đường"
                        required
                        error={formErrors.routeId}
                      >
                        <RouteCombobox
                          routes={activeRoutes}
                          value={formState.routeId}
                          invalid={!!formErrors.routeId}
                          onChange={(rId) => {
                            setFormErrors((er) => ({
                              ...er,
                              routeId: undefined,
                            }));
                            const selRoute = activeRoutes.find(
                              (r) => r.id === rId,
                            );
                            setFormState((p) => ({
                              ...p,
                              routeId: rId,
                              // Chỉ gợi ý giá bán theo giá mặc định của tuyến, vẫn sửa được
                              sellPrice: selRoute?.defaultPrice
                                ? selRoute.defaultPrice
                                : p.sellPrice,
                            }));
                          }}
                        />
                      </Field>
                    </div>

                    <Field
                      label="Giờ đi"
                      required
                      error={formErrors.departureTime}
                    >
                      <TimeInput
                        value={formState.departureTime}
                        invalid={!!formErrors.departureTime}
                        onChange={(v) => {
                          setFormState((p) => ({ ...p, departureTime: v }));
                          setFormErrors((er) => ({
                            ...er,
                            departureTime: undefined,
                          }));
                        }}
                      />
                    </Field>

                    <Field
                      label="Ngày khởi hành"
                      required
                      error={formErrors.departureDate}
                    >
                      <DateInput
                        min={getVnToday()}
                        value={formState.departureDate}
                        invalid={!!formErrors.departureDate}
                        onChange={(v) => {
                          setFormState((p) => ({ ...p, departureDate: v }));
                          setFormErrors((er) => ({
                            ...er,
                            departureDate: undefined,
                          }));
                        }}
                      />
                    </Field>

                    <Field label="Đối tác" required error={formErrors.partner}>
                      <SuggestInput
                        options={partnerList.map((c) => c.name)}
                        value={formState.partner}
                        invalid={!!formErrors.partner}
                        onChange={(v) => {
                          setFormState((p) => ({ ...p, partner: v }));
                          setFormErrors((er) => ({
                            ...er,
                            partner: undefined,
                          }));
                        }}
                        maxLength={100}
                      />
                    </Field>

                    <Field
                      label="Loại hình"
                      required
                      error={formErrors.vehicleType}
                    >
                      <select
                        className={`input-3d ${formErrors.vehicleType ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                        aria-invalid={!!formErrors.vehicleType}
                        value={formState.vehicleType}
                        onChange={(e) => {
                          setFormState((p) => ({
                            ...p,
                            vehicleType: e.target.value,
                          }));
                          setFormErrors((er) => ({
                            ...er,
                            vehicleType: undefined,
                          }));
                        }}
                      >
                        {/* Ô trống ẩn: lúc chưa chọn hiện trống, mở danh sách chỉ thấy các loại hình */}
                        <option value="" hidden disabled />
                        {/* Vé cũ có loại hình ngoài danh sách vẫn hiển thị đúng khi sửa */}
                        {formState.vehicleType &&
                          !VEHICLE_TYPES.includes(formState.vehicleType) && (
                            <option value={formState.vehicleType}>
                              {formState.vehicleType}
                            </option>
                          )}
                        {VEHICLE_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Điểm đón">
                      <AutoGrowInput
                        value={formState.pickupPoint}
                        onChange={(v) =>
                          setFormState((p) => ({
                            ...p,
                            pickupPoint: v,
                          }))
                        }
                        maxLength={255}
                      />
                    </Field>

                    <Field label="Điểm trả">
                      <AutoGrowInput
                        value={formState.dropoffPoint}
                        onChange={(v) =>
                          setFormState((p) => ({
                            ...p,
                            dropoffPoint: v,
                          }))
                        }
                        maxLength={255}
                      />
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Ghi chú"
                  className="flex min-h-[7rem] flex-1 flex-col"
                >
                  <textarea
                    className="input-3d min-h-[5rem] flex-1 resize-none p-3"
                    value={formState.note}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, note: e.target.value }))
                    }
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
                            setFormErrors((er) => ({
                              ...er,
                              seats: undefined,
                            }));
                          }}
                          min={0}
                          max={60}
                          blankZero
                        />
                      </label>
                    ))}
                  </div>
                  {formErrors.seats && (
                    <span
                      role="alert"
                      className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400"
                    >
                      {formErrors.seats}
                    </span>
                  )}
                </Section>

                <Section step={4} title="Giá tiền (VNĐ)">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="Giá nhập">
                      <MoneyInput
                        className="input-3d"
                        value={formState.costPrice}
                        onChange={(n) =>
                          setFormState((p) => ({ ...p, costPrice: n }))
                        }
                      />
                    </Field>

                    <Field label="Giá bán" required>
                      <MoneyInput
                        className="input-3d font-bold text-blue-900 dark:text-blue-400"
                        value={formState.sellPrice}
                        onChange={(n) =>
                          setFormState((p) => ({ ...p, sellPrice: n }))
                        }
                        required
                      />
                    </Field>

                    <Field label="Đã cọc">
                      <MoneyInput
                        className="input-3d"
                        value={formState.deposit}
                        onChange={(n) =>
                          setFormState((p) => ({ ...p, deposit: n }))
                        }
                      />
                    </Field>

                    <Field label="Nhờ thu">
                      <MoneyInput
                        className="input-3d"
                        value={formState.collectOnDelivery}
                        onChange={(n) =>
                          setFormState((p) => ({ ...p, collectOnDelivery: n }))
                        }
                      />
                    </Field>

                    <Field label="Hoa hồng">
                      <MoneyInput
                        className="input-3d font-bold text-red-600 dark:text-red-400"
                        value={formState.commission}
                        onChange={(n) => {
                          setFormState((p) => ({ ...p, commission: n }));
                          setQuoteNote('');
                        }}
                      />
                      {quoteNote && (
                        <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {quoteNote}
                        </span>
                      )}
                    </Field>
                  </div>
                </Section>

                <Section
                  step={5}
                  title="Nội dung đơn (dán vào đây để tự điền, hoặc sao chép)"
                >
                  <div className="relative rounded-xl border border-dashed border-blue-300 bg-white p-2.5 shadow-inner dark:border-blue-800 dark:bg-slate-900">
                    <textarea
                      ref={boxRef}
                      className="input-3d min-h-[9rem] resize-none overflow-hidden p-3 pr-28 font-mono text-sm font-semibold leading-relaxed"
                      value={boxText}
                      onChange={(e) => handleBoxChange(e.target.value)}
                      placeholder={
                        'Dán tin nhắn vào đây, ví dụ:\n14h ngày 11/10\n0912345678 Lê Anh\nĐón: ks alacar\nTrả: đường tròn điềm\n2 ghế'
                      }
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={handleCopyPreview}
                      className="btn-3d btn-3d-blue absolute flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      style={{ right: '1.1rem', top: '1.1rem' }}
                    >
                      <Copy size={14} weight="bold" /> Sao chép
                    </button>
                  </div>
                  {/* <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Sửa chữ ở đây thì các ô bên trên đổi theo, và ngược lại. Tuyến, đối tác, loại hình, giá chọn ở các ô riêng.
                  </p> */}
                </Section>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {editingId ? 'Gửi lại tin nhắn:' : 'Gửi tin nhắn:'}
                </span>
                {(
                  [
                    { id: 'SMS', label: 'SMS' },
                    { id: 'ZALO', label: 'Zalo oa' },
                  ] as const
                ).map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer rounded accent-blue-600"
                      checked={autoSend[o.id]}
                      onChange={(e) =>
                        setAutoSend((p) => ({ ...p, [o.id]: e.target.checked }))
                      }
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
                  {editingId
                    ? 'Cập nhật vé'
                    : rebookFromId
                      ? 'Đặt đơn mới'
                      : 'Lưu vé'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Kết quả nhập Excel */}
      {importResult && (
        <Modal title="Kết quả nhập Excel" onClose={() => setImportResult(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                  {importResult.created}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Đã nhập
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
                <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                  {importResult.duplicates}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Trùng, bỏ qua
                </div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/40">
                <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
                  {importResult.failed}
                </div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Lỗi
                </div>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                  Các dòng không nhập được
                </h3>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  {importResult.errors.map((er) => (
                    <li
                      key={er.row}
                      className="text-slate-800 dark:text-slate-200"
                    >
                      <strong>Dòng {er.row}:</strong> {er.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportResult(null)}
                className="btn-3d btn-3d-blue px-5 py-2 text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Chi tiết đơn (bấm vào dòng) */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onEdit={(o) => {
            setDetailOrder(null);
            handleOpenEdit(o);
          }}
        />
      )}

      {historyOrderId !== null && (
        <OrderHistoryModal
          orderId={historyOrderId}
          onClose={() => setHistoryOrderId(null)}
        />
      )}

      {/* Modal Hủy vé */}
      {cancelTarget && (
        <Modal title="Hủy vé" onClose={() => setCancelTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Hủy vé{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatOrderCode(cancelTarget.id)}
              </strong>{' '}
              của khách{' '}
              <strong className="text-slate-900 dark:text-white">
                {cancelTarget.customerName || cancelTarget.phone}
              </strong>
            </p>
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Lý do hủy <span className="text-red-500">*</span>
              </span>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setCancelReason(r);
                      setCancelError('');
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                      cancelReason === r
                        ? 'border-rose-400 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                className={`input-3d min-h-[5rem] resize-y p-3 ${cancelError ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : ''}`}
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setCancelError('');
                }}
                maxLength={500}
                placeholder="Chọn nhanh ở trên hoặc nhập lý do hủy..."
                aria-invalid={!!cancelError}
                autoFocus
              />
              {cancelError && (
                <span
                  role="alert"
                  className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400"
                >
                  {cancelError}
                </span>
              )}
            </div>
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
              Bạn có chắc chắn muốn xóa đơn vé{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatOrderCode(deleteTarget.id)}
              </strong>{' '}
              của khách hàng{' '}
              <strong className="text-slate-900 dark:text-white">
                {deleteTarget.customerName || deleteTarget.phone}
              </strong>{' '}
              không?
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
