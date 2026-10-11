import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { Partner, PartnerInput } from './types';

/** Backend cho phép tối đa 200 dòng mỗi trang */
export const PARTNERS_LIMIT = 200;

export const partnersApi = {
  list: (signal?: AbortSignal) =>
    api<Paginated<Partner>>('partners', { signal, query: { limit: PARTNERS_LIMIT } }),

  /** Hoa hồng gợi ý = hoa hồng mỗi vé của nhà xe x số vé; null nếu nhà xe chưa đặt mức */
  commissionQuote: (name: string, seats: number, signal?: AbortSignal) =>
    api<ApiResponse<{ commission: number | null }>>('partners/commission-quote', {
      signal,
      query: { name, seats },
    }).then((res) => res.data.commission),

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
