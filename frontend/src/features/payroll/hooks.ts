import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from './api';
import type { SavePayrollInput } from './types';

const key = (month: string) => ['payroll', month] as const;

export function usePayroll(month: string) {
  return useQuery({
    queryKey: key(month),
    queryFn: ({ signal }) => payrollApi.get(month, signal),
    // Đang sửa tay trên trang thì không tự tải lại khi quay lại cửa sổ (sẽ đè mất thay đổi chưa lưu)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useSavePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavePayrollInput) => payrollApi.save(input),
    onSuccess: (data) => queryClient.setQueryData(key(data.month), data),
  });
}
