'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColumnValues } from '@/features/orders/hooks';
import type { OrderFilters } from '@/features/orders/types';
import {
  ColumnFilterPopover,
  CheckListFilter,
  NumberRangeFilter,
  TextInputFilter,
} from '@/features/xvip/ColumnFilter';
import { TH } from '@/features/xvip/ui';

/** Hook hỗ trợ debounce từ khóa tìm kiếm */
function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Bộ lọc Giờ xe */
function DepartureTimeFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: string[];
  onApply: (times: string[]) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, departureTimes: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'departureTime',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <CheckListFilter<string>
      items={options.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm giờ xe..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

/** Bộ lọc Nhà xe / Đối tác */
function PartnerFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: string[];
  onApply: (partners: string[]) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, partner: undefined, partners: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'partner',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <CheckListFilter<string>
      items={options.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm nhà xe..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

/** Bộ lọc Tuyến đường */
function RouteFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: number[];
  onApply: (routeIds: number[]) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, routeId: 'all', routeIds: [] }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'route',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <CheckListFilter<number>
      items={options.map((o) => ({ value: Number(o.value), label: o.label, count: o.count }))}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm tuyến đường..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

/** Bộ lọc Khách hàng (hiện cả Tên · SĐT hoặc Tên & SĐT riêng) */
function CustomerFilterInner({
  filters,
  selectedNames,
  selectedPhones,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selectedNames: string[];
  selectedPhones: string[];
  onApply: (data: { names: string[]; phones: string[] }) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [tab, setTab] = useState<'name' | 'phone'>('name');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, customerNames: undefined, phones: undefined }),
    [filters],
  );

  const { data: nameOptions = [], isLoading: loadingNames } = useColumnValues(
    'customer',
    columnFilterBase,
    tab === 'name' ? debouncedSearch : undefined,
  );

  const { data: phoneOptions = [], isLoading: loadingPhones } = useColumnValues(
    'phone',
    columnFilterBase,
    tab === 'phone' ? debouncedSearch : undefined,
  );

  const [localNames, setLocalNames] = useState<string[]>(selectedNames);
  const [localPhones, setLocalPhones] = useState<string[]>(selectedPhones);

  useEffect(() => {
    setLocalNames(selectedNames);
    setLocalPhones(selectedPhones);
  }, [selectedNames, selectedPhones]);

  return (
    <div className="space-y-2.5">
      <div className="flex rounded border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            setTab('name');
            setSearch('');
          }}
          className={`flex-1 py-1 rounded transition-colors ${
            tab === 'name'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          Tên khách ({localNames.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('phone');
            setSearch('');
          }}
          className={`flex-1 py-1 rounded transition-colors ${
            tab === 'phone'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          Số điện thoại ({localPhones.length})
        </button>
      </div>

      {tab === 'name' ? (
        <CheckListFilter<string>
          items={nameOptions.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
          selected={localNames}
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm tên khách..."
          isLoading={loadingNames}
          onApply={(names) => {
            setLocalNames(names);
            onApply({ names, phones: localPhones });
          }}
          onClear={() => {
            setLocalNames([]);
            if (localPhones.length === 0) {
              onClear();
            } else {
              onApply({ names: [], phones: localPhones });
            }
          }}
          close={close}
        />
      ) : (
        <CheckListFilter<string>
          items={phoneOptions.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
          selected={localPhones}
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm số điện thoại..."
          isLoading={loadingPhones}
          onApply={(phones) => {
            setLocalPhones(phones);
            onApply({ names: localNames, phones });
          }}
          onClear={() => {
            setLocalPhones([]);
            if (localNames.length === 0) {
              onClear();
            } else {
              onApply({ names: localNames, phones: [] });
            }
          }}
          close={close}
        />
      )}
    </div>
  );
}

/** Bộ lọc Nhân viên tạo (chỉ Admin) */
function StaffFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: number[];
  onApply: (staffIds: number[]) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, staffId: 'all', staffIds: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'staff',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <CheckListFilter<number>
      items={options.map((o) => ({ value: Number(o.value), label: o.label, count: o.count }))}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm nhân viên..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

/**
 * Ô tiêu đề cột kèm biểu tượng lọc, dùng chung cho các bảng đơn (Quản lý vé, Báo cáo).
 * `local`: giá trị bộ lọc cột đang chọn, `filters`: bộ lọc đầy đủ dùng để lấy danh sách giá trị,
 * `onChange`: gộp bộ lọc mới (bên gọi tự đưa về trang 1).
 */
export interface OrderThProps {
  local: OrderFilters;
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
}

function ThFilter({
  title,
  right,
  children,
}: {
  title: string;
  right?: boolean;
  children?: ReactNode;
}) {
  return (
    <th className={`${TH}${right ? ' text-right' : ''}`}>
      <div className={`inline-flex items-center${right ? ' justify-end w-full' : ''}`}>
        <span>{title}</span>
        {children}
      </div>
    </th>
  );
}

export function ThOrderCode({ local, onChange }: OrderThProps) {
  return (
    <ThFilter title="Mã đơn">
      <ColumnFilterPopover
        title="Mã đơn"
        isActive={!!local.orderCode?.trim()}
        onClear={() => onChange({ orderCode: undefined })}
      >
        {({ close }) => (
          <TextInputFilter
            value={local.orderCode}
            placeholder="Mã đơn (XV116 hoặc 116)"
            onApply={(code) => onChange({ orderCode: code })}
            onClear={() => onChange({ orderCode: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

export function ThDepartureTime({ local, filters, onChange }: OrderThProps) {
  return (
    <ThFilter title="Giờ xe">
      <ColumnFilterPopover
        title="Giờ xe"
        isActive={!!local.departureTimes?.length}
        onClear={() => onChange({ departureTimes: undefined })}
      >
        {({ close }) => (
          <DepartureTimeFilterInner
            filters={filters}
            selected={local.departureTimes ?? []}
            onApply={(times) => onChange({ departureTimes: times.length ? times : undefined })}
            onClear={() => onChange({ departureTimes: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

export function ThPartner({ local, filters, onChange }: OrderThProps) {
  const selectedPartners = useMemo(() => {
    const list = [...(local.partners ?? [])];
    if (local.partner && !list.includes(local.partner)) {
      list.push(local.partner);
    }
    return list;
  }, [local.partners, local.partner]);

  return (
    <ThFilter title="Nhà xe">
      <ColumnFilterPopover
        title="Nhà xe"
        isActive={selectedPartners.length > 0}
        onClear={() => onChange({ partner: undefined, partners: [] })}
      >
        {({ close }) => (
          <PartnerFilterInner
            filters={filters}
            selected={selectedPartners}
            onApply={(partners) =>
              onChange({
                partners,
                partner: partners.length === 1 ? partners[0] : undefined,
              })
            }
            onClear={() => onChange({ partner: undefined, partners: [] })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

export function ThRoute({ local, filters, onChange }: OrderThProps) {
  return (
    <ThFilter title="Tuyến đường">
      <ColumnFilterPopover
        title="Tuyến đường"
        isActive={(local.routeIds ?? []).length > 0}
        onClear={() => onChange({ routeIds: [] })}
      >
        {({ close }) => (
          <RouteFilterInner
            filters={filters}
            selected={local.routeIds ?? []}
            onApply={(routeIds) => onChange({ routeIds })}
            onClear={() => onChange({ routeIds: [] })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

/** Dùng cho cả cột Khách hàng và Số điện thoại (chung một hộp lọc) */
export function ThCustomer({
  title,
  local,
  filters,
  onChange,
}: OrderThProps & { title: string }) {
  return (
    <ThFilter title={title}>
      <ColumnFilterPopover
        title="Khách hàng / SĐT"
        isActive={!!local.customerNames?.length || !!local.phones?.length}
        onClear={() => onChange({ customerNames: undefined, phones: undefined })}
      >
        {({ close }) => (
          <CustomerFilterInner
            filters={filters}
            selectedNames={local.customerNames ?? []}
            selectedPhones={local.phones ?? []}
            onApply={({ names, phones }) =>
              onChange({
                customerNames: names.length ? names : undefined,
                phones: phones.length ? phones : undefined,
              })
            }
            onClear={() => onChange({ customerNames: undefined, phones: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

/** Bộ lọc Giá bán */
function SellPriceFilterInner({
  filters,
  selected,
  min,
  max,
  onApplyTicks,
  onClearTicks,
  onApplyRange,
  onClearRange,
  close,
}: {
  filters: OrderFilters;
  selected: number[];
  min?: number;
  max?: number;
  onApplyTicks: (prices: number[]) => void;
  onClearTicks: () => void;
  onApplyRange: (range: { min?: number; max?: number }) => void;
  onClearRange: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, sellPrices: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'sellPrice',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <div className="space-y-3">
      <CheckListFilter<number>
        items={options.map((o) => ({ value: Number(o.value), label: o.label, count: o.count }))}
        selected={selected}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm giá bán..."
        isLoading={isLoading}
        onApply={onApplyTicks}
        onClear={onClearTicks}
        close={close}
      />
      <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5">
        <div className="mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Hoặc theo khoảng (Từ - Đến):
        </div>
        <NumberRangeFilter
          min={min}
          max={max}
          onApply={onApplyRange}
          onClear={onClearRange}
          close={close}
        />
      </div>
    </div>
  );
}

export function ThSellPrice({ local, filters, onChange }: OrderThProps) {
  const isTicksActive = (local.sellPrices ?? []).length > 0;
  const isRangeActive = local.sellPriceMin !== undefined || local.sellPriceMax !== undefined;
  return (
    <ThFilter title="Giá bán" right>
      <ColumnFilterPopover
        title="Giá bán"
        align="right"
        isActive={isTicksActive || isRangeActive}
        onClear={() => onChange({ sellPrices: undefined, sellPriceMin: undefined, sellPriceMax: undefined })}
      >
        {({ close }) => (
          <SellPriceFilterInner
            filters={filters}
            selected={local.sellPrices ?? []}
            min={local.sellPriceMin}
            max={local.sellPriceMax}
            onApplyTicks={(prices) => onChange({ sellPrices: prices.length ? prices : undefined })}
            onClearTicks={() => onChange({ sellPrices: undefined })}
            onApplyRange={(range) => onChange({ sellPriceMin: range.min, sellPriceMax: range.max })}
            onClearRange={() => onChange({ sellPriceMin: undefined, sellPriceMax: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

/** Bộ lọc Hoa hồng */
function CommissionFilterInner({
  filters,
  selected,
  min,
  max,
  onApplyTicks,
  onClearTicks,
  onApplyRange,
  onClearRange,
  close,
}: {
  filters: OrderFilters;
  selected: number[];
  min?: number;
  max?: number;
  onApplyTicks: (commissions: number[]) => void;
  onClearTicks: () => void;
  onApplyRange: (range: { min?: number; max?: number }) => void;
  onClearRange: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, commissions: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'commission',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <div className="space-y-3">
      <CheckListFilter<number>
        items={options.map((o) => ({ value: Number(o.value), label: o.label, count: o.count }))}
        selected={selected}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm mức hoa hồng..."
        isLoading={isLoading}
        onApply={onApplyTicks}
        onClear={onClearTicks}
        close={close}
      />
      <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5">
        <div className="mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          Hoặc theo khoảng (Từ - Đến):
        </div>
        <NumberRangeFilter
          min={min}
          max={max}
          onApply={onApplyRange}
          onClear={onClearRange}
          close={close}
        />
      </div>
    </div>
  );
}

export function ThCommission({ local, filters, onChange }: OrderThProps) {
  const isTicksActive = (local.commissions ?? []).length > 0;
  const isRangeActive = local.commissionMin !== undefined || local.commissionMax !== undefined;
  return (
    <ThFilter title="Hoa hồng" right>
      <ColumnFilterPopover
        title="Hoa hồng"
        align="right"
        isActive={isTicksActive || isRangeActive}
        onClear={() => onChange({ commissions: undefined, commissionMin: undefined, commissionMax: undefined })}
      >
        {({ close }) => (
          <CommissionFilterInner
            filters={filters}
            selected={local.commissions ?? []}
            min={local.commissionMin}
            max={local.commissionMax}
            onApplyTicks={(commissions) => onChange({ commissions: commissions.length ? commissions : undefined })}
            onClearTicks={() => onChange({ commissions: undefined })}
            onApplyRange={(range) => onChange({ commissionMin: range.min, commissionMax: range.max })}
            onClearRange={() => onChange({ commissionMin: undefined, commissionMax: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

/** Bộ lọc Đã cọc */
function DepositFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: number[];
  onApply: (deposits: number[]) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, deposits: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'deposit',
    columnFilterBase,
    debouncedSearch,
  );

  return (
    <CheckListFilter<number>
      items={options.map((o) => ({ value: Number(o.value), label: o.label, count: o.count }))}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm mức cọc..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

/** Cột Đã cọc: danh sách mức cọc (mức 0 hiện là "Chưa cọc") */
export function ThDeposit({ local, filters, onChange }: OrderThProps) {
  return (
    <ThFilter title="Đã cọc" right>
      <ColumnFilterPopover
        title="Đã cọc"
        align="right"
        isActive={(local.deposits ?? []).length > 0}
        onClear={() => onChange({ deposits: undefined })}
      >
        {({ close }) => (
          <DepositFilterInner
            filters={filters}
            selected={local.deposits ?? []}
            onApply={(deposits) => onChange({ deposits: deposits.length ? deposits : undefined })}
            onClear={() => onChange({ deposits: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

/** Cột NV tạo: chỉ Admin có biểu tượng lọc */
export function ThStaff({
  local,
  filters,
  onChange,
  showFilter,
}: OrderThProps & { showFilter: boolean }) {
  const selectedStaffIds = useMemo(() => {
    const list = [...(local.staffIds ?? [])];
    if (typeof local.staffId === 'number' && local.staffId > 0 && !list.includes(local.staffId)) {
      list.push(local.staffId);
    }
    return list;
  }, [local.staffIds, local.staffId]);

  return (
    <ThFilter title="NV tạo">
      {showFilter && (
        <ColumnFilterPopover
          title="Nhân viên tạo"
          isActive={selectedStaffIds.length > 0}
          onClear={() => onChange({ staffId: 'all', staffIds: [] })}
        >
          {({ close }) => (
            <StaffFilterInner
              filters={filters}
              selected={selectedStaffIds}
              onApply={(ids) =>
                onChange({
                  staffIds: ids,
                  staffId: ids.length === 1 ? ids[0] : 'all',
                })
              }
              onClear={() => onChange({ staffId: 'all', staffIds: [] })}
              close={close}
            />
          )}
        </ColumnFilterPopover>
      )}
    </ThFilter>
  );
}

/** Bộ lọc Tin nhắn */
function SmsFilterInner({
  filters,
  selected,
  onApply,
  onClear,
  close,
}: {
  filters: OrderFilters;
  selected: Array<'sms' | 'zalo' | 'unsent'>;
  onApply: (selected: Array<'sms' | 'zalo' | 'unsent'>) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const columnFilterBase = useMemo<OrderFilters>(
    () => ({ ...filters, smsStatus: undefined, messageStates: undefined }),
    [filters],
  );

  const { data: options = [], isLoading } = useColumnValues(
    'message',
    columnFilterBase,
    debouncedSearch,
  );

  const items = useMemo(() => {
    const fallback: Record<'sms' | 'zalo' | 'unsent', { label: string; count: number }> = {
      sms: { label: 'Đã gửi SMS', count: 0 },
      zalo: { label: 'Đã gửi Zalo', count: 0 },
      unsent: { label: 'Chưa gửi', count: 0 },
    };
    for (const d of options) {
      if (d.value in fallback) {
        fallback[d.value as 'sms' | 'zalo' | 'unsent'] = { label: d.label, count: d.count };
      }
    }
    const list: Array<{ value: 'sms' | 'zalo' | 'unsent'; label: string; count: number }> = [
      { value: 'sms', label: fallback.sms.label, count: fallback.sms.count },
      { value: 'zalo', label: fallback.zalo.label, count: fallback.zalo.count },
      { value: 'unsent', label: fallback.unsent.label, count: fallback.unsent.count },
    ];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      return list.filter(
        (it) => it.label.toLowerCase().includes(q) || it.value.toLowerCase().includes(q),
      );
    }
    return list;
  }, [options, debouncedSearch]);

  return (
    <CheckListFilter<'sms' | 'zalo' | 'unsent'>
      items={items}
      selected={selected}
      searchQuery={search}
      onSearchChange={setSearch}
      searchPlaceholder="Tìm trạng thái..."
      isLoading={isLoading}
      onApply={onApply}
      onClear={onClear}
      close={close}
    />
  );
}

export function ThSms({ local, filters, onChange }: OrderThProps) {
  const selectedStates = useMemo(() => {
    if (local.messageStates?.length) return local.messageStates;
    if (local.smsStatus === 'sent') return ['sms', 'zalo'] as Array<'sms' | 'zalo' | 'unsent'>;
    if (local.smsStatus === 'unsent') return ['unsent'] as Array<'sms' | 'zalo' | 'unsent'>;
    return [] as Array<'sms' | 'zalo' | 'unsent'>;
  }, [local.messageStates, local.smsStatus]);

  const isActive = selectedStates.length > 0;

  return (
    <ThFilter title="Tin nhắn">
      <ColumnFilterPopover
        title="Tin nhắn"
        isActive={isActive}
        onClear={() => onChange({ messageStates: [], smsStatus: undefined })}
      >
        {({ close }) => (
          <SmsFilterInner
            filters={filters ?? local}
            selected={selectedStates}
            onApply={(states) =>
              onChange({
                messageStates: states.length > 0 ? states : [],
                smsStatus: undefined,
              })
            }
            onClear={() => onChange({ messageStates: [], smsStatus: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

