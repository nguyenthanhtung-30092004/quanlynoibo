'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, type Paginated } from '@/lib/api-client';
import type { User } from '@/features/auth/types';
import { usersApi } from './api';
import type { UpdateUserInput } from './types';

export const userKeys = {
  all: ['users'] as const,
  list: (params: { page: number; search: string }) =>
    ['users', 'list', params] as const,
  staff: ['users', 'staff'] as const,
};

/** Danh sách nhân viên đang hoạt động (endpoint chỉ dành cho Admin) */
export function useActiveStaff(enabled: boolean) {
  return useQuery({
    queryKey: userKeys.staff,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api<Paginated<User>>('users', { query: { limit: 100 } });
      return res.data.filter((u) => u.role === 'STAFF' && u.isActive);
    },
  });
}

export function useUsers(params: { page: number; search: string }, enabled = true) {
  return useQuery({
    enabled,
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: usersApi.create, onSuccess: invalidate });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      usersApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: usersApi.remove, onSuccess: invalidate });
}
