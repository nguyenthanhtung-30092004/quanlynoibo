import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type AppSettings } from './api';

const KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => settingsApi.get(signal),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AppSettings>) => settingsApi.update(input),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}
