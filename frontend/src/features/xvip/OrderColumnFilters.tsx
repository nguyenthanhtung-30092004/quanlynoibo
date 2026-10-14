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
  selected: string[];
  onApply: (staffIds: string[]) => void;
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
    <CheckListFilter<string>
      items={options.map((o) => ({ value: o.value, label: o.label, count: o.count }))}
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
  return (
    <ThFilter title="Nhà xe">
      <ColumnFilterPopover
        title="Nhà xe"
        isActive={!!local.partner}
        onClear={() => onChange({ partner: undefined })}
      >
        {({ close }) => (
          <PartnerFilterInner
            filters={filters}
            selected={local.partner ? [local.partner] : []}
            onApply={(partners) => onChange({ partner: partners[0] || undefined })}
            onClear={() => onChange({ partner: undefined })}
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

export function ThSellPrice({ local, onChange }: OrderThProps) {
  return (
    <ThFilter title="Giá bán" right>
      <ColumnFilterPopover
        title="Giá bán"
        align="right"
        isActive={local.sellPriceMin !== undefined || local.sellPriceMax !== undefined}
        onClear={() => onChange({ sellPriceMin: undefined, sellPriceMax: undefined })}
      >
        {({ close }) => (
          <NumberRangeFilter
            min={local.sellPriceMin}
            max={local.sellPriceMax}
            onApply={(range) => onChange({ sellPriceMin: range.min, sellPriceMax: range.max })}
            onClear={() => onChange({ sellPriceMin: undefined, sellPriceMax: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}

export function ThCommission({ local, onChange }: OrderThProps) {
  return (
    <ThFilter title="Hoa hồng" right>
      <ColumnFilterPopover
        title="Hoa hồng"
        align="right"
        isActive={local.commissionMin !== undefined || local.commissionMax !== undefined}
        onClear={() => onChange({ commissionMin: undefined, commissionMax: undefined })}
      >
        {({ close }) => (
          <NumberRangeFilter
            min={local.commissionMin}
            max={local.commissionMax}
            onApply={(range) =>
              onChange({ commissionMin: range.min, commissionMax: range.max })
            }
            onClear={() => onChange({ commissionMin: undefined, commissionMax: undefined })}
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
  const staffId = typeof local.staffId === 'number' ? local.staffId : undefined;
  return (
    <ThFilter title="NV tạo">
      {showFilter && (
        <ColumnFilterPopover
          title="Nhân viên tạo"
          isActive={staffId !== undefined}
          onClear={() => onChange({ staffId: 'all' })}
        >
          {({ close }) => (
            <StaffFilterInner
              filters={filters}
              selected={staffId !== undefined ? [String(staffId)] : []}
              onApply={(ids) => onChange({ staffId: ids.length ? Number(ids[0]) : 'all' })}
              onClear={() => onChange({ staffId: 'all' })}
              close={close}
            />
          )}
        </ColumnFilterPopover>
      )}
    </ThFilter>
  );
}

export function ThSms({ local, onChange }: OrderThProps) {
  return (
    <ThFilter title="Tin nhắn">
      <ColumnFilterPopover
        title="Tin nhắn"
        isActive={!!local.smsStatus}
        onClear={() => onChange({ smsStatus: undefined })}
      >
        {({ close }) => (
          <CheckListFilter<'sent' | 'unsent'>
            items={[
              { value: 'sent', label: 'Đã gửi' },
              { value: 'unsent', label: 'Chưa gửi' },
            ]}
            selected={local.smsStatus ? [local.smsStatus] : []}
            onApply={(selected) =>
              onChange({ smsStatus: selected.length === 1 ? selected[0] : undefined })
            }
            onClear={() => onChange({ smsStatus: undefined })}
            close={close}
          />
        )}
      </ColumnFilterPopover>
    </ThFilter>
  );
}
