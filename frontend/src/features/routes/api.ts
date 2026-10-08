import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { CreateRouteInput, Route, RouteFilters, UpdateRouteInput } from './types';

export const routesApi = {
  list: (filters?: RouteFilters, signal?: AbortSignal) =>
    api<Paginated<Route>>('routes', {
      signal,
      query: {
        search: filters?.search?.trim() || undefined,
        isActive: filters?.isActive,
        page: filters?.page,
        limit: filters?.limit ?? 100,
      },
    }),

  get: (id: number) =>
    api<ApiResponse<Route>>(`routes/${id}`).then((res) => res.data),

  create: (input: CreateRouteInput) =>
    api<ApiResponse<Route>>('routes', {
      method: 'POST',
      body: input,
    }).then((res) => res.data),

  update: (id: number, input: UpdateRouteInput) =>
    api<ApiResponse<Route>>(`routes/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((res) => res.data),

  remove: (id: number) =>
    api<ApiResponse<void>>(`routes/${id}`, {
      method: 'DELETE',
    }).then((res) => res.data),
};
