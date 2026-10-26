import { api, apiDownload, apiUpload, type ApiResponse, type Paginated } from '@/lib/api-client';
import { ORDERS_PAGE_SIZE } from './constants';
import type {
  CreateOrderInput,
  Kpi,
  KpiRange,
  MessageChannel,
  Order,
  OrderFilters,
  OrderActivity,
  OrderHistoryEntry,
  ColumnValueOption,
  ColumnValuesKey,
  ImportResult,
  RollbackImportResult,
  PartnerDebt,
  UpdateOrderInput,
} from './types';

/** Tham số lọc dùng chung cho danh sách và xuất Excel */
export function filterParams(filters: OrderFilters) {
  return {
    search: filters.search.trim() || undefined,
    staffId: filters.staffId === 'all' ? undefined : filters.staffId,
    routeId: filters.routeId === 'all' ? undefined : filters.routeId,
    routeIds: filters.routeIds?.length ? filters.routeIds.join(',') : undefined,
    activeOnly: filters.activeOnly ? 'true' : undefined,
    depositOnly: filters.depositOnly ? 'true' : undefined,
    partner: filters.partner || undefined,
    partners: filters.partners?.length ? filters.partners.join(',') : undefined,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    departureFrom: filters.departureFrom ?? undefined,
    departureTo: filters.departureTo ?? undefined,
    // Bộ lọc cột
    staffIds: filters.staffIds?.length ? filters.staffIds.join(',') : undefined,
    customerNames: filters.customerNames?.length ? filters.customerNames.join(',') : undefined,
    customerType: filters.customerType || undefined,
    phones: filters.phones?.length ? filters.phones.join(',') : undefined,
    departureTimes: filters.departureTimes?.length ? filters.departureTimes.join(',') : undefined,
    smsStatus: filters.smsStatus || undefined,
    messageStates: filters.messageStates?.length ? filters.messageStates.join(',') : undefined,
    sellPriceMin: filters.sellPriceMin !== undefined ? filters.sellPriceMin : undefined,
    sellPriceMax: filters.sellPriceMax !== undefined ? filters.sellPriceMax : undefined,
    commissionMin: filters.commissionMin !== undefined ? filters.commissionMin : undefined,
    commissionMax: filters.commissionMax !== undefined ? filters.commissionMax : undefined,
    deposits: filters.deposits?.length ? filters.deposits.join(',') : undefined,
    sellPrices: filters.sellPrices?.length ? filters.sellPrices.join(',') : undefined,
    commissions: filters.commissions?.length ? filters.commissions.join(',') : undefined,
    orderCode: filters.orderCode?.trim() || undefined,
    entryDates: filters.entryDates?.length ? filters.entryDates.join(',') : undefined,
    departureDates: filters.departureDates?.length ? filters.departureDates.join(',') : undefined,
    vehicleTypes: joinText(filters.vehicleTypes),
    notes: joinText(filters.notes),
    pickupPoints: joinText(filters.pickupPoints),
    dropoffPoints: joinText(filters.dropoffPoints),
    cancelReasons: joinText(filters.cancelReasons),
    seatFronts: joinNumbers(filters.seatFronts),
    seatMiddles: joinNumbers(filters.seatMiddles),
    seatBacks: joinNumbers(filters.seatBacks),
    seatCounts: joinNumbers(filters.seatCounts),
    costPrices: joinNumbers(filters.costPrices),
    collectOnDeliveries: joinNumbers(filters.collectOnDeliveries),
  };
}

/** Văn bản có thể chứa dấu phẩy nên tách bằng ký tự điều khiển \u001f (khớp backend) */
function joinText(values?: string[]) {
  return values?.length ? values.join('\u001f') : undefined;
}

function joinNumbers(values?: number[]) {
  return values?.length ? values.join(',') : undefined;
}

/** Danh sách tuyến / đối tác gửi lên dưới dạng chuỗi cách nhau bằng dấu phẩy */
function kpiQuery(date?: string, range?: KpiRange) {
  const { routeIds, partners, staffIds, ...rest } = range ?? {};
  return {
    date,
    ...rest,
    routeIds: routeIds?.length ? routeIds.join(',') : undefined,
    partners: partners?.length ? partners.join(',') : undefined,
    staffIds: staffIds?.length ? staffIds.join(',') : undefined,
  };
}

export const ordersApi = {
  list: (filters: OrderFilters, signal?: AbortSignal) =>
    api<Paginated<Order>>('orders', {
      signal,
      query: {
        ...filterParams(filters),
        page: filters.page,
        limit: filters.pageSize ?? ORDERS_PAGE_SIZE,
      },
    }),

  history: (id: number) =>
    api<ApiResponse<OrderHistoryEntry[]>>(`orders/${id}/history`).then((res) => res.data),

  get: (id: number) =>
    api<ApiResponse<Order>>(`orders/${id}`).then((res) => res.data),

  create: (input: CreateOrderInput) =>
    api<ApiResponse<Order>>('orders', { method: 'POST', body: input }).then(
      (res) => res.data,
    ),

  update: (id: number, input: UpdateOrderInput) =>
    api<ApiResponse<Order>>(`orders/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((res) => res.data),

  cancel: (id: number, reason: string) =>
    api<ApiResponse<Order>>(`orders/${id}/cancel`, { method: 'POST', body: { reason } }).then(
      (res) => res.data,
    ),

  remove: (id: number) =>
    api<ApiResponse<{ message: string }>>(`orders/${id}`, {
      method: 'DELETE',
    }).then((res) => res.data),

  /**
   * Gửi tin cho khách qua kênh được chọn; dryRun = true nghĩa là server đang chạy thử, chưa gửi thật;
   * fallbackToSms = true nghĩa là Zalo không gửi được nên server đã tự gửi SMS thay
   */
  sendMessage: (id: number, channel: MessageChannel) =>
    api<ApiResponse<Order> & { dryRun?: boolean; fallbackToSms?: boolean }>(`orders/${id}/send-sms`, {
      method: 'POST',
      body: { channel },
    }),

  sendSms: (id: number) =>
    api<ApiResponse<Order>>(`orders/${id}/send-sms`, { method: 'POST' }).then(
      (res) => res.data,
    ),

  kpi: (date?: string, range?: KpiRange) =>
    api<ApiResponse<Kpi>>('orders/kpi', { query: kpiQuery(date, range) }).then((res) => res.data),

  kpiFilterOptions: (range?: KpiRange) =>
    api<ApiResponse<{ staffIds: number[]; routeIds: number[]; partners: string[] }>>('orders/kpi/filter-options', {
      query: kpiQuery(undefined, range),
    }).then((res) => res.data),

  activity: () =>
    api<ApiResponse<OrderActivity[]>>('orders/activity').then((res) => res.data),

  debts: (range?: KpiRange) =>
    api<ApiResponse<PartnerDebt>>('orders/debts', { query: kpiQuery(undefined, range) }).then((res) => res.data),

  exportDebts: (range?: KpiRange) => apiDownload('orders/debts/export', kpiQuery(undefined, range)),

  exportExcel: (filters: OrderFilters) =>
    apiDownload('orders/export', filterParams(filters)),

  columnValues: (
    column: ColumnValuesKey,
    filters: OrderFilters,
    q?: string,
    signal?: AbortSignal,
  ) =>
    api<ApiResponse<ColumnValueOption[]>>('orders/column-values', {
      signal,
      query: {
        ...filterParams(filters),
        column,
        q: q?.trim() || undefined,
      },
    }).then((res) => res.data),

  /** Nhập đơn từ file Excel (chỉ Admin) */
  importExcel: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<ApiResponse<ImportResult>>('orders/import', form, onProgress).then(
      (res) => res.data,
    );
  },

  /** Hoàn tác lần nhập Excel: xóa các đơn vừa nhập (chỉ Admin) */
  rollbackImport: (ids: number[]) =>
    api<ApiResponse<RollbackImportResult>>('orders/import/rollback', {
      method: 'POST',
      body: { ids },
    }).then((res) => res.data),
};
