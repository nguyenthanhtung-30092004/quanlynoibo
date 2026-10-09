export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'running',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Kênh gửi tin cho khách */
export type MessageChannel = 'SMS' | 'ZALO';

export enum SeatZone {
  FRONT = 'FRONT',
  MIDDLE = 'MIDDLE',
  BACK = 'BACK',
}

export const SEAT_ZONE_LABELS: Record<SeatZone, string> = {
  [SeatZone.FRONT]: 'Đầu',
  [SeatZone.MIDDLE]: 'Giữa',
  [SeatZone.BACK]: 'Cuối',
};

export interface Order {
  id: number;
  entryDate: string;
  staff: { id: number; fullName: string };
  customerName: string | null;
  phone: string;
  route: { id: number; name: string };
  /** HH:mm */
  departureTime: string;
  /** YYYY-MM-DD */
  departureDate: string;
  vehicleType: string | null;
  seatZone: SeatZone | null;
  seatFront: number;
  seatMiddle: number;
  seatBack: number;
  /** Số ghế nhập riêng (có thể 0 nếu nhà xe chỉ tính theo đầu/giữa/cuối) */
  seatCount: number;
  /** Số vé của đơn: số ghế, hoặc tổng đầu+giữa+cuối nếu không nhập số ghế */
  tickets: number;
  costPrice: number;
  sellPrice: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
  partner: string | null;
  pickupPoint: string | null;
  dropoffPoint: string | null;
  note: string | null;
  smsSent: boolean;
  smsSentAt: string | null;
  /** Kênh đã dùng để gửi tin gần nhất */
  messageChannel: MessageChannel | null;
  /** Nội dung tin nhắn đã điền sẵn từ mẫu, do server sinh */
  smsContent: string;
  /** Thời điểm hủy vé; null = còn hiệu lực */
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderFilters {
  search: string;
  staffId: number | 'all';
  routeId: number | 'all';
  /** Tên đối tác; bỏ trống = tất cả */
  partner?: string;
  /** YYYY-MM-DD, theo ngày vào sổ (giờ VN) */
  dateFrom: string | null;
  dateTo: string | null;
  /** YYYY-MM-DD, theo ngày khởi hành */
  departureFrom?: string | null;
  departureTo?: string | null;
  page: number;
}

export interface CreateOrderInput {
  customerName?: string;
  phone: string;
  routeId: number;
  departureTime: string;
  departureDate: string;
  vehicleType?: string;
  seatZone?: SeatZone;
  seatFront?: number;
  seatMiddle?: number;
  seatBack?: number;
  seatCount?: number;
  costPrice?: number;
  sellPrice?: number;
  deposit?: number;
  collectOnDelivery?: number;
  commission?: number;
  partner?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  note?: string;
  staffId?: number;
}

export type UpdateOrderInput = Partial<Omit<CreateOrderInput, 'staffId'>>;

/** Bộ lọc KPI: theo ngày khởi hành hoặc ngày vào sổ, cộng thêm nhân viên / tuyến / đối tác */
export interface KpiRange {
  departureFrom?: string;
  departureTo?: string;
  dateFrom?: string;
  dateTo?: string;
  staffId?: number;
  routeId?: number;
  partner?: string;
}

export interface KpiSummary {
  total: number;
  seats: number;
  smsSent: number;
  /** Chỉ Admin nhận được (server không trả cho nhân viên) */
  revenue?: number;
  cost?: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
}

export interface Kpi extends KpiSummary {
  date: string;
  /** Chỉ có với Admin */
  byStaff?: Array<KpiSummary & { staffId: number; fullName: string }>;
}

export type OrderHistoryAction = 'CREATE' | 'UPDATE' | 'CANCEL' | 'SEND_MESSAGE';

export interface OrderChange {
  field: string;
  label: string;
  from: string | number | null;
  to: string | number | null;
}

/** Một dòng lịch sử thao tác trên đơn */
export interface OrderHistoryEntry {
  id: number;
  orderId: number;
  action: OrderHistoryAction;
  actorId: number | null;
  actorName: string;
  summary: string | null;
  changes: OrderChange[] | null;
  createdAt: string;
}

/** Công nợ gộp theo đối tác trong khoảng lọc */
export interface PartnerDebt {
  partner: string;
  orders: number;
  tickets: number;
  revenue: number;
  commission: number;
  /** Giá nhập: số tiền phải trả nhà xe */
  cost: number;
}

/** Một hoạt động trên đơn, hiện trong chuông thông báo */
export interface OrderActivity {
  id: number;
  orderId: number;
  action: OrderHistoryAction;
  actorId: number | null;
  actorName: string;
  summary: string | null;
  createdAt: string;
  customerName: string | null;
  routeName: string | null;
  departureTime: string | null;
  departureDate: string | null;
}
