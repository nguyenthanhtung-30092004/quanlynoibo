'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle, Handshake, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useCurrentUser } from '@/features/auth/hooks';
import { useCreatePartner, useDeletePartner, usePartners, useUpdatePartner } from '@/features/partners/hooks';
import type { Partner } from '@/features/partners/types';
import { Modal } from '@/features/xvip/Modal';
import { Card, PageTitle, TD, TH } from '@/features/xvip/ui';

interface Draft {
  name: string;
  note: string;
}

const EMPTY: Draft = { name: '', note: '' };

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

export default function PartnersPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';

  const { data: partners = [], isLoading, isError, error } = usePartners();
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const deleteMutation = useDeletePartner();
  const [search, setSearch] = useState('');
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.note ?? '').toLowerCase().includes(q),
    );
  }, [partners, search]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY);
    setIsOpenModal(true);
  };

  const openEdit = (p: Partner) => {
    setEditingId(p.id);
    setDraft({ name: p.name, note: p.note ?? '' });
    setIsOpenModal(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      showToast('Vui lòng nhập tên đối tác.');
      return;
    }
    const input = { name, note: draft.note.trim() };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
        showToast(`Đã cập nhật đối tác "${name}".`);
      } else {
        await createMutation.mutateAsync(input);
        showToast(`Đã thêm đối tác "${name}".`);
      }
      setIsOpenModal(false);
    } catch (err: unknown) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Không lưu được đối tác.'}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast(`Đã xóa đối tác "${deleteTarget.name}".`);
    } catch (err: unknown) {
      showToast(`Lỗi: ${err instanceof Error ? err.message : 'Không xóa được đối tác.'}`);
    }
    setDeleteTarget(null);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageTitle
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={openCreate}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm đối tác
            </button>
          ) : undefined
        }
      >
        Quản lý đối tác
      </PageTitle>

      {toast && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-[0_4px_0_#a7f3d0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:shadow-[0_4px_0_#064e3b]">
          <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-600" />
          <span>{toast}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-3d pl-10"
              placeholder="Tìm theo tên hoặc ghi chú…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {filtered.length}/{partners.length} đối tác
          </span>
        </div>
      </Card>

      <Card className="mt-5 !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={TH}>STT</th>
                <th className={TH}>Tên đối tác</th>
                <th className={TH}>Ghi chú</th>
                {isAdmin && <th className={`${TH} text-center`}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="animate-pulse p-8 text-center text-sm font-bold text-blue-600 dark:text-blue-400">
                    Đang tải danh sách đối tác…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm font-semibold text-red-600">
                    {error instanceof Error ? error.message : 'Không tải được danh sách đối tác.'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {partners.length === 0 ? 'Chưa có đối tác nào.' : 'Không tìm thấy đối tác phù hợp.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={p.id} className="transition-colors hover:bg-blue-50/25 dark:hover:bg-slate-800/50">
                    <td className={`${TD} font-semibold text-slate-500 dark:text-slate-400`}>{i + 1}</td>
                    <td className={TD}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-blue-500 to-xv-blue text-white shadow-[0_2px_0_#1d4ed8]">
                          <Handshake size={18} weight="bold" />
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{p.name}</span>
                      </div>
                    </td>
                    <td className={`${TD} max-w-[420px] whitespace-normal text-slate-600 dark:text-slate-300`}>
                      {p.note || <span className="text-slate-400">—</span>}
                    </td>
                    {isAdmin && (
                      <td className={`${TD} text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            title="Sửa đối tác"
                            className="btn-3d-mini text-blue-600 hover:text-blue-700"
                          >
                            <PencilSimple size={16} weight="bold" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            title="Xóa đối tác"
                            className="btn-3d-mini text-rose-600 hover:text-rose-700"
                          >
                            <Trash size={16} weight="bold" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {isOpenModal && (
        <Modal title={editingId ? 'Sửa đối tác' : 'Thêm đối tác'} onClose={() => setIsOpenModal(false)}>
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <Field label="Tên đối tác" required>
              <input
                className="input-3d"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="VD: Phúc Xuyên"
                maxLength={100}
                autoFocus
              />
            </Field>
            <Field label="Ghi chú">
              <textarea
                className="input-3d"
                rows={3}
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="VD: Chạy tuyến Hà Nội - Cẩm Phả, liên hệ anh Tùng…"
                maxLength={1000}
              />
            </Field>
            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="btn-3d btn-3d-white px-4 py-2 text-sm"
              >
                Đóng
              </button>
              <button type="submit" disabled={saving} className="btn-3d btn-3d-blue px-5 py-2 text-sm">
                {saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Thêm đối tác'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Xóa đối tác" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Bạn có chắc muốn xóa đối tác{' '}
              <strong className="text-slate-900 dark:text-white">{deleteTarget.name}</strong>? Các vé đã gắn
              tên đối tác này vẫn giữ nguyên tên đã lưu.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn-3d btn-3d-white px-4 py-2 text-sm">
                Giữ lại
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn-3d btn-3d-red px-4 py-2 text-sm"
              >
                {deleteMutation.isPending ? 'Đang xóa…' : 'Xóa đối tác'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
