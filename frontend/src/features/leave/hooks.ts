import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from './api';
import type { LeaveConfig } from './types';

const KEY = ['leave'] as const;

export function useLeaveMonth(month: string) {
  return useQuery({
    queryKey: [...KEY, month],
    queryFn: ({ signal }) => leaveApi.month(month, signal),
    // Lịch dùng chung nhiều người: quay lại tab thì tải lại để số chỗ còn lại luôn mới
    refetchOnWindowFocus: true,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useRegisterLeave() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (day: string) => leaveApi.register(day),
    // Thành công hay bị từ chối (đủ người) đều tải lại để thấy số liệu mới nhất
    onSettled: invalidate,
  });
}

export function useRemoveLeave() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: number) => leaveApi.remove(id), onSuccess: invalidate });
}

export function useSaveLeaveConfig() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (config: LeaveConfig) => leaveApi.saveConfig(config), onSuccess: invalidate });
}

export function useSetDayLimit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ day, max }: { day: string; max: number | null }) => leaveApi.setDayLimit(day, max),
    onSuccess: invalidate,
  });
}
