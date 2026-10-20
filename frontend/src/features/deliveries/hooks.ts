import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveriesApi } from './api';
import type { DeliveryFilters, DeliveryInput } from './types';

const KEY = ['deliveries'] as const;

export function useDeliveries(filters: DeliveryFilters) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: ({ signal }) => deliveriesApi.list(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeliveryInput) => deliveriesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<DeliveryInput> }) =>
      deliveriesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deliveriesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
