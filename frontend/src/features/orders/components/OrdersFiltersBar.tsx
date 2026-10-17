'use client';

import {
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import { Card } from '@/features/xvip/ui';
import { money } from '@/features/xvip/data';
import { MultiCheckSelect } from '@/features/xvip/MultiCheckSelect';
import { OptionFilterInput } from '@/features/xvip/OptionFilterInput';
import {
  BASIS_LABEL,
  DateRangeFilter,
  type DateBasis,
} from '@/features/xvip/date-filter';
import type { Route } from '@/features/routes/types';
import type { Partner } from '@/features/partners/types';
import type { User } from '@/features/users/types';
import type { OrderFilters } from '../types';

const ALL = 'all';

interface OrdersFiltersBarProps {
  filters: OrderFilters;
  localFilters: OrderFilters;
  searching: boolean;
  basis: DateBasis;
  rangeLabel: string;
  activeStaff: User[];
  staffOptions: User[];
  routeFilterOptions: Route[];
  partnerFilterOptions: Partner[];
  activeRoutes: Route[];
  isAdmin: boolean;
  onUpdateFilters: (patch: Partial<OrderFilters>) => void;
  onResetColumnFilters: () => void;
}

export function OrdersFiltersBar({
  filters,
  localFilters,
  searching,
  basis,
  rangeLabel,
  activeStaff,
  staffOptions,
  routeFilterOptions,
  partnerFilterOptions,
  activeRoutes,
  isAdmin,
  onUpdateFilters,
  onResetColumnFilters,
}: OrdersFiltersBarProps) {
  // Thanh chip bộ lọc cột đang bật
  const renderChips = () => {
    if (searching) {
      return (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Đang tìm kiếm: bộ lọc cột tạm không áp dụng.
        </div>
      );
    }

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (localFilters.orderCode?.trim()) {
      chips.push({
        key: 'orderCode',
        label: `Mã đơn: ${localFilters.orderCode}`,
        onRemove: () => onUpdateFilters({ orderCode: undefined }),
      });
    }
    if (localFilters.departureTimes?.length) {
      chips.push({
        key: 'departureTimes',
        label: `Giờ xe: ${localFilters.departureTimes.join(', ')}`,
        onRemove: () => onUpdateFilters({ departureTimes: undefined }),
      });
    }
    const effectivePartners = localFilters.partners?.length
      ? localFilters.partners
      : localFilters.partner
        ? [localFilters.partner]
        : [];
    if (effectivePartners.length > 0) {
      chips.push({
        key: 'partners',
        label: `Nhà xe: ${effectivePartners.join(', ')}`,
        onRemove: () => onUpdateFilters({ partner: undefined, partners: [] }),
      });
    }
    if (localFilters.routeIds?.length) {
      const names = localFilters.routeIds
        .map((id) => activeRoutes.find((r) => r.id === id)?.name || `#${id}`)
        .join(', ');
      chips.push({
        key: 'routeIds',
        label: `Tuyến: ${names}`,
        onRemove: () => onUpdateFilters({ routeIds: [] }),
      });
    }
    if (localFilters.customerNames?.length) {
      chips.push({
        key: 'customerNames',
        label: `Khách: ${localFilters.customerNames.join(', ')}`,
        onRemove: () => onUpdateFilters({ customerNames: undefined }),
      });
    }
    if (localFilters.phones?.length) {
      chips.push({
        key: 'phones',
        label: `SĐT: ${localFilters.phones.join(', ')}`,
        onRemove: () => onUpdateFilters({ phones: undefined }),
      });
    }
    if (localFilters.deposits?.length) {
      const labels = localFilters.deposits.map((d) => `${money(d)}đ`).join(', ');
      chips.push({
        key: 'deposits',
        label: `Đã cọc: ${labels}`,
        onRemove: () => onUpdateFilters({ deposits: undefined }),
      });
    }
    if (localFilters.sellPrices?.length) {
      chips.push({
        key: 'sellPrices',
        label: `Giá bán: ${localFilters.sellPrices.map((p) => `${money(p)}đ`).join(', ')}`,
        onRemove: () => onUpdateFilters({ sellPrices: undefined }),
      });
    }
    if (localFilters.sellPriceMin !== undefined || localFilters.sellPriceMax !== undefined) {
      const minText = localFilters.sellPriceMin ? `${money(localFilters.sellPriceMin)}đ` : '0đ';
      const maxText = localFilters.sellPriceMax ? `${money(localFilters.sellPriceMax)}đ` : '∞';
      chips.push({
        key: 'sellPrice',
        label: `Giá bán (khoảng): ${minText} - ${maxText}`,
        onRemove: () => onUpdateFilters({ sellPriceMin: undefined, sellPriceMax: undefined }),
      });
    }
    if (localFilters.commissions?.length) {
      chips.push({
        key: 'commissions',
        label: `Hoa hồng: ${localFilters.commissions.map((c) => `${money(c)}đ`).join(', ')}`,
        onRemove: () => onUpdateFilters({ commissions: undefined }),
      });
    }
    if (localFilters.commissionMin !== undefined || localFilters.commissionMax !== undefined) {
      const minText = localFilters.commissionMin ? `${money(localFilters.commissionMin)}đ` : '0đ';
      const maxText = localFilters.commissionMax ? `${money(localFilters.commissionMax)}đ` : '∞';
      chips.push({
        key: 'commission',
        label: `Hoa hồng (khoảng): ${minText} - ${maxText}`,
        onRemove: () => onUpdateFilters({ commissionMin: undefined, commissionMax: undefined }),
      });
    }
    const effectiveStaffIds = localFilters.staffIds?.length
      ? localFilters.staffIds
      : typeof localFilters.staffId === 'number'
        ? [localFilters.staffId]
        : [];
    if (isAdmin && effectiveStaffIds.length > 0) {
      const names = effectiveStaffIds
        .map((id) => activeStaff.find((s) => s.id === id)?.fullName || `#${id}`)
        .join(', ');
      chips.push({
        key: 'staffIds',
        label: `NV: ${names}`,
        onRemove: () => onUpdateFilters({ staffId: ALL, staffIds: [] }),
      });
    }
    const effectiveMessageStates = localFilters.messageStates?.length
      ? localFilters.messageStates
      : localFilters.smsStatus === 'sent'
        ? ['sms', 'zalo']
        : localFilters.smsStatus === 'unsent'
          ? ['unsent']
          : [];
    if (effectiveMessageStates.length > 0) {
      const labelMap: Record<string, string> = {
        sms: 'Đã gửi SMS',
        zalo: 'Đã gửi Zalo',
        unsent: 'Chưa gửi',
      };
      const names = effectiveMessageStates.map((s) => labelMap[s] || s).join(', ');
      chips.push({
        key: 'messageStates',
        label: `Tin nhắn: ${names}`,
        onRemove: () => onUpdateFilters({ messageStates: undefined, smsStatus: undefined }),
      });
    }

    if (chips.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Bộ lọc đang bật:
        </span>
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
          >
            <span>{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              title="Gỡ bộ lọc này"
              className="rounded-full p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-800/60"
            >
              <X size={11} weight="bold" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={onResetColumnFilters}
          className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400 ml-1"
        >
          Xóa tất cả bộ lọc cột
        </button>
      </div>
    );
  };

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3.5">
        <label className="block min-w-64 flex-[1.6]">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Tìm kiếm nhanh
          </span>
          <span className="relative block">
            <MagnifyingGlass
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="input-3d pl-9"
              value={filters.search}
              onChange={(e) => onUpdateFilters({ search: e.target.value })}
              placeholder="Số điện thoại hoặc mã đơn (XV116)..."
            />
          </span>
        </label>

        <div className="block min-w-60 flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Thời gian
          </span>
          <DateRangeFilter align="right" />
        </div>

        {activeStaff.length > 0 && (
          <label className="block min-w-44 flex-1">
            <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nhân viên
            </span>
            <OptionFilterInput
              options={staffOptions.map((s) => ({ value: String(s.id), label: s.fullName }))}
              value={
                filters.staffIds?.length === 1
                  ? String(filters.staffIds[0])
                  : filters.staffId === ALL
                    ? ''
                    : String(filters.staffId)
              }
              customLabel={
                filters.staffIds && filters.staffIds.length > 1
                  ? `${filters.staffIds.length} đã chọn`
                  : undefined
              }
              allLabel="Tất cả nhân viên"
              onChange={(v) =>
                onUpdateFilters({
                  staffId: v === '' ? ALL : Number(v),
                  staffIds: v === '' ? [] : [Number(v)],
                  routeIds: [],
                  partner: undefined,
                  partners: [],
                })
              }
            />
          </label>
        )}

        <div className="block min-w-48 sm:min-w-56 flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Tuyến đường
          </span>
          <MultiCheckSelect
            options={routeFilterOptions.map((r) => ({
              value: r.id,
              label: r.name,
            }))}
            value={filters.routeIds ?? []}
            onChange={(routeIds) => onUpdateFilters({ routeIds })}
            allLabel="Tất cả tuyến"
            searchPlaceholder="Tìm tuyến..."
          />
        </div>

        <label className="block min-w-44 flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
            Đối tác
          </span>
          <OptionFilterInput
            options={partnerFilterOptions.map((p) => ({ value: p.name, label: p.name }))}
            value={
              filters.partners?.length === 1
                ? filters.partners[0]
                : filters.partner ?? ''
            }
            customLabel={
              filters.partners && filters.partners.length > 1
                ? `${filters.partners.length} đã chọn`
                : undefined
            }
            allLabel="Tất cả đối tác"
            onChange={(v) =>
              onUpdateFilters({
                partner: v || undefined,
                partners: v ? [v] : [],
              })
            }
          />
        </label>
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {searching
          ? 'Đang tìm trong tất cả vé, không theo bộ lọc ngày, tuyến, đối tác, nhân viên. Xóa ô tìm kiếm để quay lại bộ lọc.'
          : `Đang lọc theo ${BASIS_LABEL[basis].toLowerCase()}: ${rangeLabel}.`}
      </p>

      {renderChips()}
    </Card>
  );
}
