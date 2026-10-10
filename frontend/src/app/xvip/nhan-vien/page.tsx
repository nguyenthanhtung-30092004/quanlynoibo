'use client';

import { useToast } from '@/features/xvip/toast';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  FileXls,
  LockSimple,
  LockSimpleOpen,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Plus,
  ShieldCheck,
  Trash,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import type { User, UserRole } from '@/features/auth/types';
import { useCurrentUser } from '@/features/auth/hooks';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/features/users/hooks';
import { Avatar, Card, PageTitle, StatusBadge, TD, TH } from '@/features/xvip/ui';

import { Modal } from '@/features/xvip/Modal';
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

interface UserDraft {
  fullName: string;
  phone: string;
  address: string;
  role: UserRole;
  isActive: boolean;
}

const EMPTY_DRAFT: UserDraft = {
  fullName: '',
  phone: '',
  address: '',
  role: 'STAFF',
  isActive: true,
};

/** Chỉ Admin được vào; nhân viên gõ thẳng địa chỉ cũng không xem được (API cũng chặn) */
export default function UsersPage() {
  const { data: me, isLoading } = useCurrentUser();
  if (isLoading) return null;
  if (me?.role !== 'ADMIN') {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-lg font-bold text-slate-800 dark:text-white">Bạn không có quyền xem trang này</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Chỉ quản trị viên được quản lý nhân viên.</p>
      </div>
    );
  }
  return <UsersPageContent />;
}

function UsersPageContent() {
  const { data: me } = useCurrentUser();
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'STAFF'>('all');

  const { data: apiData, isLoading, refetch } = useUsers({ page, search });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<UserDraft>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const showToast = useToast();

  const usersList: User[] = useMemo(() => {
    if (apiData && Array.isArray(apiData.data)) {
      return apiData.data;
    }
    return [];
  }, [apiData]);

  const filtered = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.phone && u.phone.includes(search));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;

      return matchSearch && matchRole;
    });
  }, [usersList, search, roleFilter]);

  const totalCount = usersList.length;
  const staffCount = usersList.filter((u) => u.role === 'STAFF').length;
  const adminCount = usersList.filter((u) => u.role === 'ADMIN').length;

  const handleOpenCreate = () => {
    setEditingUser(null);
    setDraft(EMPTY_DRAFT);
    setIsOpenModal(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setDraft({
      fullName: u.fullName,
      phone: u.phone || '',
      address: u.address || '',
      role: u.role,
      isActive: u.isActive,
    });
    setIsOpenModal(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.fullName.trim()) return;

    try {
      if (editingUser) {
        const payload = {
          fullName: draft.fullName,
          phone: draft.phone.replace(/\s+/g, '') || undefined,
          address: draft.address.trim() || undefined,
          role: draft.role,
          isActive: draft.isActive,
        };
        await updateMutation.mutateAsync({ id: editingUser.id, input: payload });
        showToast(`Đã cập nhật tài khoản "${draft.fullName}" thành công!`);
      } else {
        // Tên đăng nhập = số điện thoại, mật khẩu mặc định do server đặt
        await createMutation.mutateAsync({
          fullName: draft.fullName.trim(),
          phone: draft.phone.replace(/\s+/g, ''),
          address: draft.address.trim() || undefined,
          role: draft.role,
        });
        showToast(`Đã tạo tài khoản nhân viên "${draft.fullName}" vào cơ sở dữ liệu!`);
      }
      refetch();
      setIsOpenModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu tài khoản vào máy chủ.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  const handleToggleLock = async (u: User) => {
    try {
      await updateMutation.mutateAsync({ id: u.id, input: { isActive: !u.isActive } });
      showToast(u.isActive ? `Đã khóa tài khoản "${u.fullName}".` : `Đã mở khóa tài khoản "${u.fullName}".`);
      refetch();
    } catch (err: unknown) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Không đổi được trạng thái tài khoản.'}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast(`Đã xóa tài khoản "${deleteTarget.fullName}" khỏi hệ thống.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xóa tài khoản trên máy chủ.';
      showToast(`Lỗi: ${msg}`);
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm nhân viên mới
            </button>
            <button
              type="button"
              onClick={() => showToast('Đang kết xuất danh sách nhân sự ra Excel...')}
              className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <FileXls size={18} weight="bold" /> Xuất Excel
            </button>
          </div>
        }
      >
        Nhân viên &amp; Phân quyền
      </PageTitle>


      {/* 3D KPI Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <UsersThree size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng nhân sự</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{totalCount}</div>
            <div className="text-[11px] font-medium text-white/90">Hệ thống quản lý nội bộ</div>
          </div>
        </div>

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #15803d, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <UserCircle size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Nhân viên bán vé</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{staffCount}</div>
            <div className="text-[11px] font-medium text-white/90">Trực tổng đài &amp; nhận khách</div>
          </div>
        </div>

        <div
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #6b21a8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <ShieldCheck size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Quản trị viên (Admin)</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{adminCount}</div>
            <div className="text-[11px] font-medium text-white/90">Toàn quyền điều hành</div>
          </div>
        </div>
      </div>

      {/* 3D Filter Bar */}
      <Card className="mt-5">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative min-w-[260px] flex-1">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-3d pl-10"
              placeholder="Tìm theo tên nhân viên, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Vai trò:</span>
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 shadow-inner border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'STAFF', label: 'Nhân viên' },
                  { id: 'ADMIN', label: 'Quản trị' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    roleFilter === tab.id
                      ? 'btn-3d btn-3d-blue text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 3D Table List */}
      <Card className="mt-5 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Nhân viên</th>
                <th className={TH}>Tên đăng nhập</th>
                <th className={TH}>Số điện thoại</th>
                <th className={TH}>Vai trò</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải danh sách tài khoản từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có tài khoản nào hoặc không tìm thấy kết quả phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((u, index) => (
                  <tr key={u.id} className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors">
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{index + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.fullName} />
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white">{u.fullName}</span>
                          <span className="block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {u.address || 'Hệ thống'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} font-mono text-xs font-bold text-slate-700 dark:text-slate-300`}>
                      @{u.username}
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                        <Phone size={14} className="text-blue-600 dark:text-blue-400" />
                        {u.phone || 'Chưa cập nhật'}
                      </span>
                    </td>
                    <td className={TD}>
                      {u.role === 'ADMIN' ? (
                        <span className="pill-3d bg-purple-50 text-purple-800 border-purple-300 shadow-[0_2px_0_#e9d5ff]">
                          <ShieldCheck size={14} weight="fill" className="text-purple-600" />
                          Quản trị viên
                        </span>
                      ) : (
                        <span className="pill-3d bg-blue-50 text-blue-800 border-blue-300 shadow-[0_2px_0_#bfdbfe]">
                          <UserCircle size={14} weight="fill" className="text-blue-600" />
                          Nhân viên
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <StatusBadge status={u.isActive ? 'Đang chạy' : 'Hủy'} />
                    </td>
                    <td className={`${TD} text-center`}>
                      <div className="flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          title="Sửa nhân viên"
                          className="btn-3d btn-3d-blue flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <PencilSimple size={14} weight="bold" /> Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLock(u)}
                          disabled={u.id === me?.id}
                          title={u.id === me?.id ? 'Không thể tự khóa tài khoản của mình' : u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          className="btn-3d btn-3d-amber flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {u.isActive ? <LockSimple size={14} weight="bold" /> : <LockSimpleOpen size={14} weight="bold" />}
                          {u.isActive ? 'Khóa' : 'Mở khóa'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          disabled={u.id === me?.id}
                          title={u.id === me?.id ? 'Không thể tự xóa tài khoản của mình' : 'Xóa nhân viên'}
                          className="btn-3d btn-3d-red flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash size={14} weight="bold" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Thêm / Sửa Nhân Viên */}
      {isOpenModal && (
        <Modal
          title={editingUser ? 'Chỉnh sửa thông tin nhân viên' : 'Thêm mới tài khoản nhân viên'}
          onClose={() => setIsOpenModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Họ và tên nhân viên" required>
              <input
                className="input-3d"
                value={draft.fullName}
                onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                placeholder="VD: Nguyễn Lan Anh"
                autoFocus
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Số điện thoại (dùng để đăng nhập)" required>
                <input
                  className="input-3d"
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="0912 345 678"
                  required
                />
              </Field>
            </div>

            {!editingUser && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                Mật khẩu đăng nhập mặc định: <span className="font-mono">nhanvienxvip123</span>
              </p>
            )}

            <Field label="Địa chỉ / Chi nhánh">
              <input
                className="input-3d"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="VD: Chi nhánh Bến xe Bãi Cháy, Quảng Ninh"
              />
            </Field>

            <Field label="Vai trò phân quyền" required>
              <select
                className="input-3d"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })}
              >
                <option value="STAFF">Nhân viên bán vé (STAFF)</option>
                <option value="ADMIN">Quản trị viên toàn quyền (ADMIN)</option>
              </select>
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isActiveUser"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="size-4 rounded text-blue-600"
              />
              <label htmlFor="isActiveUser" className="text-sm font-bold text-slate-700 cursor-pointer">
                Kích hoạt quyền đăng nhập vào hệ thống
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-3d btn-3d-blue px-5 py-2 text-sm"
              >
                {editingUser ? 'Cập nhật nhân viên' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Xác Nhận Xóa */}
      {deleteTarget && (
        <Modal title="Xác nhận xóa tài khoản" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Bạn có chắc chắn muốn xóa nhân viên <strong className="text-slate-900">{deleteTarget.fullName}</strong> (@{deleteTarget.username})?
            </p>
            <p className="text-xs font-medium text-slate-500">
              Tài khoản sẽ không đăng nhập được nữa. Các đơn hàng nhân viên này đã tạo vẫn được giữ nguyên.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-3d btn-3d-red px-5 py-2 text-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
