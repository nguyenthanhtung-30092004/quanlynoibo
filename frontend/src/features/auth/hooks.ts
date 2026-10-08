'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';

export const authKeys = { me: ['auth', 'me'] as const };

/** Người dùng đang đăng nhập (nguồn sự thật: server, không đọc từ cookie/JS) */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    staleTime: 5 * 60_000,
    retry: false,
    // Nhiều component cùng dùng query này; lỗi thì không tự gọi lại mỗi lần mount
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ data }) => queryClient.setQueryData(authKeys.me, data.user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // Xóa toàn bộ cache để dữ liệu của người cũ không lộ sang người đăng nhập sau
      queryClient.clear();
      window.location.assign('/login');
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword });
}
