import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from './api';
import type { AttendanceConfig, OverrideInput } from './types';

export function useMyAttendanceToday(enabled: boolean) {
  return useQuery({
    queryKey: ['attendance', 'me'],
    queryFn: ({ signal }) => attendanceApi.me(signal),
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useAttendanceMonth(month: string) {
  return useQuery({
    queryKey: ['attendance', 'month', month],
    queryFn: ({ signal }) => attendanceApi.month(month, signal),
    refetchOnWindowFocus: false,
  });
}

export function useSaveAttendanceConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: AttendanceConfig) => attendanceApi.saveConfig(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useSetAttendanceOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OverrideInput) => attendanceApi.override(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', 'month'] }),
  });
}

/** Admin chọn lại ca cho một ngày của nhân viên; tải lại mọi số liệu chấm công để tính lại muộn / sớm / công */
export function useSetShiftOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: number; day: string; shiftStart: number | null }) =>
      attendanceApi.setShiftOverride(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useDayLog() {
  return useQuery({
    queryKey: ['attendance', 'day-log'],
    queryFn: ({ signal }) => attendanceApi.dayLog(signal),
    // Có lượt quẹt mới thì realtime tự tải lại; 5 phút một lần chỉ để dự phòng khi mất kết nối
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useOnlineUsers(enabled = true) {
  return useQuery({
    queryKey: ['online-users'],
    queryFn: ({ signal }) => attendanceApi.onlineUsers(signal),
    enabled,
    refetchOnWindowFocus: true,
  });
}
