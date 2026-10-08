import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { Partner, PartnerInput } from './types';

/** Backend cho phép tối đa 200 dòng mỗi trang */
export const PARTNERS_LIMIT = 200;

export const partnersApi = {
  list: (signal?: AbortSignal) =>
    api<Paginated<Partner>>('partners', { signal, query: { limit: PARTNERS_LIMIT } }),

  create: (input: PartnerInput) =>
    api<ApiResponse<Partner>>('partners', { method: 'POST', body: input }).then(
      (res) => res.data,
    ),

  update: (id: number, input: Partial<PartnerInput>) =>
    api<ApiResponse<Partner>>(`partners/${id}`, { method: 'PATCH', body: input }).then(
      (res) => res.data,
    ),

  remove: (id: number) =>
    api<ApiResponse<void>>(`partners/${id}`, { method: 'DELETE' }).then((res) => res.data),
};
