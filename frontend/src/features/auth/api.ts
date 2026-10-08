import { api, type ApiResponse } from '@/lib/api-client';
import type { ChangePasswordInput, LoginInput, User } from './types';

export const authApi = {
  login: (input: LoginInput) =>
    api<{ data: { user: User } }>('auth/login', { method: 'POST', body: input }),

  logout: () => api<unknown>('auth/logout', { method: 'POST' }),

  me: () => api<ApiResponse<User>>('auth/me').then((res) => res.data),

  changePassword: (input: ChangePasswordInput) =>
    api<ApiResponse<{ success: boolean }>>('auth/change-password', {
      method: 'POST',
      body: input,
    }),
};
