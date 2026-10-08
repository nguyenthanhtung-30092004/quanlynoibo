import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { carriersApi } from './api';
import type { CarrierFilters, CreateCarrierInput, UpdateCarrierInput } from './types';

const KEY = ['carriers'] as const;

export function useCarriers(filters?: CarrierFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: ({ signal }) => carriersApi.list(filters, signal),
  });
}

export function useActiveCarriers(enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'active'],
    queryFn: ({ signal }) => carriersApi.list({ isActive: true, limit: 100 }, signal),
    enabled,
    staleTime: 60_000,
    select: (res) => res.data,
  });
}

export function useCreateCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCarrierInput) => carriersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateCarrierInput }) =>
      carriersApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => carriersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
