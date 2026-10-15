import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from './api';
import type {
  ColumnValuesKey,
  CreateOrderInput,
  KpiRange,
  OrderFilters,
  UpdateOrderInput,
} from './types';

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => ['orders', 'list'] as const,
  list: (filters: OrderFilters) => ['orders', 'list', filters] as const,
  details: () => ['orders', 'detail'] as const,
  detail: (id: number) => ['orders', 'detail', id] as const,
  histories: () => ['orders', 'history'] as const,
  history: (id: number) => ['orders', 'history', id] as const,
  activity: () => ['orders', 'activity'] as const,
  unlistedPartners: () => ['orders', 'unlisted-partners'] as const,
  columnValues: (column: ColumnValuesKey, filters: OrderFilters, q?: string) =>
    ['orders', 'column-values', column, filters, q] as const,
};

const KPI_KEY = ['kpi'] as const;

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: ({ signal }) => ordersApi.list(filters, signal),
    // Đổi trang/bộ lọc thì giữ danh sách cũ trên màn hình cho tới khi có dữ liệu mới
    placeholderData: keepPreviousData,
  });
}

export function useOrderHistory(id: number | null) {
  return useQuery({
    queryKey: id ? orderKeys.history(id) : ['orders', 'history', null],
    queryFn: () => ordersApi.history(id as number),
    enabled: !!id,
    // Luôn lấy mới khi mở: lịch sử thay đổi sau mỗi lần sửa
    staleTime: 0,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: id ? orderKeys.detail(id) : ['orders', 'detail', null],
    queryFn: () => (id ? ordersApi.get(id) : null),
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => ordersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useImportOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => ordersApi.importExcel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useRollbackImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => ordersApi.rollbackImport(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateOrderInput }) =>
      ordersApi.update(id, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(vars.id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.history(vars.id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => ordersApi.cancel(id, reason),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(vars.id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.history(vars.id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: KPI_KEY, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useSendSms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.sendSms(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists(), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.history(id), refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: orderKeys.activity(), refetchType: 'active' });
    },
  });
}

export function useKpi(date?: string, range?: KpiRange) {
  return useQuery({
    queryKey: [...KPI_KEY, date, range],
    queryFn: () => ordersApi.kpi(date, range),
  });
}

/** Tuyến và đối tác có đơn theo khoảng ngày / nhân viên, bỏ qua lọc tuyến và đối tác */
export function useKpiFilterOptions(range: KpiRange | undefined, enabled = true) {
  return useQuery({
    queryKey: [...KPI_KEY, 'filter-options', range],
    queryFn: () => ordersApi.kpiFilterOptions(range),
    enabled,
  });
}

/** Hoạt động gần đây */
export function useOrderActivity() {
  return useQuery({
    queryKey: orderKeys.activity(),
    queryFn: () => ordersApi.activity(),
  });
}

export function useDebts(range?: KpiRange) {
  return useQuery({
    queryKey: [...KPI_KEY, 'debts', range],
    queryFn: () => ordersApi.debts(range),
  });
}

export function useUnlistedPartners(enabled = true) {
  return useQuery({
    queryKey: orderKeys.unlistedPartners(),
    queryFn: () => ordersApi.unlistedPartners(),
    enabled,
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

export function useColumnValues(
  column: ColumnValuesKey,
  filters: OrderFilters,
  q?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: orderKeys.columnValues(column, filters, q),
    queryFn: ({ signal }) => ordersApi.columnValues(column, filters, q, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}
