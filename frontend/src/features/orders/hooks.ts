import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from './api';
import type {
  CreateOrderInput,
  KpiRange,
  OrderFilters,
  UpdateOrderInput,
} from './types';

const ORDERS_KEY = ['orders'] as const;
const KPI_KEY = ['kpi'] as const;

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: [...ORDERS_KEY, filters],
    queryFn: ({ signal }) => ordersApi.list(filters, signal),
    // Đổi trang/bộ lọc thì giữ danh sách cũ trên màn hình cho tới khi có dữ liệu mới
    placeholderData: keepPreviousData,
  });
}

export function useOrderHistory(id: number | null) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'history', id],
    queryFn: () => ordersApi.history(id as number),
    enabled: !!id,
    // Luôn lấy mới khi mở: lịch sử thay đổi sau mỗi lần sửa
    staleTime: 0,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: [...ORDERS_KEY, id],
    queryFn: () => (id ? ordersApi.get(id) : null),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => ordersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useImportOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => ordersApi.importExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateOrderInput }) =>
      ordersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useSendSms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.sendSms(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: KPI_KEY });
    },
  });
}

export function useKpi(date?: string, range?: KpiRange) {
  return useQuery({
    queryKey: [...KPI_KEY, date, range],
    queryFn: () => ordersApi.kpi(date, range),
  });
}

/** Hoạt động gần đây; khóa nằm dưới 'orders' nên tự tải lại khi có sự kiện realtime về đơn */
export function useOrderActivity() {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'activity'],
    queryFn: () => ordersApi.activity(),
  });
}

export function useDebts(range?: KpiRange) {
  return useQuery({
    queryKey: [...KPI_KEY, 'debts', range],
    queryFn: () => ordersApi.debts(range),
  });
}

export function useExportOrders() {
  return useMutation({
    mutationFn: async (filters: OrderFilters) => {
      const { blob, filename } = await ordersApi.exportExcel(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
}
