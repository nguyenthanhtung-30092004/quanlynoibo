'use client';

import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import { DeliveryForm } from '@/features/deliveries/components/DeliveryForm';
import { useDeleteDelivery, useDeliveries } from '@/features/deliveries/hooks';
import type { Delivery } from '@/features/deliveries/types';
import { usePartners } from '@/features/partners/hooks';
import { formatDateVN } from '@/lib/format';
import { money } from '@/features/xvip/data';
import { Modal } from '@/features/xvip/Modal';
import { Pagination } from '@/features/xvip/Pagination';
import { useToast } from '@/features/xvip/toast';
import { Card, PageTitle, TD, TH } from '@/features/xvip/ui';

const PAGE_SIZE = 20;

function Person({ name, phone, address }: { name: string | null; phone: string; address: string | null }) {
  return (
    <div className="max-w-[260px] whitespace-normal leading-snug">
      <div className="font-bold text-slate-900 dark:text-white">{name || '—'}</div>
      <div className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">{phone}</div>
      {address && <div className="text-xs text-slate-500 dark:text-slate-400">{address}</div>}
    </div>
  );
}

export default function DeliveriesPage() {
  const showToast = useToast();
  const { data: me } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error } = useDeliveries({ search: debounced, page, limit: PAGE_SIZE });
  const { data: partners = [] } = usePartners();
  const partnerNames = useMemo(() => partners.map((p) => p.name), [partners]);
  const deleteMutation = useDeleteDelivery();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Delivery | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null);

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast('Đã xóa đơn giao hàng.');
    } catch (err) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Không xóa được đơn giao hàng.'}`);
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <PageTitle
        actions={
          me ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm đơn giao hàng
            </button>
          ) : undefined
        }
      >
        Giao hàng
      </PageTitle>

      <Card>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-3d pl-10"
              placeholder="Tìm theo tên, số điện thoại, địa chỉ, loại hàng, đối tác…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{total} đơn</span>
        </div>
      </Card>

      <Card className="mt-5 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr>
                <th className={TH}>Ngày giờ</th>
                <th className={TH}>Người gửi</th>
                <th className={TH}>Người nhận</th>
                <th className={TH}>Hàng hóa</th>
                <th className={`${TH} text-right`}>Cước phí</th>
                <th className={`${TH} text-right`}>Hoa hồng</th>
                <th className={TH}>Đối tác</th>
                <th className={`${TH} text-center`}>Thao tác</th>
                <th className={TH}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="animate-pulse p-8 text-center text-sm font-bold text-blue-600">
                    Đang tải đơn giao hàng…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm font-semibold text-red-600">
                    {error instanceof Error ? error.message : 'Không tải được danh sách.'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm font-semibold text-slate-500">
                    {debounced ? 'Không tìm thấy đơn phù hợp.' : 'Chưa có đơn giao hàng nào.'}
                  </td>
                </tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.id} className="align-top transition-colors hover:bg-blue-50/25 dark:hover:bg-slate-800/50">
                    <td className={TD}>
                      <div className="font-bold">{d.shipTime}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateVN(d.shipDate.slice(0, 10))}</div>
                    </td>
                    <td className={TD}>
                      <Person name={d.senderName} phone={d.senderPhone} address={d.senderAddress} />
                    </td>
                    <td className={TD}>
                      <Person name={d.receiverName} phone={d.receiverPhone} address={d.receiverAddress} />
                    </td>
                    <td className={`${TD} whitespace-normal`}>
                      <div className="font-semibold">
                        {d.quantity} kiện{d.weightKg > 0 && ` · ${d.weightKg}kg`}
                      </div>
                      {d.goodsType && <div className="text-xs text-slate-500 dark:text-slate-400">{d.goodsType}</div>}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="tnum font-bold">{d.fee ? `${money(d.fee)}đ` : '—'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {d.payer === 'SENDER' ? 'Gửi trả' : 'Nhận trả'}
                      </div>
                    </td>
                    <td className={`${TD} text-right tnum font-bold text-emerald-700 dark:text-emerald-400`}>
                      {d.commission ? `${money(d.commission)}đ` : <span className="font-normal text-slate-400">—</span>}
                    </td>
                    <td className={TD}>{d.partner || <span className="text-slate-400">—</span>}</td>
                    <td className={`${TD} text-center`}>
                      {d.canEdit ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            title="Sửa đơn"
                            onClick={() => {
                              setEditing(d);
                              setFormOpen(true);
                            }}
                            className="btn-3d-mini text-blue-600 hover:text-blue-700"
                          >
                            <PencilSimple size={16} weight="bold" />
                          </button>
                          <button
                            type="button"
                            title="Xóa đơn"
                            onClick={() => setDeleteTarget(d)}
                            className="btn-3d-mini text-rose-600 hover:text-rose-700"
                          >
                            <Trash size={16} weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400" title="Chỉ sửa được trong ngày tạo, hoặc nhờ Admin">—</span>
                      )}
                    </td>
                    <td className={`${TD} max-w-[320px] whitespace-normal text-slate-600 dark:text-slate-300`}>
                      {d.note || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex justify-center">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
        </div>
      )}

      {formOpen && (
        <Modal
          title={editing ? 'Cập nhật đơn giao hàng' : 'Thêm đơn giao hàng'}
          onClose={() => setFormOpen(false)}
          size="xl"
        >
          <DeliveryForm
            editing={editing}
            partnerSuggestions={partnerNames}
            onDone={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
            showToast={showToast}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Xóa đơn giao hàng" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Xóa đơn giao hàng của <b>{deleteTarget.senderName || deleteTarget.senderPhone}</b> gửi tới{' '}
            <b>{deleteTarget.receiverName || deleteTarget.receiverPhone}</b>? Thao tác này không hoàn tác được.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <button type="button" onClick={() => setDeleteTarget(null)} className="btn-3d btn-3d-white px-4 py-2 text-sm">
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn-3d btn-3d-red px-4 py-2 text-sm disabled:opacity-60"
            >
              Xóa
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
