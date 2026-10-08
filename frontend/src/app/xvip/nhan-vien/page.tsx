'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CheckCircle,
  FileXls,
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
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/features/users/hooks';
import { Avatar, Card, PageTitle, StatusBadge, TD, TH } from '@/features/xvip/ui';
import { useSound } from '@/features/xvip/sound';

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
  username: string;
  fullName: string;
  password?: string;
  phone: string;
  citizenId: string;
  address: string;
  role: UserRole;
  isActive: boolean;
}

const EMPTY_DRAFT: UserDraft = {
  username: '',
  fullName: '',
  password: 'Password@123',
  phone: '',
  citizenId: '',
  address: '',
  role: 'STAFF',
  isActive: true,
};

export default function UsersPage() {
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'ADMIN' | 'STAFF'>('all');

  const { data: apiData, isLoading, refetch } = useUsers({ page, search });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const { playSuccess, playWarn } = useSound();

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<UserDraft>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
        (u.phone && u.phone.includes(search)) ||
        (u.citizenId && u.citizenId.includes(search));

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
      username: u.username,
      fullName: u.fullName,
      phone: u.phone || '',
      citizenId: u.citizenId || '',
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
          citizenId: draft.citizenId || undefined,
          address: draft.address.trim() || undefined,
          role: draft.role,
          isActive: draft.isActive,
        };
        await updateMutation.mutateAsync({ id: editingUser.id, input: payload });
        playSuccess();
        showToast(`Đã cập nhật tài khoản "${draft.fullName}" thành công!`);
      } else {
        if (!draft.username.trim() || !draft.citizenId.trim()) return;
        await createMutation.mutateAsync({
          username: draft.username.trim(),
          password: draft.password || 'Password@123',
          fullName: draft.fullName.trim(),
          citizenId: draft.citizenId.trim(),
          phone: draft.phone.replace(/\s+/g, '') || undefined,
          address: draft.address.trim() || undefined,
          role: draft.role,
        });
        playSuccess();
        showToast(`Đã tạo tài khoản nhân viên "${draft.fullName}" vào cơ sở dữ liệu!`);
      }
      refetch();
      setIsOpenModal(false);
    } catch (err: unknown) {
      playWarn();
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu tài khoản vào máy chủ.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      playSuccess();
      showToast(`Đã xóa tài khoản "${deleteTarget.fullName}" khỏi hệ thống.`);
      refetch();
    } catch (err: unknown) {
      playWarn();
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

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-[0_4px_0_#a7f3d0] animate-in fade-in">
          <CheckCircle size={20} weight="fill" className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

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
              placeholder="Tìm theo tên nhân viên, username, SĐT, số CCCD..."
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
                <th className={TH}>Số CCCD</th>
                <th className={TH}>Vai trò</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải danh sách tài khoản từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
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
                    <td className={`${TD} font-mono text-xs font-semibold text-slate-600 dark:text-slate-400`}>
                      {u.citizenId || '—'}
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
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          title="Sửa nhân viên"
                          className="btn-3d-mini text-blue-600 hover:text-blue-700"
                        >
                          <PencilSimple size={16} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          title="Xóa nhân viên"
                          className="btn-3d-mini text-rose-600 hover:text-rose-700"
                        >
                          <Trash size={16} weight="bold" />
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
              <Field label="Tên đăng nhập (Username)" required>
                <input
                  className="input-3d"
                  value={draft.username}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  placeholder="VD: lan.anh"
                  disabled={!!editingUser}
                  required
                />
              </Field>

              {!editingUser && (
                <Field label="Mật khẩu khởi tạo" required>
                  <input
                    className="input-3d"
                    type="password"
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Số điện thoại" required>
                <input
                  className="input-3d"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="0912 345 678"
                />
              </Field>

              <Field label="Số CCCD (12 số)" required>
                <input
                  className="input-3d"
                  value={draft.citizenId}
                  onChange={(e) => setDraft({ ...draft, citizenId: e.target.value })}
                  placeholder="001200000002"
                  maxLength={12}
                />
              </Field>
            </div>

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
