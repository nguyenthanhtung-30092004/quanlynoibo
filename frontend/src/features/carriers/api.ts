import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { Carrier, CarrierFilters, CreateCarrierInput, UpdateCarrierInput } from './types';

export const carriersApi = {
  list: (filters?: CarrierFilters, signal?: AbortSignal) =>
    api<Paginated<Carrier>>('carriers', {
      signal,
      query: {
        search: filters?.search?.trim() || undefined,
        isActive: filters?.isActive,
        page: filters?.page,
        limit: filters?.limit ?? 100,
      },
    }),

  get: (id: number) =>
    api<ApiResponse<Carrier>>(`carriers/${id}`).then((res) => res.data),

  create: (input: CreateCarrierInput) =>
    api<ApiResponse<Carrier>>('carriers', {
      method: 'POST',
      body: input,
    }).then((res) => res.data),

  update: (id: number, input: UpdateCarrierInput) =>
    api<ApiResponse<Carrier>>(`carriers/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((res) => res.data),

  remove: (id: number) =>
    api<ApiResponse<void>>(`carriers/${id}`, {
      method: 'DELETE',
    }).then((res) => res.data),
};
