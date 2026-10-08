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
  seatCount: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface OrderFilters {
  search: string;
  staffId: number | 'all';
  routeId: number | 'all';
  /** YYYY-MM-DD, theo ngày vào sổ (giờ VN) */
  dateFrom: string | null;
  dateTo: string | null;
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

export interface KpiSummary {
  total: number;
  seats: number;
  smsSent: number;
  revenue: number;
  cost: number;
  deposit: number;
  collectOnDelivery: number;
  commission: number;
}

export interface Kpi extends KpiSummary {
  date: string;
  /** Chỉ có với Admin */
  byStaff?: Array<KpiSummary & { staffId: number; fullName: string }>;
}
