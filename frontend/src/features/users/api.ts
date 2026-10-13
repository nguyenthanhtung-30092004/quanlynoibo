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

  /** Chỉ Admin: mật khẩu hiện tại của nhân viên, null nếu tài khoản cũ chưa đặt lại mật khẩu */
  revealPassword: (id: number) =>
    api<ApiResponse<{ password: string | null }>>(`users/${id}/password`).then(
      (res) => res.data.password,
    ),

  remove: (id: number) => api<ApiResponse<null>>(`users/${id}`, { method: 'DELETE' }),
};
