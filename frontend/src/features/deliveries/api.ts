import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { Delivery, DeliveryFilters, DeliveryInput } from './types';

export const deliveriesApi = {
  list: (filters: DeliveryFilters, signal?: AbortSignal) =>
    api<Paginated<Delivery>>('deliveries', {
      signal,
      query: {
        search: filters.search?.trim() || undefined,
        page: filters.page,
        limit: filters.limit,
      },
    }),

  create: (input: DeliveryInput) =>
    api<ApiResponse<Delivery>>('deliveries', { method: 'POST', body: input }).then((res) => res.data),

  update: (id: number, input: Partial<DeliveryInput>) =>
    api<ApiResponse<Delivery>>(`deliveries/${id}`, { method: 'PATCH', body: input }).then(
      (res) => res.data,
    ),

  remove: (id: number) =>
    api<ApiResponse<void>>(`deliveries/${id}`, { method: 'DELETE' }).then((res) => res.data),
};
