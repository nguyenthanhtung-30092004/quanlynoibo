import { create } from 'zustand';
import type { Order, OrderFilters } from '@/features/orders/types';
import { getVnToday } from '@/lib/time';

interface UiState {
  createOrderOpen: boolean;
  editingOrder: Order | null;
  smsOrder: Order | null;
  changePasswordOpen: boolean;

  filters: OrderFilters;

  setCreateOrderOpen: (open: boolean) => void;
  setEditingOrder: (order: Order | null) => void;
  setSmsOrder: (order: Order | null) => void;
  setChangePasswordOpen: (open: boolean) => void;
  /** Đổi bộ lọc sẽ đưa về trang 1 (trừ khi đang đổi trang) */
  setFilters: (patch: Partial<OrderFilters>) => void;
}

function defaultFilters(): OrderFilters {
  const today = getVnToday();
  return {
    search: '',
    staffId: 'all',
    routeId: 'all',
    dateFrom: today,
    dateTo: today,
    page: 1,
  };
}

export const useUiStore = create<UiState>()((set) => ({
  createOrderOpen: false,
  editingOrder: null,
  smsOrder: null,
  changePasswordOpen: false,

  filters: defaultFilters(),

  setCreateOrderOpen: (createOrderOpen) => set({ createOrderOpen }),
  setEditingOrder: (editingOrder) => set({ editingOrder }),
  setSmsOrder: (smsOrder) => set({ smsOrder }),
  setChangePasswordOpen: (changePasswordOpen) => set({ changePasswordOpen }),
  setFilters: (patch) =>
    set((s) => ({ filters: { ...s.filters, page: 1, ...patch } })),
}));
