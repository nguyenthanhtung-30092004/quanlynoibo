import { api, apiDownload, type ApiResponse, type Paginated } from '@/lib/api-client';
import { ORDERS_PAGE_SIZE } from './constants';
import type {
  CreateOrderInput,
  Kpi,
  KpiRange,
  MessageChannel,
  Order,
  OrderFilters,
  UpdateOrderInput,
} from './types';

/** Tham số lọc dùng chung cho danh sách và xuất Excel */
function filterParams(filters: OrderFilters) {
  return {
    search: filters.search.trim() || undefined,
    staffId: filters.staffId === 'all' ? undefined : filters.staffId,
    routeId: filters.routeId === 'all' ? undefined : filters.routeId,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
    departureFrom: filters.departureFrom ?? undefined,
    departureTo: filters.departureTo ?? undefined,
  };
}

export const ordersApi = {
  list: (filters: OrderFilters, signal?: AbortSignal) =>
    api<Paginated<Order>>('orders', {
      signal,
      query: {
        ...filterParams(filters),
        page: filters.page,
        limit: ORDERS_PAGE_SIZE,
      },
    }),

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
    api<ApiResponse<Kpi>>('orders/kpi', { query: { date, ...range } }).then((res) => res.data),

  exportExcel: (filters: OrderFilters) =>
    apiDownload('orders/export', filterParams(filters)),
};
