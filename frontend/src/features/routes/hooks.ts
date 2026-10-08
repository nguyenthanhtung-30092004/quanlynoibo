import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { routesApi } from './api';
import type { CreateRouteInput, RouteFilters, UpdateRouteInput } from './types';

const KEY = ['routes'] as const;

export function useRoutes(filters?: RouteFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: ({ signal }) => routesApi.list(filters, signal),
  });
}

/** Lấy các tuyến đường đang hoạt động để lên đơn */
export function useActiveRoutes(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'active'],
    queryFn: ({ signal }) => routesApi.list({ isActive: true, limit: 100 }, signal),
    enabled,
    staleTime: 60_000,
    select: (res) => res.data,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRouteInput) => routesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateRouteInput }) =>
      routesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => routesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
