import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { partnersApi } from './api';
import type { PartnerInput } from './types';

const KEY = ['partners'] as const;

export function usePartners(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => partnersApi.list(signal),
    enabled,
    staleTime: 60_000,
    select: (res) => res.data,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PartnerInput) => partnersApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<PartnerInput> }) =>
      partnersApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => partnersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
