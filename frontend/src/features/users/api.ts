import { api, type ApiResponse, type Paginated } from '@/lib/api-client';
import type { CreateUserInput, UpdateUserInput, User } from './types';

export const USERS_PAGE_SIZE = 20;

export const usersApi = {
  list: (params: { page: number; search: string }) =>
    api<Paginated<User>>('users', {
      query: {
        page: params.page,
        limit: USERS_PAGE_SIZE,
        search: params.search.trim() || undefined,
      },
    }),

  create: (input: CreateUserInput) =>
    api<ApiResponse<User>>('users', { method: 'POST', body: input }).then(
      (res) => res.data,
    ),

  update: (id: number, input: UpdateUserInput) =>
    api<ApiResponse<User>>(`users/${id}`, { method: 'PATCH', body: input }).then(
      (res) => res.data,
    ),

  remove: (id: number) => api<ApiResponse<null>>(`users/${id}`, { method: 'DELETE' }),
};
