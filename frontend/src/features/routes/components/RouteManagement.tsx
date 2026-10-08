'use client';

import { useState } from 'react';
import { Alert, App, Button, Dropdown, Empty, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DotsThreeVertical,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatVND } from '@/lib/format';
import { useDeleteRoute, useRoutes, useUpdateRoute } from '../hooks';
import type { Route } from '../types';
import { RouteFormModal } from './RouteFormModal';

export function RouteManagement() {
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);

  const { data, isPending, isError, error, refetch } = useRoutes({ search });
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (route: Route) => {
    setEditing(route);
    setFormOpen(true);
  };

  const toggleActive = (route: Route) => {
    updateRoute.mutate(
      { id: route.id, input: { isActive: !route.isActive } },
      {
        onSuccess: () =>
          message.success(route.isActive ? 'Đã tạm ngưng tuyến đường.' : 'Đã kích hoạt tuyến đường.'),
        onError: (err) =>
          message.error(err instanceof ApiError ? err.message : 'Thao tác thất bại.'),
      },
    );
  };

  const confirmDelete = (route: Route) => {
    modal.confirm({
      title: `Xóa tuyến đường "${route.name}"?`,
      content: 'Tuyến đường đã có đơn hàng phát sinh sẽ không thể xóa.',
      okText: 'Xóa tuyến',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        deleteRoute.mutateAsync(route.id).then(
          () => message.success('Đã xóa tuyến đường.'),
          (err) => {
            message.error(err instanceof ApiError ? err.message : 'Không thể xóa tuyến này.');
            throw err;
          },
        ),
    });
  };

  const columns: ColumnsType<Route> = [
    {
      title: 'Tên tuyến',
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 shadow-3d-sm border border-amber-200">
            <MapPin size={18} weight="fill" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-ink">{r.name}</span>
            <div className="mt-0.5 text-xs text-ink-3">
              {r.origin} ➔ {r.destination}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Điểm xuất phát',
      dataIndex: 'origin',
      width: 160,
      render: (origin) => <span className="font-medium text-ink-2">{origin}</span>,
    },
    {
      title: 'Điểm đến',
      dataIndex: 'destination',
      width: 160,
      render: (dest) => <span className="font-medium text-ink-2">{dest}</span>,
    },
    {
      title: 'Giá vé mặc định',
      dataIndex: 'defaultPrice',
      align: 'right',
      width: 160,
      render: (price?: number) => (
        <span className="tnum font-bold text-ink">
          {price ? formatVND(price) : <span className="text-ink-3 font-normal">Chưa đặt</span>}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 140,
      render: (_, r) => (
        <span className={cn('badge-3d gap-1.5', r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600')}>
          <span className={cn('size-1.5 rounded-full', r.isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400')} />
          {r.isActive ? 'Hoạt động' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      title: '',
      width: 80,
      align: 'right',
      render: (_, r) => (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              { key: 'edit', icon: <PencilSimple size={16} />, label: 'Sửa tuyến' },
              { key: 'toggle', label: r.isActive ? 'Tạm dừng hoạt động' : 'Kích hoạt lại' },
              { type: 'divider' },
              { key: 'delete', icon: <Trash size={16} />, label: 'Xóa tuyến', danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'edit') openEdit(r);
              if (key === 'toggle') toggleActive(r);
              if (key === 'delete') confirmDelete(r);
            },
          }}
        >
          <Button type="text" size="small" icon={<DotsThreeVertical size={18} weight="bold" />} aria-label={`Thao tác với tuyến ${r.name}`} />
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý Tuyến đường"
        description="Cấu hình các lộ trình đón trả khách, điểm đi/đến và giá vé chuẩn để tự động điền khi tạo đơn."
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} weight="bold" />}
            onClick={openCreate}
            className="shadow-3d-primary"
          >
            Thêm tuyến đường
          </Button>
        }
      />

      <div className="card-3d overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface-2/40 p-4">
          <Input
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-3" />}
            placeholder="Tìm theo tên tuyến, điểm đi hoặc điểm đến..."
            className="w-full sm:w-80 shadow-3d-sm"
            aria-label="Tìm tuyến đường"
          />
        </div>

        {isError && (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message={error instanceof ApiError ? error.message : 'Không tải được danh sách tuyến đường.'}
              action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>}
            />
          </div>
        )}

        <Table<Route>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isPending}
          scroll={{ x: 800 }}
          rowClassName="hover:bg-amber-50/15 transition-colors cursor-default"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-ink-2 font-medium">Chưa có tuyến đường nào.</span>}
              >
                <Button type="primary" onClick={openCreate} className="shadow-3d-primary">
                  Thêm tuyến đầu tiên
                </Button>
              </Empty>
            ),
          }}
        />
      </div>

      <RouteFormModal open={formOpen} route={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
