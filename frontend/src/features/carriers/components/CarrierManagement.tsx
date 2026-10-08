'use client';

import { useState } from 'react';
import { Alert, App, Button, Dropdown, Empty, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Buildings,
  DotsThreeVertical,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
} from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useCarriers, useDeleteCarrier, useUpdateCarrier } from '../hooks';
import type { Carrier } from '../types';
import { CarrierFormModal } from './CarrierFormModal';

export function CarrierManagement() {
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);

  const { data, isPending, isError, error, refetch } = useCarriers({ search });
  const updateCarrier = useUpdateCarrier();
  const deleteCarrier = useDeleteCarrier();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (carrier: Carrier) => {
    setEditing(carrier);
    setFormOpen(true);
  };

  const toggleActive = (carrier: Carrier) => {
    updateCarrier.mutate(
      { id: carrier.id, input: { isActive: !carrier.isActive } },
      {
        onSuccess: () =>
          message.success(carrier.isActive ? 'Đã tạm ngưng hợp tác với nhà xe.' : 'Đã kích hoạt lại nhà xe.'),
        onError: (err) =>
          message.error(err instanceof ApiError ? err.message : 'Thao tác thất bại.'),
      },
    );
  };

  const confirmDelete = (carrier: Carrier) => {
    modal.confirm({
      title: `Xóa nhà xe "${carrier.name}"?`,
      content: 'Nhà xe đã có đơn phát sinh sẽ không thể xóa.',
      okText: 'Xóa nhà xe',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        deleteCarrier.mutateAsync(carrier.id).then(
          () => message.success('Đã xóa nhà xe.'),
          (err) => {
            message.error(err instanceof ApiError ? err.message : 'Không thể xóa nhà xe này.');
            throw err;
          },
        ),
    });
  };

  const columns: ColumnsType<Carrier> = [
    {
      title: 'Tên nhà xe',
      render: (_, c) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shadow-3d-sm border border-blue-200">
            <Buildings size={20} weight="fill" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-ink">{c.name}</span>
            {c.note && <div className="mt-0.5 text-xs text-ink-3 truncate max-w-[240px]">{c.note}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      width: 170,
      render: (phone) => <span className="tnum font-semibold text-ink">{phone || <span className="text-ink-3 font-normal">Chưa có</span>}</span>,
    },
    {
      title: 'Địa chỉ văn phòng',
      dataIndex: 'address',
      render: (addr) => <span className="text-ink-2 font-medium">{addr || <span className="text-ink-3">Chưa có</span>}</span>,
    },
    {
      title: 'Trạng thái',
      width: 140,
      render: (_, c) => (
        <span className={cn('badge-3d gap-1.5', c.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600')}>
          <span className={cn('size-1.5 rounded-full', c.isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400')} />
          {c.isActive ? 'Đang hợp tác' : 'Tạm dừng'}
        </span>
      ),
    },
    {
      title: '',
      width: 80,
      align: 'right',
      render: (_, c) => (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              { key: 'edit', icon: <PencilSimple size={16} />, label: 'Sửa thông tin' },
              { key: 'toggle', label: c.isActive ? 'Tạm dừng hợp tác' : 'Kích hoạt lại' },
              { type: 'divider' },
              { key: 'delete', icon: <Trash size={16} />, label: 'Xóa nhà xe', danger: true },
            ],
            onClick: ({ key }) => {
              if (key === 'edit') openEdit(c);
              if (key === 'toggle') toggleActive(c);
              if (key === 'delete') confirmDelete(c);
            },
          }}
        >
          <Button type="text" size="small" icon={<DotsThreeVertical size={18} weight="bold" />} aria-label={`Thao tác với ${c.name}`} />
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý Nhà xe đối tác"
        description="Danh sách các đơn vị đối tác vận chuyển, nhà xe liên kết, thông tin số điện thoại tổng đài và trạng thái."
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} weight="bold" />}
            onClick={openCreate}
            className="shadow-3d-primary"
          >
            Thêm nhà xe
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
            placeholder="Tìm theo tên nhà xe, số điện thoại..."
            className="w-full sm:w-80 shadow-3d-sm"
            aria-label="Tìm nhà xe"
          />
        </div>

        {isError && (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message={error instanceof ApiError ? error.message : 'Không tải được danh sách nhà xe.'}
              action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>}
            />
          </div>
        )}

        <Table<Carrier>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isPending}
          scroll={{ x: 750 }}
          rowClassName="hover:bg-amber-50/15 transition-colors cursor-default"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-ink-2 font-medium">Chưa có nhà xe đối tác nào.</span>}
              >
                <Button type="primary" onClick={openCreate} className="shadow-3d-primary">
                  Thêm nhà xe đầu tiên
                </Button>
              </Empty>
            ),
          }}
        />
      </div>

      <CarrierFormModal open={formOpen} carrier={editing} onClose={() => setFormOpen(false)} />
    </>
  );
}
