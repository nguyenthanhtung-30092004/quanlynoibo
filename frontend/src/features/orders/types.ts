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
  /** Chi tiết cabin đơn / cabin đôi; chỉ có khi loại hình là "Xe Cabin" */
  cabinLines: CabinLine[] | null;
  /** Số xe của đơn "Xe Riêng" (không tính vào số vé); loại hình khác là 0 */
  vehicleCount: number;
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
  /** Lý do hủy do người hủy nhập */
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderFilters {
  search: string;
  /** Số vé mỗi lần tải; bỏ trống = cỡ trang mặc định */
  pageSize?: number;
  staffId: number | 'all';
  routeId: number | 'all';
  /** Lọc nhiều tuyến cùng lúc; rỗng = không lọc theo nhiều tuyến */
  routeIds?: number[];
  /** true = bỏ vé đã hủy, để số dòng khớp số đơn của KPI */
  activeOnly?: boolean;
  /** true = chỉ đơn khách đã cọc (deposit > 0) */
  depositOnly?: boolean;
  /** Tên đối tác; bỏ trống = tất cả */
  partner?: string;
  /** Lọc nhiều đối tác cùng lúc (tên); rỗng = không lọc */
  partners?: string[];
  /** YYYY-MM-DD, theo ngày vào sổ (giờ VN) */
  dateFrom: string | null;
  dateTo: string | null;
  /** YYYY-MM-DD, theo ngày khởi hành */
  departureFrom?: string | null;
  departureTo?: string | null;
  page: number;

  /** Bộ lọc cột kiểu Excel */
  staffIds?: number[];
  customerNames?: string[];
  phones?: string[];
  departureTimes?: string[];
  smsStatus?: 'sent' | 'unsent';
  messageStates?: Array<'sms' | 'zalo' | 'unsent'>;
  sellPriceMin?: number;
  sellPriceMax?: number;
  commissionMin?: number;
  commissionMax?: number;
  deposits?: number[];
  sellPrices?: number[];
  commissions?: number[];
  orderCode?: string;
  entryDates?: string[];
  departureDates?: string[];
  vehicleTypes?: string[];
  notes?: string[];
  pickupPoints?: string[];
  dropoffPoints?: string[];
  cancelReasons?: string[];
  seatFronts?: number[];
  seatMiddles?: number[];
  seatBacks?: number[];
  seatCounts?: number[];
  costPrices?: number[];
  collectOnDeliveries?: number[];
}

/** Các cột có danh sách giá trị để lọc (khớp `column` của API column-values) */
export type ColumnValuesKey =
  | 'customer'
  | 'phone'
  | 'staff'
  | 'route'
  | 'partner'
  | 'departureTime'
  | 'deposit'
  | 'sellPrice'
  | 'commission'
  | 'message'
  | 'entryDate'
  | 'departureDate'
  | 'vehicleType'
  | 'seatFront'
  | 'seatMiddle'
  | 'seatBack'
  | 'seatCount'
  | 'costPrice'
  | 'collectOnDelivery'
  | 'note'
  | 'pickupPoint'
  | 'dropoffPoint'
  | 'cancelReason';

export interface ColumnValueOption {
  value: string;
  label: string;
  count: number;
}

export type CabinKind = 'SINGLE' | 'DOUBLE';

export const CABIN_KINDS: CabinKind[] = ['SINGLE', 'DOUBLE'];

export const CABIN_LABELS: Record<CabinKind, string> = {
  SINGLE: 'Cabin Đơn',
  DOUBLE: 'Cabin Đôi',
};

/** Một dòng chi tiết cabin; giá nhập / giá bán là tổng tiền của dòng đó */
export interface CabinLine {
  kind: CabinKind;
  quantity: number;
  costPrice: number;
  sellPrice: number;
}

export interface CreateOrderInput {
  customerName?: string;
  phone: string;
  routeId: number;
  departureTime: string;
  departureDate: string;
  vehicleType?: string;
  cabinLines?: CabinLine[];
  vehicleCount?: number;
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
  staffIds?: number[];
  routeId?: number;
  partner?: string;
  routeIds?: number[];
  partners?: string[];
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
  /** Top nhân viên toàn hệ thống (mọi vai trò đều nhận), chỉ gồm số đơn / vé */
  leaderboard?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
  /** Xếp hạng đầy đủ mọi nhân viên, chỉ gồm số đơn / vé (không lộ doanh thu hay hoa hồng) */
  ranking?: Array<{ staffId: number; fullName: string; total: number; seats: number }>;
  /** Chỉ có với Admin */
  byStaff?: Array<KpiSummary & { staffId: number; fullName: string }>;
  /** Số đơn (total), số vé (seats) và doanh thu theo tuyến, nhiều đơn nhất trước */
  byRoute?: Array<{ routeId: number; total: number; seats: number; revenue?: number; commission?: number }>;
  /** Chỉ có với Admin: số vé và hoa hồng theo đối tác, nhiều hoa hồng nhất trước */
  byPartner?: Array<{ partner: string; total: number; seats: number; commission: number }>;
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

/** Dòng công nợ gộp theo một đối tác chuẩn */
export interface PartnerDebtItem {
  partner: string;
  orders: number;
  tickets: number;
  revenue: number;
  commission: number;
  /** Giá nhập: số tiền phải trả nhà xe */
  cost: number;
}

/** Thông tin các đơn đối tác ngoài danh sách bị loại */
export interface PartnerDebtExcluded {
  orders: number;
  partners: string[];
}

/** Công nợ gộp theo đối tác trong khoảng lọc kèm các đơn bị loại ngoài danh sách */
export interface PartnerDebt {
  items: PartnerDebtItem[];
  excluded: PartnerDebtExcluded;
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

/** Kết quả nhập đơn từ Excel */
export interface ImportResult {
  total: number;
  created: number;
  /** Mã các đơn vừa tạo, dùng để hoàn tác lần nhập */
  createdIds: number[];
  duplicates: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

/** Kết quả hoàn tác một lần nhập Excel */
export interface RollbackImportResult {
  deleted: number;
  skipped: number;
}
