'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  CurrencyCircleDollar,
  Eye,
  FileXls,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  PencilSimple,
  Plus,
  Ticket,
  Trash,
} from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import { useRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from '@/features/routes/hooks';
import type { Route } from '@/features/routes/types';
import { money } from '@/features/xvip/data';
import { useToast } from '@/features/xvip/toast';
import { Card, PageTitle, StatusBadge, TD, TH } from '@/features/xvip/ui';

import { Modal } from '@/features/xvip/Modal';
/** Tuyến đường đúng như backend trả về (không thêm trường nào) */
type RouteExt = Route;

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

interface RouteDraft {
  name: string;
  origin: string;
  destination: string;
  defaultPrice: number;
  isActive: boolean;
}

const EMPTY_DRAFT: RouteDraft = {
  name: '',
  origin: '',
  destination: '',
  defaultPrice: 0,
  isActive: true,
};

export default function RoutesPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const { data: apiData, isLoading, refetch } = useRoutes();
  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const deleteMutation = useDeleteRoute();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RouteDraft>(EMPTY_DRAFT);
  const [detailRoute, setDetailRoute] = useState<RouteExt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteExt | null>(null);

  const showToast = useToast();

  const routesList: RouteExt[] = useMemo(() => {
    if (!apiData?.data || !Array.isArray(apiData.data)) return [];
    return apiData.data;
  }, [apiData]);

  const filtered = useMemo(() => {
    return routesList.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.origin.toLowerCase().includes(search.toLowerCase()) ||
        r.destination.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && r.isActive) ||
        (statusFilter === 'inactive' && !r.isActive);

      return matchSearch && matchStatus;
    });
  }, [routesList, search, statusFilter]);

  const totalCount = routesList.length;
  const activeCount = routesList.filter((r) => r.isActive).length;
  const avgPrice = routesList.length
    ? Math.round(
        routesList.reduce((acc, r) => acc + (r.defaultPrice || 0), 0) / routesList.length
      )
    : 0;
  const inactiveCount = totalCount - activeCount;

  const handleOpenCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setIsOpenModal(true);
  };

  const handleOpenEdit = (r: RouteExt) => {
    setEditingId(r.id);
    setDraft({
      name: r.name,
      origin: r.origin,
      destination: r.destination,
      defaultPrice: r.defaultPrice ?? 0,
      isActive: r.isActive,
    });
    setIsOpenModal(true);
  };

  const handleAutoFillName = (origin: string, dest: string) => {
    if (origin && dest && (!draft.name || draft.name === `${draft.origin} - ${draft.destination}`)) {
      return `${origin} - ${dest}`;
    }
    return draft.name;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.origin.trim() || !draft.destination.trim()) return;

    const finalName = draft.name.trim() || `${draft.origin} - ${draft.destination}`;

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          input: {
            name: finalName,
            origin: draft.origin.trim(),
            destination: draft.destination.trim(),
            defaultPrice: draft.defaultPrice,
            isActive: draft.isActive,
          },
        });
        showToast(`Đã cập nhật tuyến đường "${finalName}" trên hệ thống thành công!`);
      } else {
        await createMutation.mutateAsync({
          name: finalName,
          origin: draft.origin.trim(),
          destination: draft.destination.trim(),
          defaultPrice: draft.defaultPrice,
          isActive: draft.isActive,
        });
        showToast(`Đã thêm mới tuyến đường "${finalName}" vào cơ sở dữ liệu thành công!`);
      }
      refetch();
      setIsOpenModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lưu tuyến đường vào máy chủ.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast(`Đã xóa tuyến đường "${deleteTarget.name}" khỏi cơ sở dữ liệu.`);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xóa tuyến đường trên máy chủ.';
      showToast(`Lỗi: ${msg}`);
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm tuyến đường mới
            </button>
            )}
            <button
              type="button"
              onClick={() => showToast('Đang kết xuất danh mục tuyến đường ra file Excel...')}
              className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <FileXls size={18} weight="bold" /> Xuất Excel
            </button>
          </div>
        }
      >
        Tuyến đường vận hành
      </PageTitle>


      {/* 3D KPI Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          onClick={() => {
            setStatusFilter('all');
            showToast(`Đang hiển thị tất cả ${totalCount} tuyến đường.`);
          }}
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #1d4ed8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
          title="Bấm để xem tất cả tuyến đường"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <NavigationArrow size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tổng số tuyến</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{totalCount}</div>
            <div className="text-[11px] font-medium text-white/90">Lộ trình vận chuyển liên tỉnh</div>
          </div>
        </div>

        <div
          onClick={() => {
            setStatusFilter('active');
            showToast(`Đã lọc ${activeCount} tuyến đường đang mở khai thác bán vé.`);
          }}
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #15803d, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
          title="Bấm để lọc các tuyến đang khai thác"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <CheckCircle size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Đang khai thác</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{activeCount}</div>
            <div className="text-[11px] font-medium text-white/90">Mở bán vé trực tiếp cho khách</div>
          </div>
        </div>

        <div
          onClick={() => showToast(`Mức giá vé trung bình niêm yết chuẩn: ${money(avgPrice)}đ.`)}
          style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #b45309, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
          title="Bấm để xem thống kê giá vé"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <CurrencyCircleDollar size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Giá vé trung bình</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{money(avgPrice)}đ</div>
            <div className="text-[11px] font-medium text-white/90">Mức giá niêm yết chuẩn</div>
          </div>
        </div>

        <div
                    style={{
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 5px 0 #6b21a8, 0 12px 24px -4px rgba(15,23,42,0.18)',
          }}
          className="group relative flex items-center gap-3.5 rounded-2xl bg-gradient-to-b from-purple-600 to-purple-700 p-4 text-white transition-all duration-100 hover:-translate-y-1 active:translate-y-1 cursor-pointer select-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-sm transition-transform group-hover:scale-110">
            <Clock size={26} weight="fill" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Tuyến ngừng hoạt động</div>
            <div className="tnum text-2xl font-black drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{inactiveCount} tuyến</div>
            <div className="text-[11px] font-medium text-white/90">Đã tắt, không chọn được khi lên vé</div>
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
              placeholder="Tìm theo tên tuyến, điểm xuất phát hoặc điểm đến..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Trạng thái:</span>
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 shadow-inner border border-slate-200 dark:border-slate-700">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'active', label: 'Đang mở' },
                  { id: 'inactive', label: 'Tạm đóng' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    statusFilter === tab.id
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
                <th className={TH}>Tên tuyến đường</th>
                <th className={TH}>Điểm đi</th>
                <th className={TH}>Điểm đến</th>
                <th className={`${TH} text-right`}>Giá niêm yết</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Đang tải danh sách tuyến đường từ cơ sở dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có tuyến đường nào trong hệ thống hoặc không có kết quả phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((route, index) => (
                  <tr
                    key={route.id}
                    className="hover:bg-blue-50/25 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    onClick={() => setDetailRoute(route)}
                  >
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{index + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-xv-blue text-white shadow-[0_2px_0_#1d4ed8]">
                          <MapPin size={18} weight="bold" />
                        </span>
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                            {route.name}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500">ID: #{route.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`${TD} font-bold text-slate-700 dark:text-slate-300`}>{route.origin}</td>
                    <td className={`${TD} font-bold text-slate-700 dark:text-slate-300`}>{route.destination}</td>
                    <td className={`${TD} text-right font-black text-slate-900 dark:text-white tnum`}>
                      {money(route.defaultPrice || 0)}đ
                    </td>
                    <td className={TD}>
                      <StatusBadge status={route.isActive ? 'Đang chạy' : 'Hủy'} />
                    </td>
                    <td className={`${TD} text-center`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailRoute(route)}
                          title="Xem chi tiết lộ trình"
                          className="btn-3d-mini text-slate-700 dark:text-slate-300 hover:text-blue-600"
                        >
                          <Eye size={16} weight="bold" />
                        </button>
                        {isAdmin && (
                          <>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(route)}
                          title="Sửa tuyến đường"
                          className="btn-3d-mini text-blue-600 hover:text-blue-700"
                        >
                          <PencilSimple size={16} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(route)}
                          title="Xóa tuyến đường"
                          className="btn-3d-mini text-rose-600 hover:text-rose-700"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Chi tiết Lộ trình Tuyến đường */}
      {detailRoute && (
        <Modal
          title={`Lộ trình chi tiết: ${detailRoute.name}`}
          onClose={() => setDetailRoute(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Điểm đi</span>
                <div className="text-base font-black text-slate-900 dark:text-white">{detailRoute.origin}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Điểm đến</span>
                <div className="text-base font-black text-slate-900 dark:text-white">{detailRoute.destination}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Giá vé mặc định</span>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{money(detailRoute.defaultPrice ?? 0)}đ</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Trạng thái</span>
                <div className="text-base font-black text-slate-900 dark:text-white">{detailRoute.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href="/xvip/quan-ly-ve"
                className="btn-3d btn-3d-blue flex items-center gap-1.5 px-4 py-2 text-xs"
              >
                <Ticket size={16} weight="bold" /> Vào lên đơn vé tuyến này
              </Link>
              <button
                type="button"
                onClick={() => setDetailRoute(null)}
                className="btn-3d btn-3d-white px-4 py-2 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Thêm / Sửa Tuyến Đường */}
      {isOpenModal && (
        <Modal
          title={editingId ? 'Chỉnh sửa tuyến đường' : 'Thêm mới tuyến đường vận hành'}
          onClose={() => setIsOpenModal(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Điểm xuất phát" required>
                <input
                  className="input-3d"
                  value={draft.origin}
                  onChange={(e) => {
                    const newOrigin = e.target.value;
                    setDraft((p) => ({
                      ...p,
                      origin: newOrigin,
                      name: handleAutoFillName(newOrigin, p.destination),
                    }));
                  }}
                  placeholder="VD: Hà Nội"
                  autoFocus
                  required
                />
              </Field>

              <Field label="Điểm đến" required>
                <input
                  className="input-3d"
                  value={draft.destination}
                  onChange={(e) => {
                    const newDest = e.target.value;
                    setDraft((p) => ({
                      ...p,
                      destination: newDest,
                      name: handleAutoFillName(p.origin, newDest),
                    }));
                  }}
                  placeholder="VD: Cẩm Phả"
                  required
                />
              </Field>
            </div>

            <Field label="Tên hiển thị tuyến đường">
              <input
                className="input-3d"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="VD: Hà Nội - Cẩm Phả (VIP)"
              />
            </Field>

            <Field label="Giá vé niêm yết mặc định (VNĐ)" required>
              <input
                className="input-3d font-bold text-slate-900 dark:text-white"
                type="number"
                step="5000"
                value={draft.defaultPrice}
                onChange={(e) => setDraft({ ...draft, defaultPrice: Number(e.target.value) || 0 })}
                placeholder="300000"
                required
              />
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isActiveRoute"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                className="size-4 rounded text-blue-600"
              />
              <label htmlFor="isActiveRoute" className="text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Cho phép bán vé tuyến này
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                {editingId ? 'Cập nhật tuyến đường' : 'Lưu tuyến đường mới'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Xác Nhận Xóa */}
      {deleteTarget && (
        <Modal title="Xác nhận xóa tuyến đường" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa tuyến <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong> không?
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
