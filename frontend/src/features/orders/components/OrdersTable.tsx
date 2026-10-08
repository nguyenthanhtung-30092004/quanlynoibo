'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, DatePicker, Dropdown, Empty, Input, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CheckCircle,
  DotsThreeVertical,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import { useActiveRoutes } from '@/features/routes/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import { ApiError } from '@/lib/api-client';
import { formatDateTimeShort, formatVND } from '@/lib/format';
import { getVnToday, isOrderingLocked } from '@/lib/time';
import { useUiStore } from '@/stores/ui-store';
import { ORDERS_PAGE_SIZE } from '../constants';
import { useDeleteOrder, useOrders } from '../hooks';
import { SEAT_ZONE_LABELS, type Order } from '../types';

const DATE_FORMAT = 'YYYY-MM-DD';

function useDebouncedSearch() {
  const search = useUiStore((s) => s.filters.search);
  const setFilters = useUiStore((s) => s.setFilters);
  const [input, setInput] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input !== search) setFilters({ search: input });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, search, setFilters]);

  return [input, setInput] as const;
}

/** Bộ lọc thanh công cụ 3D nằm ngay trên bảng */
function Toolbar({ isAdmin }: { isAdmin: boolean }) {
  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const [searchInput, setSearchInput] = useDebouncedSearch();
  const { data: staff = [] } = useActiveStaff(isAdmin);
  const { data: routes = [] } = useActiveRoutes();

  const today = dayjs(getVnToday());
  const range: [Dayjs, Dayjs] | null =
    filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null;

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface-2/40 p-4">
      <Input
        allowClear
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        prefix={<MagnifyingGlass size={16} className="text-ink-3" />}
        placeholder="Tìm tên khách, SĐT, tuyến, đối tác, ghi chú..."
        className="w-full sm:w-72 shadow-3d-sm"
        aria-label="Tìm đơn hàng"
      />

      <Select
        value={filters.routeId}
        onChange={(routeId) => setFilters({ routeId })}
        className="w-48 shadow-3d-sm"
        aria-label="Lọc theo tuyến đường"
        options={[
          { value: 'all', label: 'Tất cả tuyến đường' },
          ...routes.map((r) => ({ value: r.id, label: r.name })),
        ]}
      />

      {isAdmin && (
        <Select
          value={filters.staffId}
          onChange={(staffId) => setFilters({ staffId })}
          className="w-44 shadow-3d-sm"
          aria-label="Lọc theo nhân viên"
          options={[
            { value: 'all', label: 'Tất cả nhân viên' },
            ...staff.map((u) => ({ value: u.id, label: u.fullName })),
          ]}
        />
      )}

      <DatePicker.RangePicker
        value={range}
        format="DD/MM/YYYY"
        allowClear
        className="shadow-3d-sm"
        presets={[
          { label: 'Hôm nay', value: [today, today] },
          { label: '7 ngày qua', value: [today.subtract(6, 'day'), today] },
          { label: 'Tháng này', value: [today.startOf('month'), today] },
        ]}
        onChange={(dates) =>
          setFilters({
            dateFrom: dates?.[0]?.format(DATE_FORMAT) ?? null,
            dateTo: dates?.[1]?.format(DATE_FORMAT) ?? null,
          })
        }
      />
    </div>
  );
}

export function OrdersTable() {
  const { message, modal } = App.useApp();
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const setSmsOrder = useUiStore((s) => s.setSmsOrder);
  const setEditingOrder = useUiStore((s) => s.setEditingOrder);
  const setCreateOrderOpen = useUiStore((s) => s.setCreateOrderOpen);

  const { data, isPending, isFetching, isError, error, refetch } = useOrders(filters);
  const deleteOrder = useDeleteOrder();

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;

  const confirmDelete = (o: Order) => {
    modal.confirm({
      title: `Xóa đơn hàng #${o.id}?`,
      content: `Khách hàng: ${o.customerName || o.phone} (${o.route?.name}). Hành động này không thể hoàn tác.`,
      okText: 'Xóa đơn',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        deleteOrder.mutateAsync(o.id).then(
          () => message.success('Đã xóa đơn hàng thành công.'),
          (err) => {
            message.error(err instanceof ApiError ? err.message : 'Xóa đơn thất bại.');
            throw err;
          },
        ),
    });
  };

  const columns = useMemo<ColumnsType<Order>>(() => {
    const cols: ColumnsType<Order> = [
      {
        title: 'Giờ đón',
        dataIndex: 'departureTime',
        width: 105,
        render: (_, o) => (
          <div className="leading-tight">
            <div className="tnum text-base font-bold text-ink">{o.departureTime}</div>
            <div className="tnum text-xs font-medium text-ink-3">
              {o.departureDate.slice(8, 10)}/{o.departureDate.slice(5, 7)}
            </div>
          </div>
        ),
      },
      {
        title: 'Khách hàng',
        width: 180,
        render: (_, o) => (
          <div className="leading-tight">
            <div className="font-semibold text-ink">{o.customerName || <span className="italic text-ink-3">Chưa có tên</span>}</div>
            <div className="tnum mt-0.5 text-xs font-semibold text-ink-2">{o.phone}</div>
          </div>
        ),
      },
      {
        title: 'Tuyến & Chỗ ngồi',
        width: 230,
        render: (_, o) => (
          <div className="leading-tight">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <span>{o.route?.name || 'Tuyến không xác định'}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
              <span className="badge-3d bg-slate-100 text-ink-2">
                {o.seatCount} ghế
              </span>
              {o.seatZone && (
                <span className="badge-3d bg-amber-50 text-amber-800 border-amber-200">
                  Ghế {SEAT_ZONE_LABELS[o.seatZone]}
                </span>
              )}
              {o.vehicleType && (
                <span className="text-ink-3 truncate max-w-[120px]" title={o.vehicleType}>
                  • {o.vehicleType}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        title: 'Cước phí',
        dataIndex: 'sellPrice',
        align: 'right',
        width: 150,
        render: (_, o) => (
          <div className="text-right leading-tight">
            <div className="tnum text-sm font-bold text-ink">{formatVND(o.sellPrice)}</div>
            <div className="tnum mt-0.5 text-xs text-ink-3">
              {o.deposit > 0 && <span className="text-blue-600 mr-1.5">Cọc: {formatVND(o.deposit)}</span>}
              {o.collectOnDelivery > 0 && <span className="text-emerald-700">Thu: {formatVND(o.collectOnDelivery)}</span>}
            </div>
          </div>
        ),
      },
    ];

    if (isAdmin) {
      cols.push({
        title: 'Nhân viên',
        width: 130,
        render: (_, o) => <span className="text-xs font-medium text-ink-2">{o.staff?.fullName}</span>,
      });
    }

    cols.push(
      {
        title: 'Tin nhắn SMS',
        width: 170,
        render: (_, o) =>
          o.smsSent && o.smsSentAt ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle size={18} weight="fill" className="shrink-0 text-emerald-600" aria-hidden />
              <div className="leading-tight">
                <div className="text-xs font-bold text-emerald-700">Đã gửi</div>
                <div className="tnum text-[11px] text-ink-3">{formatDateTimeShort(o.smsSentAt)}</div>
              </div>
              <Button type="link" size="small" onClick={() => setSmsOrder(o)} className="text-xs p-1">
                Gửi lại
              </Button>
            </div>
          ) : (
            <Button
              size="small"
              icon={<PaperPlaneTilt size={14} weight="bold" />}
              onClick={() => setSmsOrder(o)}
              className="text-xs shadow-3d-sm"
            >
              Gửi tin
            </Button>
          ),
      },
      {
        title: '',
        width: 70,
        align: 'right',
        render: (_, o) => (
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'sms',
                  icon: <PaperPlaneTilt size={16} />,
                  label: 'Gửi SMS / Zalo',
                },
                {
                  key: 'edit',
                  icon: <PencilSimple size={16} />,
                  label: 'Sửa thông tin đơn',
                },
                { type: 'divider' },
                {
                  key: 'delete',
                  icon: <Trash size={16} />,
                  label: 'Xóa đơn',
                  danger: true,
                },
              ],
              onClick: ({ key }) => {
                if (key === 'sms') setSmsOrder(o);
                if (key === 'edit') setEditingOrder(o);
                if (key === 'delete') confirmDelete(o);
              },
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<DotsThreeVertical size={18} weight="bold" />}
              aria-label={`Thao tác đơn ${o.id}`}
            />
          </Dropdown>
        ),
      },
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, deleteOrder.isPending]);

  const locked = isOrderingLocked();

  return (
    <div className="card-3d overflow-hidden">
      <Toolbar isAdmin={isAdmin} />

      {isError && (
        <div className="p-4">
          <Alert
            type="error"
            showIcon
            message={error instanceof ApiError ? error.message : 'Không tải được danh sách đơn hàng.'}
            action={
              <Button size="small" onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        </div>
      )}

      <Table<Order>
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={isPending || (isFetching && orders.length === 0)}
        scroll={{ x: 1000 }}
        rowClassName="hover:bg-amber-50/15 transition-colors cursor-default"
        pagination={{
          current: filters.page,
          pageSize: ORDERS_PAGE_SIZE,
          total,
          showSizeChanger: false,
          hideOnSinglePage: true,
          showTotal: (count) => <span className="font-medium text-ink-3">{count} đơn hàng</span>,
          onChange: (page) => setFilters({ page }),
          style: { padding: '12px 16px', margin: 0 },
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-ink-2 font-medium">
                  Chưa có đơn nào trong khoảng thời gian hoặc bộ lọc này.
                </span>
              }
            >
              <Button
                type="primary"
                icon={<Plus size={16} weight="bold" />}
                disabled={locked}
                onClick={() => setCreateOrderOpen(true)}
                className="shadow-3d-primary"
              >
                Tạo đơn mới
              </Button>
            </Empty>
          ),
        }}
      />
    </div>
  );
}
