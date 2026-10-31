'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Copy } from '@phosphor-icons/react';
import { Modal } from '@/features/xvip/Modal';
import { AutoGrowInput } from '@/features/xvip/AutoGrowInput';
import { RouteCombobox } from '@/features/xvip/RouteCombobox';
import { SuggestInput } from '@/features/xvip/SuggestInput';
import { DateInput, TimeInput } from '@/features/xvip/PickerInput';
import { handleArrowNav } from '@/features/xvip/arrow-nav';
import { formatDateVN, formatOrderCode } from '@/lib/format';
import { getVnTime, getVnToday } from '@/lib/time';
import { parseOrderText } from '../parse-order-text';
import { partnersApi } from '@/features/partners/api';
import type { Route } from '@/features/routes/types';
import type { User } from '@/features/users/types';
import {
  cabinCommission,
  cabinFromLines,
  cabinTotals,
  perVehicle,
  privateCommission,
  privateTotals,
  type CabinState,
} from '../cabin-pricing';
import {
  CABIN_KINDS,
  CABIN_LABELS,
  type CabinKind,
  type CabinLine,
  type CreateOrderInput,
  type MessageChannel,
  type Order,
} from '../types';

/** Loại hình "Xe Cabin": hiện bảng cabin đơn / cabin đôi thay cho ô số ghế */
export const CABIN_VEHICLE_TYPE = 'Xe Cabin';

/** Loại hình "Xe Riêng": chỉ nhập số xe và giá, không có ghế và không tính vào số vé */
export const PRIVATE_VEHICLE_TYPE = 'Xe Riêng';

/**
 * Loại hình "Gửi Hàng": hiện ô hàng hóa (loại hàng, số lượng, cân nặng, người nhận) thay cho ô số ghế.
 * Không tính vào số vé; cước phí là giá bán, hoa hồng theo mức "giao hàng" của đối tác.
 */
export const GOODS_VEHICLE_TYPE = 'Gửi Hàng';

/** Loại hình cho sẵn để chọn */
export const VEHICLE_TYPES = [
  'Xe Limousine',
  PRIVATE_VEHICLE_TYPE,
  CABIN_VEHICLE_TYPE,
  'Giường Nằm',
  GOODS_VEHICLE_TYPE,
  'Khách Sạn',
  'Vé Fan',
];

export interface OrderFormState {
  customerName: string;
  phone: string;
  routeId: number;
  partner: string;
  vehicleType: string;
  cabin: CabinState;
  /** Gửi hàng: chi tiết hàng hóa (cước phí nhập ở ô giá bán) */
  goodsType: string;
  goodsQuantity: number;
  goodsWeightKg: number;
  receiverName: string;
  receiverPhone: string;
  vehicleCount: number;
  /** Xe riêng: giá nhập, giá bán của 1 xe (tổng đơn = đơn giá x số xe) */
  unitCost: number;
  unitSell: number;
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

export interface FormErrors {
  customerName?: string;
  phone?: string;
  routeId?: string;
  departureTime?: string;
  departureDate?: string;
  partner?: string;
  vehicleType?: string;
  /** Lỗi ô số ghế / số lượng cabin / số xe / số lượng hàng (cùng một chỗ báo lỗi) */
  seats?: string;
}

function NumInput({
  value,
  onChange,
  min = 0,
  max,
  step,
  className,
  required,
  blankZero,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  blankZero?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  required?: boolean;
}) {
  const shown = (n: number) => (blankZero && !n ? '' : String(n));
  const [text, setText] = useState(shown(value));

  useEffect(() => {
    setText((t) => (Number(t || 0) === value ? t : shown(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, blankZero]);

  return (
    <input
      className={disabled ? `${className ?? ''} cursor-not-allowed opacity-50` : className}
      disabled={disabled}
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
  label: ReactNode;
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

type SeatKey = 'seatCount' | 'seatFront' | 'seatMiddle' | 'seatBack';

const EMPTY_ZONE_PRICES: Record<SeatKey, number> = {
  seatCount: 0,
  seatFront: 0,
  seatMiddle: 0,
  seatBack: 0,
};

/** Tổng tiền vé đầy đủ: mỗi nhóm đầu/giữa/cuối nhân giá riêng, ghế còn lại nhân giá ở ô "Số ghế" */
function calcFullFare(f: OrderFormState, prices: Record<SeatKey, number>): number {
  // Xe cabin: giá bán các dòng cabin chính là tổng tiền vé
  if (f.vehicleType === CABIN_VEHICLE_TYPE) return cabinTotals(f.cabin).sellPrice;
  // Xe riêng: giá bán nhập tay chính là giá vé
  if (f.vehicleType === PRIVATE_VEHICLE_TYPE) return Number(f.sellPrice) || 0;
  // Gửi hàng: cước phí (giá bán nhập tay) là cơ sở tính hoa hồng % của đối tác
  if (f.vehicleType === GOODS_VEHICLE_TYPE) return Number(f.sellPrice) || 0;
  const front = Number(f.seatFront) || 0;
  const middle = Number(f.seatMiddle) || 0;
  const back = Number(f.seatBack) || 0;
  const rest = Math.max(0, (Number(f.seatCount) || 0) - front - middle - back);
  return (
    front * prices.seatFront +
    middle * prices.seatMiddle +
    back * prices.seatBack +
    rest * prices.seatCount
  );
}

/** Gửi hàng: chi tiết hàng hóa lấy từ đơn đã lưu; loại hình khác để trống */
function goodsFields(o: Order) {
  const g = o.vehicleType === GOODS_VEHICLE_TYPE ? o.goods : null;
  return {
    goodsType: g?.goodsType ?? '',
    goodsQuantity: g?.quantity ?? 0,
    goodsWeightKg: g?.weightKg ?? 0,
    receiverName: g?.receiverName ?? '',
    receiverPhone: g?.receiverPhone ?? '',
  };
}

/** Xe riêng: số xe và đơn giá 1 xe lấy từ đơn đã lưu (đơn cũ chưa có số xe thì lấy tạm số ghế) */
function privateFields(o: Order) {
  if (o.vehicleType !== PRIVATE_VEHICLE_TYPE) return { vehicleCount: 0, unitCost: 0, unitSell: 0 };
  const vehicleCount = o.vehicleCount || o.seatCount;
  return {
    vehicleCount,
    unitCost: perVehicle(o.costPrice, vehicleCount),
    unitSell: perVehicle(o.sellPrice, vehicleCount),
  };
}

/**
 * Đơn cũ (trước khi số ghế độc lập với đầu/giữa/cuối) lưu "Số ghế" = tổng ba vị trí.
 * Khi mở lại để sửa, nếu bằng đúng tổng thì để trống ô "Số ghế" để mỗi ô hiện đúng giá trị đã nhập.
 */
function seatCountForEdit(o: Pick<Order, 'seatFront' | 'seatMiddle' | 'seatBack' | 'seatCount'>): number {
  const zones = o.seatFront + o.seatMiddle + o.seatBack;
  return zones > 0 && o.seatCount === zones ? 0 : o.seatCount;
}

function buildPreviewLines(f: OrderFormState): string[] {
  const join = (parts: (string | false | undefined)[], sep = ' - ') =>
    parts.filter(Boolean).join(sep);
  const seats = Number(f.seatCount) || 0;
  const zones =
    f.vehicleType === CABIN_VEHICLE_TYPE
      ? CABIN_KINDS.map(
          (k) => Number(f.cabin[k].quantity) > 0 && `${Number(f.cabin[k].quantity)} ${CABIN_LABELS[k]}`,
        ).filter(Boolean)
      : [
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
    // Gửi hàng: ghi loại hàng, số lượng và người nhận thay cho số ghế
    f.vehicleType === GOODS_VEHICLE_TYPE &&
      Number(f.goodsQuantity) > 0 &&
      join([f.goodsType.trim() || 'Hàng hóa', `x${Number(f.goodsQuantity)}`], ' '),
    f.vehicleType === GOODS_VEHICLE_TYPE &&
      join([f.receiverName.trim(), f.receiverPhone.trim()]) &&
      `Người nhận: ${join([f.receiverName.trim(), f.receiverPhone.trim()])}`,
    // Xe cabin đã có dòng "x Cabin Đơn + y Cabin Đôi" nên không ghi thêm tổng số ghế
    f.vehicleType === PRIVATE_VEHICLE_TYPE
      ? Number(f.vehicleCount) > 0 && `${Number(f.vehicleCount)} xe`
      : f.vehicleType !== CABIN_VEHICLE_TYPE && f.vehicleType !== GOODS_VEHICLE_TYPE && seats > 0 && `${seats} ghế`,
    zones.length > 0 && f.vehicleType !== GOODS_VEHICLE_TYPE && zones.join(' + '),
  ].filter((line): line is string => !!line);
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOrder?: Order | null;
  rebookOrder?: Order | null;
  activeRoutes: Route[];
  activeStaff: User[];
  partnerSuggestions: string[];
  isAdmin: boolean;
  onSave: (payload: {
    data: CreateOrderInput;
    editingId?: number;
    autoSend: Record<MessageChannel, boolean>;
  }) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function OrderFormModal({
  isOpen,
  onClose,
  editingOrder,
  rebookOrder,
  activeRoutes,
  activeStaff,
  partnerSuggestions,
  isAdmin,
  onSave,
  showToast,
}: OrderFormModalProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultFormState: OrderFormState = useMemo(
    () => ({
      customerName: '',
      phone: '',
      routeId: 0,
      partner: '',
      vehicleType: '',
      cabin: cabinFromLines(null),
      goodsType: '',
      goodsQuantity: 0,
      goodsWeightKg: 0,
      receiverName: '',
      receiverPhone: '',
      vehicleCount: 0,
      unitCost: 0,
      unitSell: 0,
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
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [editingRouteFallback, setEditingRouteFallback] = useState<string | undefined>();
  const [autoSend, setAutoSend] = useState<Record<MessageChannel, boolean>>({
    SMS: false,
    ZALO: true,
  });

  const [boxText, setBoxText] = useState('');
  const ownText = useRef<string | null>(null);
  const [boxVersion, setBoxVersion] = useState(0);
  const lastQuoteKey = useRef<string | null>(null);
  const [quoteNote, setQuoteNote] = useState('');
  const boxRef = useRef<HTMLTextAreaElement>(null);
  // Giá vé đầy đủ theo từng nhóm ghế (chỉ dùng để tự tính hoa hồng theo % của đối tác)
  const [zonePrices, setZonePrices] = useState<Record<SeatKey, number>>(EMPTY_ZONE_PRICES);

  const editingId = editingOrder?.id;
  const rebookFromId = rebookOrder?.id;

  // Khởi tạo state khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    lastQuoteKey.current = null;
    setQuoteNote('');
    ownText.current = null;
    setBoxVersion((v) => v + 1);
    setFormErrors({});
    setZonePrices(EMPTY_ZONE_PRICES);

    if (editingOrder) {
      setEditingRouteFallback(editingOrder.route?.name);
      setFormState({
        customerName: editingOrder.customerName ?? '',
        phone: editingOrder.phone,
        routeId: editingOrder.route?.id ?? 0,
        partner: editingOrder.partner ?? '',
        vehicleType: editingOrder.vehicleType ?? '',
        cabin: cabinFromLines(editingOrder.cabinLines),
        ...goodsFields(editingOrder),
        ...privateFields(editingOrder),
        seatFront: editingOrder.seatFront,
        seatMiddle: editingOrder.seatMiddle,
        seatBack: editingOrder.seatBack,
        seatCount: seatCountForEdit(editingOrder),
        departureTime: editingOrder.departureTime,
        departureDate: editingOrder.departureDate,
        sellPrice: editingOrder.sellPrice,
        costPrice: editingOrder.costPrice,
        deposit: editingOrder.deposit,
        collectOnDelivery: editingOrder.collectOnDelivery,
        commission: editingOrder.commission,
        pickupPoint: editingOrder.pickupPoint ?? '',
        dropoffPoint: editingOrder.dropoffPoint ?? '',
        note: editingOrder.note ?? '',
        staffId: editingOrder.staff?.id,
      });
      setAutoSend({ SMS: false, ZALO: false });
    } else if (rebookOrder) {
      setEditingRouteFallback(rebookOrder.route?.name);
      setFormState({
        customerName: rebookOrder.customerName ?? '',
        phone: rebookOrder.phone,
        routeId: rebookOrder.route?.id ?? 0,
        partner: rebookOrder.partner ?? '',
        vehicleType: rebookOrder.vehicleType ?? '',
        cabin: cabinFromLines(rebookOrder.cabinLines),
        ...goodsFields(rebookOrder),
        ...privateFields(rebookOrder),
        seatFront: rebookOrder.seatFront,
        seatMiddle: rebookOrder.seatMiddle,
        seatBack: rebookOrder.seatBack,
        seatCount: seatCountForEdit(rebookOrder),
        departureTime: rebookOrder.departureTime,
        departureDate: todayStr,
        sellPrice: rebookOrder.sellPrice,
        costPrice: rebookOrder.costPrice,
        deposit: rebookOrder.deposit,
        collectOnDelivery: rebookOrder.collectOnDelivery,
        commission: rebookOrder.commission,
        pickupPoint: rebookOrder.pickupPoint ?? '',
        dropoffPoint: rebookOrder.dropoffPoint ?? '',
        note: rebookOrder.note ?? '',
        staffId: isAdmin ? rebookOrder.staff?.id : undefined,
      });
      setAutoSend({ SMS: false, ZALO: true });
    } else {
      setEditingRouteFallback(undefined);
      setFormState(defaultFormState);
      setAutoSend({ SMS: false, ZALO: true });
    }
  }, [isOpen, editingOrder, rebookOrder, defaultFormState, todayStr, isAdmin]);

  const generatedText = buildPreviewLines(formState).join('\n');

  useEffect(() => {
    if (ownText.current !== null && ownText.current === generatedText) return;
    ownText.current = null;
    setBoxText(generatedText);
  }, [generatedText, boxVersion]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [boxText, isOpen]);

  const isPrivate = formState.vehicleType === PRIVATE_VEHICLE_TYPE;
  const isGoods = formState.vehicleType === GOODS_VEHICLE_TYPE;

  // Xe riêng và gửi hàng không tính vé: chỉ cần 1 để hỏi server hoa hồng theo % giá bán / mức mỗi đơn
  const quoteTickets = isPrivate
    ? Number(formState.vehicleCount) > 0
      ? 1
      : 0
    : isGoods
      ? Number(formState.goodsQuantity) > 0
        ? 1
        : 0
      : Number(formState.seatCount) > 0
      ? Number(formState.seatCount)
      : (Number(formState.seatFront) || 0) +
        (Number(formState.seatMiddle) || 0) +
        (Number(formState.seatBack) || 0);

  const fullFare = calcFullFare(formState, zonePrices);

  // Xe cabin và xe riêng tính hoa hồng theo (giá bán - giá nhập) x số lượng, ưu tiên hơn % hay mức cố định của đối tác
  const usesMarginFormula = formState.vehicleType === CABIN_VEHICLE_TYPE || isPrivate;

  useEffect(() => {
    if (!isOpen || usesMarginFormula) return;
    const key = `${formState.partner.trim().toLowerCase()}|${quoteTickets}|${fullFare}|${isGoods ? 'goods' : 'ticket'}`;
    if (editingId && lastQuoteKey.current === null) {
      lastQuoteKey.current = key;
      return;
    }
    if (key === lastQuoteKey.current) return;
    lastQuoteKey.current = key;

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
        .commissionQuote(formState.partner, quoteTickets, fullFare, ctrl.signal, isGoods ? 'delivery' : 'ticket')
        .then((commission) => {
          if (commission !== null) {
            setFormState((p) => ({ ...p, commission }));
            setQuoteNote(
              isGoods
                ? 'Tự tính theo hoa hồng giao hàng của đối tác'
                : fullFare > 0
                  ? `Tự tính theo giá vé ${fullFare.toLocaleString('vi-VN')}đ x % hoa hồng đối tác`
                  : `Tự tính theo nhà xe x ${quoteTickets} vé`,
            );
          } else {
            setQuoteNote(
              isGoods
                ? 'Đối tác này chưa có hoa hồng giao hàng, bạn nhập tay'
                : 'Đối tác này chưa có mức hoa hồng, bạn nhập tay',
            );
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
  }, [isOpen, editingId, usesMarginFormula, formState.partner, quoteTickets, fullFare, isGoods]);

  const isCabin = formState.vehicleType === CABIN_VEHICLE_TYPE;

  /** Đổi dòng cabin: số ghế và giá nhập, giá bán của đơn luôn bằng tổng các dòng */
  const updateCabin = (kind: CabinKind, patch: Partial<CabinState[CabinKind]>) => {
    setFormState((p) => {
      const cabin = { ...p.cabin, [kind]: { ...p.cabin[kind], ...patch } };
      return {
        ...p,
        cabin,
        ...cabinTotals(cabin),
        commission: cabinCommission(cabin),
        seatFront: 0,
        seatMiddle: 0,
        seatBack: 0,
      };
    });
    setQuoteNote('Tự tính: (giá bán - giá nhập) x số lượng');
    setFormErrors((er) => ({ ...er, seats: undefined }));
  };

  /** Đổi số xe hoặc đơn giá xe riêng: tổng đơn và hoa hồng tính lại ngay */
  const updatePrivate = (patch: Partial<Pick<OrderFormState, 'vehicleCount' | 'unitCost' | 'unitSell'>>) => {
    setFormState((p) => {
      const next = { ...p, ...patch };
      return {
        ...next,
        ...privateTotals(next.vehicleCount, next.unitCost, next.unitSell),
        commission: privateCommission(next.vehicleCount, next.unitCost, next.unitSell),
        seatCount: 0,
        seatFront: 0,
        seatMiddle: 0,
        seatBack: 0,
      };
    });
    setQuoteNote('Tự tính: (giá bán - giá nhập) x số xe');
    setFormErrors((er) => ({ ...er, seats: undefined }));
  };

  const handleBoxChange = (text: string) => {
    const year = Number(getVnToday().slice(0, 4));
    const prev = parseOrderText(boxText, year);
    const next = parseOrderText(text, year);
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

  const handleCopyPreview = async () => {
    const text = boxText.trim();
    if (!text) {
      showToast('Chưa có nội dung để sao chép.', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Đã sao chép nội dung đơn vào bộ nhớ tạm.');
    } catch {
      showToast('Không sao chép được. Hãy bôi đen chữ trong ô và Ctrl+C.', 'error');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: FormErrors = {};

    if (!formState.customerName.trim()) {
      errors.customerName = 'Vui lòng nhập tên khách hàng.';
    }
    if (!formState.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại.';
    }
    if (!formState.routeId) {
      errors.routeId = 'Vui lòng chọn tuyến đường.';
    }
    // Vé hôm nay không được có giờ đi đã qua; sửa vé cũ giữ nguyên ngày giờ thì không bị chặn
    const keepsOriginalTime =
      !!editingOrder &&
      editingOrder.departureDate === formState.departureDate &&
      editingOrder.departureTime === formState.departureTime;
    if (
      !isAdmin &&
      formState.departureTime.trim() &&
      formState.departureDate === getVnToday() &&
      formState.departureTime < getVnTime() &&
      !keepsOriginalTime
    ) {
      errors.departureTime = `Giờ đi đã qua, chọn từ ${getVnTime()} trở đi.`;
    } else if (!formState.departureTime.trim()) {
      errors.departureTime = 'Vui lòng nhập giờ khởi hành.';
    }
    if (!formState.departureDate.trim()) {
      errors.departureDate = 'Vui lòng chọn ngày khởi hành.';
    } else if (
      formState.departureDate < getVnToday() &&
      // Sửa vé cũ giữ nguyên ngày thì không bị chặn, chỉ chặn khi chọn ngày đã qua
      editingOrder?.departureDate !== formState.departureDate
    ) {
      errors.departureDate = 'Không thể chọn ngày khởi hành đã qua.';
    }
    if (!formState.partner.trim()) {
      errors.partner = 'Vui lòng chọn đối tác.';
    } else if (!partnerSuggestions.includes(formState.partner)) {
      errors.partner = 'Đối tác phải chọn từ danh sách có sẵn.';
    }
    if (!formState.vehicleType.trim()) {
      errors.vehicleType = 'Vui lòng chọn loại hình.';
    }

    const totalSeats =
      (Number(formState.seatFront) || 0) +
      (Number(formState.seatMiddle) || 0) +
      (Number(formState.seatBack) || 0);
    const cabinSum = cabinTotals(formState.cabin);
    const privateSum = privateTotals(formState.vehicleCount, formState.unitCost, formState.unitSell);
    const count = isCabin
      ? cabinSum.seatCount
      : isPrivate || isGoods
        ? 0
        : Number(formState.seatCount) || 0;
    if (isPrivate) {
      if ((Number(formState.vehicleCount) || 0) < 1) {
        errors.seats = 'Nhập số xe (ít nhất 1).';
      }
    } else if (isGoods) {
      if ((Number(formState.goodsQuantity) || 0) < 1) {
        errors.seats = 'Nhập số lượng hàng (ít nhất 1).';
      }
    } else if (isCabin) {
      if (cabinSum.seatCount < 1) {
        errors.seats = 'Nhập số lượng cabin đơn hoặc cabin đôi (ít nhất 1).';
      }
    } else if (count < 1 && totalSeats < 1) {
      errors.seats = 'Nhập số ghế hoặc ghế đầu / giữa / cuối (ít nhất 1).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'error');
      return;
    }

    const payload: CreateOrderInput = {
      customerName: formState.customerName.trim(),
      phone: formState.phone.trim(),
      routeId: formState.routeId,
      partner: formState.partner.trim(),
      vehicleType: formState.vehicleType.trim(),
      ...(isCabin
        ? {
            cabinLines: CABIN_KINDS.filter((k) => Number(formState.cabin[k].quantity) > 0).map(
              (kind): CabinLine => ({
                kind,
                quantity: Number(formState.cabin[kind].quantity) || 0,
                costPrice: Number(formState.cabin[kind].costPrice) || 0,
                sellPrice: Number(formState.cabin[kind].sellPrice) || 0,
              }),
            ),
          }
        : {}),
      ...(isGoods
        ? {
            goods: {
              goodsType: formState.goodsType.trim(),
              quantity: Number(formState.goodsQuantity) || 0,
              weightKg: Number(formState.goodsWeightKg) || 0,
              receiverName: formState.receiverName.trim(),
              receiverPhone: formState.receiverPhone.trim(),
            },
          }
        : {}),
      ...(isPrivate ? { vehicleCount: Number(formState.vehicleCount) || 0 } : {}),
      seatFront: isCabin || isPrivate || isGoods ? 0 : Number(formState.seatFront) || 0,
      seatMiddle: isCabin || isPrivate || isGoods ? 0 : Number(formState.seatMiddle) || 0,
      seatBack: isCabin || isPrivate || isGoods ? 0 : Number(formState.seatBack) || 0,
      seatCount: count,
      departureTime: formState.departureTime.trim(),
      departureDate: formState.departureDate.trim(),
      sellPrice: isCabin
        ? cabinSum.sellPrice
        : isPrivate
          ? privateSum.sellPrice
          : Number(formState.sellPrice) || 0,
      costPrice: isCabin
        ? cabinSum.costPrice
        : isPrivate
          ? privateSum.costPrice
          : isGoods
            ? 0
            : Number(formState.costPrice) || 0,
      deposit: Number(formState.deposit) || 0,
      collectOnDelivery: Number(formState.collectOnDelivery) || 0,
      commission: Number(formState.commission) || 0,
      pickupPoint: formState.pickupPoint.trim(),
      dropoffPoint: formState.dropoffPoint.trim(),
      note: formState.note.trim(),
      // Backend không cho đổi nhân viên khi sửa đơn (UpdateOrderDto bỏ staffId)
      staffId: editingId ? undefined : formState.staffId,
    };

    await onSave({
      data: payload,
      editingId: editingId ?? undefined,
      autoSend,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={
        editingId
          ? `Cập nhật đơn vé ${formatOrderCode(editingId)}`
          : rebookFromId
            ? `Đặt lại đơn ${formatOrderCode(rebookFromId)} (tạo đơn mới)`
            : 'Thêm vé / Đơn đặt xe mới'
      }
      onClose={onClose}
      size="xl"
    >
      <div className="xv-form-swap">
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => handleArrowNav(e, e.currentTarget)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Cột trái: khách hàng + chuyến đi + ghi chú */}
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
                      setFormState((p) => ({ ...p, customerName: v }));
                      setFormErrors((er) => ({ ...er, customerName: undefined }));
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
                      setFormState((p) => ({ ...p, phone: val }));
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
                          setFormState((p) => ({
                            ...p,
                            staffId: e.target.value ? Number(e.target.value) : undefined,
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
                      fallbackName={editingRouteFallback}
                      invalid={!!formErrors.routeId}
                      onChange={(rId) => {
                        setEditingRouteFallback(undefined);
                        setFormErrors((er) => ({ ...er, routeId: undefined }));
                        const selRoute = activeRoutes.find((r) => r.id === rId);
                        setFormState((p) => ({
                          ...p,
                          routeId: rId,
                          sellPrice: selRoute?.defaultPrice ? selRoute.defaultPrice : p.sellPrice,
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
                    // Chọn ngày hôm nay thì khóa các giờ, phút đã qua
                    min={!isAdmin && formState.departureDate === getVnToday() ? getVnTime() : undefined}
                    value={formState.departureTime}
                    invalid={!!formErrors.departureTime}
                    onChange={(v) => {
                      setFormState((p) => ({ ...p, departureTime: v }));
                      setFormErrors((er) => ({ ...er, departureTime: undefined }));
                    }}
                  />
                </Field>

                <Field
                  label="Ngày khởi hành"
                  required
                  error={formErrors.departureDate}
                >
                  <DateInput
                    // Không cho chọn ngày đã qua, kể cả Admin
                    min={getVnToday()}
                    value={formState.departureDate}
                    invalid={!!formErrors.departureDate}
                    onChange={(v) => {
                      setFormState((p) => ({ ...p, departureDate: v }));
                      setFormErrors((er) => ({ ...er, departureDate: undefined }));
                    }}
                  />
                </Field>

                <Field label="Đối tác" required error={formErrors.partner}>
                  <SuggestInput
                    options={partnerSuggestions}
                    value={formState.partner}
                    invalid={!!formErrors.partner}
                    onChange={(v) => {
                      setFormState((p) => ({ ...p, partner: v }));
                      setFormErrors((er) => ({ ...er, partner: undefined }));
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
                      const vehicleType = e.target.value;
                      setFormState((p) => ({
                        ...p,
                        vehicleType,
                        // Chọn Xe Cabin thì số ghế và giá lấy theo tổng các dòng cabin
                        ...(vehicleType === CABIN_VEHICLE_TYPE
                          ? {
                              ...cabinTotals(p.cabin),
                              commission: cabinCommission(p.cabin),
                              seatFront: 0,
                              seatMiddle: 0,
                              seatBack: 0,
                            }
                          : {}),
                        // Gửi hàng không có ghế: hoa hồng do đối tác quyết định (tự tính lại sau khi đổi loại hình)
                        ...(vehicleType === GOODS_VEHICLE_TYPE
                          ? { seatCount: 0, seatFront: 0, seatMiddle: 0, seatBack: 0, costPrice: 0 }
                          : {}),
                        // Xe riêng không có ghế, chỉ nhập số xe
                        ...(vehicleType === PRIVATE_VEHICLE_TYPE
                          ? {
                              ...privateTotals(p.vehicleCount, p.unitCost, p.unitSell),
                              commission: privateCommission(p.vehicleCount, p.unitCost, p.unitSell),
                              seatCount: 0,
                              seatFront: 0,
                              seatMiddle: 0,
                              seatBack: 0,
                            }
                          : {}),
                      }));
                      setFormErrors((er) => ({ ...er, vehicleType: undefined, seats: undefined }));
                      // Đơn gửi hàng không phải vé xe: không tự gửi tin đặt vé cho khách
                      if (vehicleType === GOODS_VEHICLE_TYPE) setAutoSend({ SMS: false, ZALO: false });
                    }}
                  >
                    <option value="" hidden disabled />
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
                  <AutoGrowInput
                    value={formState.pickupPoint}
                    onChange={(v) => setFormState((p) => ({ ...p, pickupPoint: v }))}
                    maxLength={255}
                  />
                </Field>

                <Field label="Điểm trả">
                  <AutoGrowInput
                    value={formState.dropoffPoint}
                    onChange={(v) => setFormState((p) => ({ ...p, dropoffPoint: v }))}
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

          {/* Cột phải: số ghế + giá tiền + nội dung đơn */}
          <div className="space-y-4">
            <Section
              step={3}
              title={isGoods ? 'Hàng hóa' : isCabin ? 'Số lượng cabin' : isPrivate ? 'Số xe' : 'Số ghế'}
            >
              {isGoods ? (
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Field label="Số lượng" required>
                    <NumInput
                      className={`input-3d text-center font-bold ${formErrors.seats ? '!border-red-500' : ''}`}
                      value={formState.goodsQuantity}
                      onChange={(n) => {
                        setFormState((p) => ({ ...p, goodsQuantity: n }));
                        setFormErrors((er) => ({ ...er, seats: undefined }));
                      }}
                      min={0}
                      max={10000}
                      blankZero
                    />
                  </Field>
                  <Field label="Cân nặng (kg)">
                    <input
                      className="input-3d text-center font-bold"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      value={formState.goodsWeightKg || ''}
                      onChange={(e) =>
                        setFormState((p) => ({ ...p, goodsWeightKg: Math.max(0, Number(e.target.value) || 0) }))
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Loại hàng hóa">
                      <AutoGrowInput
                        value={formState.goodsType}
                        onChange={(v) => setFormState((p) => ({ ...p, goodsType: v }))}
                        maxLength={255}
                      />
                    </Field>
                  </div>
                  <Field label="Tên người nhận">
                    <AutoGrowInput
                      value={formState.receiverName}
                      onChange={(v) => setFormState((p) => ({ ...p, receiverName: v }))}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="SĐT người nhận">
                    <input
                      className="input-3d font-mono font-bold"
                      inputMode="tel"
                      value={formState.receiverPhone}
                      maxLength={30}
                      onChange={(e) => setFormState((p) => ({ ...p, receiverPhone: e.target.value }))}
                    />
                  </Field>
                </div>
              ) : isPrivate ? (
                <Field label="Số lượng xe">
                  <NumInput
                    className={`input-3d text-center font-bold ${formErrors.seats ? '!border-red-500' : ''}`}
                    value={formState.vehicleCount}
                    onChange={(n) => updatePrivate({ vehicleCount: n })}
                    min={0}
                    max={60}
                    blankZero
                  />
                </Field>
              ) : isCabin ? (
                <div className="space-y-2">
                  <div className="hidden grid-cols-[5rem_4.5rem_1fr_1fr] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:grid">
                    <span>Loại</span>
                    <span className="text-center">Số lượng</span>
                    <span>Giá nhập (1 cabin)</span>
                    <span>Giá bán (1 cabin)</span>
                  </div>
                  {CABIN_KINDS.map((kind) => (
                    <div
                      key={kind}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/60 sm:grid-cols-[5rem_4.5rem_1fr_1fr] sm:items-center"
                    >
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {CABIN_LABELS[kind]}
                      </span>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">Số lượng</span>
                        <NumInput
                          className={`input-3d text-center font-bold ${formErrors.seats ? '!border-red-500' : ''}`}
                          value={formState.cabin[kind].quantity}
                          onChange={(n) => updateCabin(kind, { quantity: n })}
                          min={0}
                          max={60}
                          blankZero
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">Giá nhập (1 cabin)</span>
                        <MoneyInput
                          className="input-3d min-w-0 text-right font-bold"
                          value={formState.cabin[kind].costPrice}
                          onChange={(n) => updateCabin(kind, { costPrice: n })}
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">Giá bán (1 cabin)</span>
                        <MoneyInput
                          className="input-3d min-w-0 text-right font-bold text-blue-900 dark:text-blue-400"
                          value={formState.cabin[kind].sellPrice}
                          onChange={(n) => updateCabin(kind, { sellPrice: n })}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
              <>
              <div className="space-y-2">
                <div className="hidden grid-cols-[4.5rem_5rem_1fr] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:grid">
                  <span>Nhóm</span>
                  <span className="text-center">Số lượng</span>
                  <span>Giá vé (VNĐ / ghế)</span>
                </div>
                {(
                  [
                    { key: 'seatCount', label: 'Số ghế' },
                    { key: 'seatFront', label: 'Đầu' },
                    { key: 'seatMiddle', label: 'Giữa' },
                    { key: 'seatBack', label: 'Cuối' },
                  ] as const
                ).map((z) => (
                  <div
                    key={z.key}
                    className={`grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[4.5rem_5rem_1fr] sm:items-center ${
                      z.key === 'seatCount'
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {z.label}
                    </span>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">Số lượng</span>
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
                        disabled={
                          z.key === 'seatCount'
                            ? (Number(formState.seatFront) || 0) +
                                (Number(formState.seatMiddle) || 0) +
                                (Number(formState.seatBack) || 0) >
                              0
                            : (Number(formState.seatCount) || 0) > 0
                        }
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:hidden">Giá vé (VNĐ / ghế)</span>
                      <MoneyInput
                        className="input-3d min-w-0 text-right font-bold"
                        value={zonePrices[z.key]}
                        onChange={(n) => setZonePrices((p) => ({ ...p, [z.key]: n }))}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Ô &quot;Giá vé&quot; là giá đầy đủ 1 vé, dùng để tự tính hoa hồng theo % đã đặt ở mục Đối tác.
              </p>
              </>
              )}
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
                {isPrivate && (
                  <>
                    <Field label="Giá nhập (1 xe)">
                      <MoneyInput
                        className="input-3d"
                        value={formState.unitCost}
                        onChange={(n) => updatePrivate({ unitCost: n })}
                      />
                    </Field>

                    <Field label="Giá bán (1 xe)" required>
                      <MoneyInput
                        className="input-3d font-bold text-blue-900 dark:text-blue-400"
                        value={formState.unitSell}
                        onChange={(n) => updatePrivate({ unitSell: n })}
                      />
                    </Field>
                  </>
                )}
                {isGoods && (
                  <Field label="Cước phí" required>
                    <MoneyInput
                      className="input-3d font-bold text-blue-900 dark:text-blue-400"
                      value={formState.sellPrice}
                      onChange={(n) => setFormState((p) => ({ ...p, sellPrice: n }))}
                    />
                  </Field>
                )}
                {!isCabin && !isPrivate && !isGoods && (
                  <>
                    <Field label="Giá nhập">
                      <MoneyInput
                        className="input-3d"
                        value={formState.costPrice}
                        onChange={(n) => setFormState((p) => ({ ...p, costPrice: n }))}
                      />
                    </Field>

                    <Field label="Giá bán" required>
                      <MoneyInput
                        className="input-3d font-bold text-blue-900 dark:text-blue-400"
                        value={formState.sellPrice}
                        onChange={(n) => setFormState((p) => ({ ...p, sellPrice: n }))}
                        required
                      />
                    </Field>
                  </>
                )}

                <Field label={<>Đã cọc <span className="text-red-600 dark:text-red-400">XVIP</span></>}>
                  <MoneyInput
                    className="input-3d"
                    value={formState.deposit}
                    onChange={(n) => setFormState((p) => ({ ...p, deposit: n }))}
                  />
                </Field>

                <Field label="Nhờ thu">
                  <MoneyInput
                    className="input-3d"
                    value={formState.collectOnDelivery}
                    onChange={(n) => setFormState((p) => ({ ...p, collectOnDelivery: n }))}
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
              onClick={onClose}
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
      </div>
    </Modal>
  );
}
