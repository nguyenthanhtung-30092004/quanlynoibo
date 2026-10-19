import { CABIN_LABELS, CabinKind, CabinLine, Order, SeatZone } from '../entities/order.entity.js';
import { buildBookingSms } from '../sms/sms-template.js';

/** Viết hoa chữ cái đầu mỗi từ của tên khách (nguyễn văn a -> Nguyễn Văn A) */
export function titleCaseName(name?: string | null): string {
  return (name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi')
    .replace(/(^|\s)(\S)/gu, (_m, sp: string, c: string) => sp + c.toLocaleUpperCase('vi'));
}

/** Chặn công thức Excel (CSV/formula injection) trong ô do người dùng nhập */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** 'YYYY-MM-DD' -> ô ngày của Excel (nửa đêm UTC để không bị lệch ngày theo múi giờ) */
export function toExcelDate(ymd: string): Date | string {
  const [y, m, d] = ymd.split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : ymd;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Tách ghế đầu/giữa/cuối. Đơn cũ chưa tách (cả ba bằng 0) thì quy toàn bộ số ghế
 * về vị trí đã chọn trước đây để hiển thị không bị mất.
 */
export function seatsOf(order: {
  seatFront: number;
  seatMiddle: number;
  seatBack: number;
  seatCount: number;
  seatZone: SeatZone | null;
}) {
  const { seatFront, seatMiddle, seatBack, seatCount, seatZone } = order;
  if (seatFront + seatMiddle + seatBack > 0) {
    return { seatFront, seatMiddle, seatBack };
  }
  return {
    seatFront: seatZone === SeatZone.FRONT ? seatCount : 0,
    seatMiddle: seatZone === SeatZone.MIDDLE ? seatCount : 0,
    seatBack: seatZone === SeatZone.BACK ? seatCount : 0,
  };
}

/** Số vé của đơn: ưu tiên số ghế; nhà xe chỉ ghi đầu/giữa/cuối thì lấy tổng ba vị trí */
export function ticketsOf(order: {
  seatFront: number;
  seatMiddle: number;
  seatBack: number;
  seatCount: number;
  seatZone: SeatZone | null;
}): number {
  if (order.seatCount > 0) return order.seatCount;
  const { seatFront, seatMiddle, seatBack } = seatsOf(order);
  return seatFront + seatMiddle + seatBack;
}

/** Biểu thức SQL số ghế đầu/giữa/cuối khớp `seatsOf`; cột khác trả undefined */
export function seatColumnExpr(field: string): string | undefined {
  const zones: Record<string, [string, SeatZone]> = {
    seatFront: ['order.seatFront', SeatZone.FRONT],
    seatMiddle: ['order.seatMiddle', SeatZone.MIDDLE],
    seatBack: ['order.seatBack', SeatZone.BACK],
  };
  const z = zones[field];
  if (!z) return undefined;
  return `(CASE WHEN (order.seatFront + order.seatMiddle + order.seatBack) > 0 THEN ${z[0]} WHEN order.seatZone = '${z[1]}' THEN order.seatCount ELSE 0 END)`;
}

/**
 * Số ghế và ghế đầu/giữa/cuối là hai cách ghi độc lập: có nhà xe chỉ cần số ghế,
 * có nhà xe chỉ cần đầu/giữa/cuối. Không ràng buộc bằng nhau, chỉ cần có ít nhất một trong hai.
 */
export function resolveSeats(
  dto: { seatFront?: number; seatMiddle?: number; seatBack?: number; seatCount?: number },
  current?: Order,
) {
  const base = current ? seatsOf(current) : { seatFront: 0, seatMiddle: 0, seatBack: 0 };
  const seatFront = dto.seatFront ?? base.seatFront;
  const seatMiddle = dto.seatMiddle ?? base.seatMiddle;
  const seatBack = dto.seatBack ?? base.seatBack;
  const seatCount = dto.seatCount ?? current?.seatCount ?? 1;
  return { seatFront, seatMiddle, seatBack, seatCount };
}

/** Cabin đơn đứng trước cabin đôi để thứ tự dòng luôn ổn định */
const CABIN_ORDER: CabinKind[] = [CabinKind.SINGLE, CabinKind.DOUBLE];

/** Sắp xếp dòng cabin theo thứ tự cố định; không có dòng nào thì trả null */
export function sortCabinLines(lines: readonly CabinLine[] | null | undefined): CabinLine[] | null {
  if (!lines || lines.length === 0) return null;
  return [...lines].sort((a, b) => CABIN_ORDER.indexOf(a.kind) - CABIN_ORDER.indexOf(b.kind));
}

/** Số ghế, giá nhập, giá bán của đơn cabin = tổng các dòng chi tiết */
export function cabinTotals(lines: readonly CabinLine[]) {
  return lines.reduce(
    (acc, l) => ({
      seatCount: acc.seatCount + l.quantity,
      costPrice: acc.costPrice + l.costPrice,
      sellPrice: acc.sellPrice + l.sellPrice,
    }),
    { seatCount: 0, costPrice: 0, sellPrice: 0 },
  );
}

/** Mô tả ngắn để ghi lịch sử, ví dụ "Cabin Đơn x2; Cabin Đôi x1" */
export function describeCabinLines(lines: readonly CabinLine[] | null | undefined): string | null {
  const sorted = sortCabinLines(lines);
  if (!sorted) return null;
  return sorted.map((l) => `${CABIN_LABELS[l.kind]} x${l.quantity}`).join('; ');
}

/** Các trường được so sánh để ghi lịch sử khi sửa đơn */
export const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'customerName', label: 'Tên khách' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'routeName', label: 'Tuyến đường' },
  { key: 'departureTime', label: 'Giờ đi' },
  { key: 'departureDate', label: 'Ngày đi' },
  { key: 'partner', label: 'Đối tác' },
  { key: 'vehicleType', label: 'Loại hình' },
  { key: 'cabinLines', label: 'Chi tiết cabin' },
  { key: 'seatCount', label: 'Số ghế' },
  { key: 'seatFront', label: 'Ghế đầu' },
  { key: 'seatMiddle', label: 'Ghế giữa' },
  { key: 'seatBack', label: 'Ghế cuối' },
  { key: 'pickupPoint', label: 'Điểm đón' },
  { key: 'dropoffPoint', label: 'Điểm trả' },
  { key: 'sellPrice', label: 'Giá bán' },
  { key: 'costPrice', label: 'Giá nhập' },
  { key: 'deposit', label: 'Đã cọc' },
  { key: 'collectOnDelivery', label: 'Nhờ thu' },
  { key: 'commission', label: 'Hoa hồng' },
  { key: 'note', label: 'Ghi chú' },
];

export function toOrderView(order: Order) {
  return {
    id: order.id,
    entryDate: order.entryDate,
    staff: order.createdBy
      ? { id: order.createdBy.id, fullName: order.createdBy.fullName }
      : { id: order.createdById, fullName: '' },
    customerName: order.customerName,
    phone: order.phone,
    route: order.route
      ? { id: order.route.id, name: order.route.name }
      : { id: order.routeId, name: '' },
    departureTime: order.departureTime,
    departureDate: order.departureDate,
    vehicleType: order.vehicleType,
    cabinLines: sortCabinLines(order.cabinLines),
    seatZone: order.seatZone,
    ...seatsOf(order),
    seatCount: order.seatCount,
    tickets: ticketsOf(order),
    costPrice: order.costPrice,
    sellPrice: order.sellPrice,
    deposit: order.deposit,
    collectOnDelivery: order.collectOnDelivery,
    commission: order.commission,
    partner: order.partner,
    pickupPoint: order.pickupPoint,
    dropoffPoint: order.dropoffPoint,
    note: order.note,
    smsSent: order.smsSent,
    smsSentAt: order.smsSentAt,
    messageChannel: order.messageChannel,
    smsContent: buildBookingSms({
      route: order.route?.name ?? '',
      departureTime: order.departureTime,
      departureDate: order.departureDate,
    }),
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
