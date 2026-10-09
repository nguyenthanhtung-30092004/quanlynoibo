'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, DatePicker, Dropdown, Empty, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  DotsThreeVertical,
  LockSimple,
  LockSimpleOpen,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  UserPlus,
} from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCurrentUser } from '@/features/auth/hooks';
import { useKpi } from '@/features/orders/hooks';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatVND } from '@/lib/format';
import { getVnToday } from '@/lib/time';
import { useUiStore } from '@/stores/ui-store';
import { USERS_PAGE_SIZE } from '../api';
import { useDeleteUser, useUpdateUser, useUsers } from '../hooks';
import type { User } from '../types';
import { UserFormModal } from './UserFormModal';

const ROLE_LABEL = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' } as const;

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function StaffManagement() {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const setFilters = useUiStore((s) => s.setFilters);

  const today = getVnToday();
  const [date, setDate] = useState(today);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data, isPending, isError, error, refetch } = useUsers({ page, search });
  const { data: kpi } = useKpi(date);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  // Số đơn theo từng nhân viên trong ngày đang xem (chưa có đơn = 0)
  const statsByUser = useMemo(
    () => new Map((kpi?.byStaff ?? []).map((row) => [row.staffId, row])),
    [kpi],
  );

  const showError = (err: unknown) =>
    message.error(err instanceof ApiError ? err.message : 'Thao tác thất bại.');

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (user: User) => {
    setEditing(user);
    setFormOpen(true);
  };

  const toggleActive = (user: User) =>
    updateUser.mutate(
      { id: user.id, input: { isActive: !user.isActive } },
      {
        onSuccess: () => message.success(user.isActive ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.'),
        onError: showError,
      },
    );

  const confirmDelete = (user: User) =>
    modal.confirm({
      title: `Xóa tài khoản "${user.fullName}"?`,
      content: 'Nhân viên đã có đơn hàng sẽ không xóa được. Khi đó hãy khóa tài khoản thay vì xóa.',
      okText: 'Xóa tài khoản',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () =>
        deleteUser.mutateAsync(user.id).then(
          () => message.success('Đã xóa tài khoản.'),
          (err) => {
            showError(err);
            throw err;
          },
        ),
    });

  /** Sang trang Đơn hàng, lọc sẵn theo nhân viên và ngày đang xem */
  const viewOrders = (user: User) => {
    setFilters({ staffId: user.id, routeId: 'all', search: '', dateFrom: date, dateTo: date });
    router.push('/');
  };

  const columns: ColumnsType<User> = [
    {
      title: 'Nhân viên',
      render: (_, u) => (
        <div className="leading-tight">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            <span>{u.fullName}</span>
            {u.id === me?.id && (
              <span className="badge-3d bg-amber-50 text-amber-800 border-amber-200 text-[11px] py-0">
                Bạn
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-ink-3">@{u.username}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      width: 140,
      render: (_, u) => (
        <span className={cn('badge-3d', u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-700')}>
          {ROLE_LABEL[u.role]}
        </span>
      ),
    },
    {
      title: 'Liên hệ',
      width: 190,
      render: (_, u) => (
        <div className="leading-tight">
          <div className="tnum font-semibold text-ink">{u.phone ?? <span className="text-ink-3">Chưa có SĐT</span>}</div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      width: 130,
      render: (_, u) => (
        <span className={cn('badge-3d gap-1.5', u.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
          <span
            className={cn('size-1.5 rounded-full', u.isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-500')}
            aria-hidden
          />
          {u.isActive ? 'Hoạt động' : 'Đã khóa'}
        </span>
      ),
    },
    {
      title: 'Đơn trong ngày',
      align: 'right',
      width: 130,
      render: (_, u) => (
        <span className="tnum font-bold text-ink text-sm">
          {statsByUser.get(u.id)?.total ?? 0}
        </span>
      ),
    },
    {
      title: 'Số ghế',
      align: 'right',
      width: 100,
      render: (_, u) => (
        <span className="tnum text-ink-2 font-medium">
          {statsByUser.get(u.id)?.seats ?? 0}
        </span>
      ),
    },
    {
      title: 'Doanh thu',
      align: 'right',
      width: 150,
      render: (_, u) => (
        <span className="tnum font-bold text-ink">
          {formatVND(statsByUser.get(u.id)?.revenue ?? 0)}
        </span>
      ),
    },
    {
      title: '',
      width: 140,
      align: 'right',
      render: (_, u) => {
        const isSelf = u.id === me?.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {u.role === 'STAFF' && (
              <Button type="link" size="small" onClick={() => viewOrders(u)} className="text-xs font-semibold">
                Xem đơn
              </Button>
            )}
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              menu={{
                items: [
                  { key: 'edit', icon: <PencilSimple size={16} />, label: 'Sửa thông tin' },
                  {
                    key: 'toggle',
                    icon: u.isActive ? <LockSimple size={16} /> : <LockSimpleOpen size={16} />,
                    label: u.isActive ? 'Khóa tài khoản' : 'Mở khóa',
                    disabled: isSelf,
                  },
                  { type: 'divider' },
                  { key: 'delete', icon: <Trash size={16} />, label: 'Xóa tài khoản', danger: true, disabled: isSelf },
                ],
                onClick: ({ key }) => {
                  if (key === 'edit') openEdit(u);
                  if (key === 'toggle') toggleActive(u);
                  if (key === 'delete') confirmDelete(u);
                },
              }}
            >
              <Button type="text" size="small" icon={<DotsThreeVertical size={20} weight="bold" />} aria-label={`Thao tác với ${u.fullName}`} />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý nhân viên"
        description="Tạo tài khoản, phân quyền quản trị/nhân viên và theo dõi hiệu suất điều hành theo ngày."
        actions={
          <Button
            type="primary"
            icon={<UserPlus size={16} weight="bold" />}
            onClick={openCreate}
            className="shadow-3d-primary"
          >
            Tạo tài khoản mới
          </Button>
        }
      />

      <div className="card-3d overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/40 p-4">
          <Input
            allowClear
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            prefix={<MagnifyingGlass size={16} className="text-ink-3" />}
            placeholder="Tìm theo tên hoặc tên đăng nhập..."
            className="w-full sm:w-72 shadow-3d-sm"
            aria-label="Tìm nhân viên"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-ink-2">
              Tổng đơn trong ngày: <strong className="tnum text-ink font-bold">{kpi?.total ?? 0}</strong>
            </span>
            <DatePicker
              allowClear={false}
              value={dayjs(date)}
              format="DD/MM/YYYY"
              disabledDate={(d) => d.isAfter(dayjs(today), 'day')}
              onChange={(d) => setDate(d.format('YYYY-MM-DD'))}
              aria-label="Chọn ngày thống kê"
              className="shadow-3d-sm"
            />
          </div>
        </div>

        {isError && (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message={error instanceof ApiError ? error.message : 'Không tải được danh sách nhân viên.'}
              action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>}
            />
          </div>
        )}

        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isPending}
          scroll={{ x: 960 }}
          rowClassName="hover:bg-amber-50/15 transition-colors cursor-default"
          pagination={{
            current: page,
            pageSize: USERS_PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: setPage,
            style: { padding: '12px 16px', margin: 0 },
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-ink-2 font-medium">Không tìm thấy tài khoản nào phù hợp.</span>}
              />
            ),
          }}
        />
      </div>

      <UserFormModal
        open={formOpen}
        user={editing}
        isSelf={editing?.id === me?.id}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}
