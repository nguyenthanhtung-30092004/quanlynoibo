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
  ImportResult,
  PartnerDebt,
  UpdateOrderInput,
} from './types';

/** Tham số lọc dùng chung cho danh sách và xuất Excel */
function filterParams(filters: OrderFilters) {
  return {
    search: filters.search.trim() || undefined,
    staffId: filters.staffId === 'all' ? undefined : filters.staffId,
    routeId: filters.routeId === 'all' ? undefined : filters.routeId,
    routeIds: filters.routeIds?.length ? filters.routeIds.join(',') : undefined,
    partner: filters.partner || undefined,
    partners: filters.partners?.length ? filters.partners.join(',') : undefined,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    departureFrom: filters.departureFrom ?? undefined,
    departureTo: filters.departureTo ?? undefined,
  };
}

/** Danh sách tuyến / đối tác gửi lên dưới dạng chuỗi cách nhau bằng dấu phẩy */
function kpiQuery(date?: string, range?: KpiRange) {
  const { routeIds, partners, ...rest } = range ?? {};
  return {
    date,
    ...rest,
    routeIds: routeIds?.length ? routeIds.join(',') : undefined,
    partners: partners?.length ? partners.join(',') : undefined,
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

  /** Gửi tin cho khách qua kênh được chọn; dryRun = true nghĩa là server đang chạy thử, chưa gửi thật */
  sendMessage: (id: number, channel: MessageChannel) =>
    api<ApiResponse<Order> & { dryRun?: boolean }>(`orders/${id}/send-sms`, {
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
    api<ApiResponse<{ routeIds: number[]; partners: string[] }>>('orders/kpi/filter-options', {
      query: kpiQuery(undefined, range),
    }).then((res) => res.data),

  activity: () =>
    api<ApiResponse<OrderActivity[]>>('orders/activity').then((res) => res.data),

  debts: (range?: KpiRange) =>
    api<ApiResponse<PartnerDebt[]>>('orders/debts', { query: kpiQuery(undefined, range) }).then((res) => res.data),

  exportDebts: (range?: KpiRange) => apiDownload('orders/debts/export', kpiQuery(undefined, range)),

  exportExcel: (filters: OrderFilters) =>
    apiDownload('orders/export', filterParams(filters)),

  /** Nhập đơn từ file Excel (chỉ Admin) */
  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<ApiResponse<ImportResult>>('orders/import', form).then(
      (res) => res.data,
    );
  },
};
