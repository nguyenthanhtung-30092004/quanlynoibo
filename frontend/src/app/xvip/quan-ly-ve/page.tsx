'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import {
  useKpiFilterOptions,
  useOrders,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useCancelOrder,
  useImportOrders,
  useExportOrders,
  useRollbackImport,
  useUnlistedPartners,
} from '@/features/orders/hooks';
import { ordersApi } from '@/features/orders/api';
import { useActiveRoutes } from '@/features/routes/hooks';
import { usePartners } from '@/features/partners/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import { useCurrentUser } from '@/features/auth/hooks';
import {
  type CreateOrderInput,
  type ImportResult,
  type MessageChannel,
  type Order,
  type OrderFilters,
} from '@/features/orders/types';
import { useToast } from '@/features/xvip/toast';
import { ORDERS_ALL_SIZE, ORDERS_PAGE_SIZE } from '@/features/orders/constants';
import {
  rangeParams,
  useDateFilter,
} from '@/features/xvip/date-filter';

import { OrdersToolbar } from '@/features/orders/components/OrdersToolbar';
import { OrdersFiltersBar } from '@/features/orders/components/OrdersFiltersBar';
import { OrdersTableView } from '@/features/orders/components/OrdersTableView';
import { OrderFormModal } from '@/features/orders/components/OrderFormModal';
import { CancelOrderModal } from '@/features/orders/components/CancelOrderModal';
import { DeleteOrderModal } from '@/features/orders/components/DeleteOrderModal';
import { ImportResultModal } from '@/features/orders/components/ImportResultModal';

const OrderDetailModal = dynamic(
  () => import('@/features/orders/components/OrderDetailModal').then((m) => m.OrderDetailModal),
  { ssr: false },
);
const OrderHistoryModal = dynamic(
  () => import('@/features/orders/components/OrderHistoryModal').then((m) => m.OrderHistoryModal),
  { ssr: false },
);

const ALL = 'all';

export default function TicketManagementPage() {
  const [localFilters, setFilters] = useState<OrderFilters>({
    search: '',
    staffId: ALL,
    routeId: ALL,
    routeIds: [],
    dateFrom: null,
    dateTo: null,
    page: 1,
  });

  const { range, basis, label: rangeLabel } = useDateFilter();
  const searching = localFilters.search.trim() !== '';

  const filters = useMemo<OrderFilters>(
    () =>
      searching
        ? {
            search: localFilters.search,
            staffId: ALL,
            routeId: ALL,
            routeIds: [],
            dateFrom: null,
            dateTo: null,
            departureFrom: null,
            departureTo: null,
            page: localFilters.page,
          }
        : {
            ...localFilters,
            page: 1,
            pageSize: ORDERS_ALL_SIZE,
            dateFrom: null,
            dateTo: null,
            departureFrom: null,
            departureTo: null,
            ...rangeParams(range, basis),
          },
    [localFilters, range, basis, searching],
  );

  useEffect(() => {
    setFilters((prev) => {
      const hasAmounts =
        (prev.deposits?.length ?? 0) > 0 ||
        (prev.sellPrices?.length ?? 0) > 0 ||
        (prev.commissions?.length ?? 0) > 0;
      if (!hasAmounts && prev.page === 1) return prev;
      return {
        ...prev,
        deposits: undefined,
        sellPrices: undefined,
        commissions: undefined,
        page: 1,
      };
    });
  }, [range, basis]);

  const { data: ordersData, isLoading, refetch } = useOrders(filters);
  const { data: activeRoutes = [] } = useActiveRoutes();
  const { data: partnerList = [] } = usePartners();

  const partnerSuggestions = useMemo(() => {
    const isHp = (n: string) =>
      n
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .includes('hai phong travel');
    const names = partnerList.map((c) => c.name);
    return [...names.filter(isHp), ...names.filter((n) => !isHp(n))];
  }, [partnerList]);

  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const { data: activeStaff = [] } = useActiveStaff(isAdmin);
  const { data: unlistedPartners = [] } = useUnlistedPartners(isAdmin);

  const staffSelected = typeof filters.staffId === 'number';
  const { data: filterOptions } = useKpiFilterOptions(
    {
      ...rangeParams(range, basis),
      staffId: staffSelected ? (filters.staffId as number) : undefined,
    },
    !searching,
  );

  const staffOptions = useMemo(() => {
    if (!filterOptions) return activeStaff;
    const ids = new Set(filterOptions.staffIds);
    return activeStaff.filter((u) => ids.has(u.id));
  }, [activeStaff, filterOptions]);

  const routeFilterOptions = useMemo(() => {
    if (!filterOptions) return activeRoutes;
    const ids = new Set(filterOptions.routeIds);
    return activeRoutes.filter((r) => ids.has(r.id));
  }, [filterOptions, activeRoutes]);

  const partnerFilterOptions = useMemo(() => {
    if (!filterOptions) return partnerList;
    const names = new Set(filterOptions.partners.map((n) => n.toLowerCase()));
    return partnerList.filter((p) => names.has(p.name.trim().toLowerCase()));
  }, [filterOptions, partnerList]);

  useEffect(() => {
    if (!filterOptions) return;
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      const validStaff = new Set(filterOptions.staffIds);
      const validRoutes = new Set(filterOptions.routeIds);
      const validPartners = new Set(filterOptions.partners.map((n) => n.toLowerCase()));

      if (typeof prev.staffId === 'number' && !validStaff.has(prev.staffId)) {
        next.staffId = ALL;
        next.routeIds = [];
        next.partner = undefined;
        next.partners = [];
        changed = true;
      }

      if (prev.staffIds?.length) {
        const keep = prev.staffIds.filter((id) => validStaff.has(id));
        if (keep.length !== prev.staffIds.length) {
          next.staffIds = keep;
          changed = true;
        }
      }

      const keepRoutes = (prev.routeIds ?? []).filter((id) => validRoutes.has(id));
      if (keepRoutes.length !== (prev.routeIds ?? []).length) {
        next.routeIds = keepRoutes;
        changed = true;
      }

      if (
        prev.partner &&
        !validPartners.has(prev.partner.trim().toLowerCase()) &&
        prev.partner.toLowerCase() !== 'xvip'
      ) {
        next.partner = undefined;
        changed = true;
      }

      if (prev.partners?.length) {
        const keep = prev.partners.filter(
          (p) => validPartners.has(p.trim().toLowerCase()) || p.toLowerCase() === 'xvip',
        );
        if (keep.length !== prev.partners.length) {
          next.partners = keep;
          changed = true;
        }
      }

      return changed ? { ...next, page: 1 } : prev;
    });
  }, [filterOptions]);

  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const deleteMutation = useDeleteOrder();
  const cancelMutation = useCancelOrder();
  const importMutation = useImportOrders();
  const exportMutation = useExportOrders();
  const rollbackMutation = useRollbackImport();

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isOpenFormModal, setIsOpenFormModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [rebookOrder, setRebookOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [historyOrderId, setHistoryOrderId] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const showToast = useToast();

  const handleOpenCreate = () => {
    setEditingOrder(null);
    setRebookOrder(null);
    setIsOpenFormModal(true);
  };

  const handleOpenEdit = (o: Order) => {
    setRebookOrder(null);
    setEditingOrder(o);
    setIsOpenFormModal(true);
  };

  const handleOpenRebook = (o: Order) => {
    setEditingOrder(null);
    setRebookOrder(o);
    setIsOpenFormModal(true);
  };

  const handleSaveOrder = async ({
    data,
    editingId,
    autoSend,
  }: {
    data: CreateOrderInput;
    editingId?: number;
    autoSend: Record<MessageChannel, boolean>;
  }) => {
    try {
      let savedOrder: Order;
      if (editingId) {
        savedOrder = await updateMutation.mutateAsync({ id: editingId, input: data });
        showToast('Cập nhật vé thành công.');
      } else {
        savedOrder = await createMutation.mutateAsync(data);
        showToast('Tạo vé mới thành công.');
      }

      const channelsToSend = (['ZALO', 'SMS'] as MessageChannel[]).filter((c) => autoSend[c]);
      for (const ch of channelsToSend) {
        try {
          await ordersApi.sendMessage(savedOrder.id, ch);
          showToast(`Đã gửi ${ch === 'ZALO' ? 'Zalo' : 'SMS'} cho khách.`);
        } catch (err) {
          showToast(`Lỗi khi gửi ${ch}: ${err instanceof Error ? err.message : 'thất bại'}`, 'error');
        }
      }

      setIsOpenFormModal(false);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi lưu vé.', 'error');
    }
  };

  const handleConfirmCancel = async (orderId: number, reason: string) => {
    try {
      await cancelMutation.mutateAsync({ id: orderId, reason });
      showToast('Đã hủy vé.');
      setCancelTarget(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể hủy vé.', 'error');
    }
  };

  const handleConfirmDelete = async (orderId: number) => {
    try {
      await deleteMutation.mutateAsync(orderId);
      showToast('Đã xóa vé.');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa vé.', 'error');
    }
  };

  const handleRollbackImport = async (ids: number[]) => {
    try {
      const res = await rollbackMutation.mutateAsync(ids);
      setImportResult(null);
      showToast(
        res.skipped > 0
          ? `Đã xóa ${res.deleted} đơn vừa nhập, giữ lại ${res.skipped} đơn đã bị sửa.`
          : `Đã xóa ${res.deleted} đơn vừa nhập.`,
      );
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể hoàn tác lần nhập.', 'error');
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportMutation.mutateAsync(filters);
      showToast('Đã xuất file Excel.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi xuất Excel.', 'error');
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const res = await importMutation.mutateAsync(file);
      setImportResult(res);
      showToast(`Đã nhập xong: ${res.created} đơn thành công.`);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi nhập Excel.', 'error');
    }
  };

  const ordersList: Order[] = ordersData?.data ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const currentPage = filters.page;
  const pageSize = filters.pageSize ?? ORDERS_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(totalOrders / pageSize));

  useEffect(() => {
    if (ordersData && currentPage > lastPage) {
      setFilters((prev) => ({ ...prev, page: lastPage }));
    }
  }, [ordersData, currentPage, lastPage]);

  return (
    <>
      <OrdersToolbar
        isAdmin={isAdmin}
        unlistedPartners={unlistedPartners}
        onOpenCreate={handleOpenCreate}
        onExportExcel={handleExportExcel}
        onImportFile={handleImportFile}
        isImporting={importMutation.isPending}
        onSearchPartner={(partner) => setFilters((p) => ({ ...p, search: partner, page: 1 }))}
      />

      <OrdersFiltersBar
        filters={filters}
        localFilters={localFilters}
        searching={searching}
        basis={basis}
        rangeLabel={rangeLabel}
        activeStaff={activeStaff}
        staffOptions={staffOptions}
        routeFilterOptions={routeFilterOptions}
        partnerFilterOptions={partnerFilterOptions}
        activeRoutes={activeRoutes}
        isAdmin={isAdmin}
        onUpdateFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }))}
        onResetColumnFilters={() =>
          setFilters((p) => ({
            ...p,
            orderCode: undefined,
            departureTimes: undefined,
            partner: undefined,
            partners: [],
            routeIds: [],
            customerNames: undefined,
            phones: undefined,
            deposits: undefined,
            sellPrices: undefined,
            sellPriceMin: undefined,
            sellPriceMax: undefined,
            commissions: undefined,
            commissionMin: undefined,
            commissionMax: undefined,
            staffId: ALL,
            staffIds: [],
            smsStatus: undefined,
            messageStates: undefined,
            page: 1,
          }))
        }
      />

      <OrdersTableView
        ordersList={ordersList}
        totalOrders={totalOrders}
        currentPage={currentPage}
        pageSize={pageSize}
        isLoading={isLoading}
        isAdmin={isAdmin}
        localFilters={localFilters}
        filters={filters}
        onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }))}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onSelectOrder={(order) => setDetailOrder(order)}
        onOpenCreate={handleOpenCreate}
      />

      <OrderFormModal
        isOpen={isOpenFormModal}
        onClose={() => setIsOpenFormModal(false)}
        editingOrder={editingOrder}
        rebookOrder={rebookOrder}
        activeRoutes={activeRoutes}
        activeStaff={activeStaff}
        partnerSuggestions={partnerSuggestions}
        isAdmin={isAdmin}
        onSave={handleSaveOrder}
        showToast={showToast}
      />

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onEdit={(o) => {
            setDetailOrder(null);
            handleOpenEdit(o);
          }}
          onRebook={(o) => {
            setDetailOrder(null);
            handleOpenRebook(o);
          }}
          onHistory={(o) => {
            setDetailOrder(null);
            setHistoryOrderId(o.id);
          }}
          onCancel={(o) => {
            setDetailOrder(null);
            setCancelTarget(o);
          }}
          onDelete={
            isAdmin
              ? (o) => {
                  setDetailOrder(null);
                  setDeleteTarget(o);
                }
              : undefined
          }
        />
      )}

      {historyOrderId !== null && (
        <OrderHistoryModal
          orderId={historyOrderId}
          onClose={() => setHistoryOrderId(null)}
        />
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
          isSubmitting={cancelMutation.isPending}
        />
      )}

      {deleteTarget && (
        <DeleteOrderModal
          order={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          isSubmitting={deleteMutation.isPending}
        />
      )}

      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
          onRollback={handleRollbackImport}
          isRollingBack={rollbackMutation.isPending}
        />
      )}
    </>
  );
}
