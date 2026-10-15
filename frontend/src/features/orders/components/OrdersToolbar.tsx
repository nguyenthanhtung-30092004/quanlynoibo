'use client';

import { useRef } from 'react';
import {
  FileXls,
  Plus,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import { PageTitle } from '@/features/xvip/ui';
import type { UnlistedPartnerInfo } from '../types';

interface OrdersToolbarProps {
  isAdmin: boolean;
  unlistedPartners: UnlistedPartnerInfo[];
  onOpenCreate: () => void;
  onExportExcel: () => void;
  onImportFile: (file: File | undefined) => void;
  isImporting?: boolean;
  /** 0-100 khi đang tải file lên; null khi không nhập */
  importProgress?: number | null;
  onSearchPartner: (partnerName: string) => void;
}

export function OrdersToolbar({
  isAdmin,
  unlistedPartners,
  onOpenCreate,
  onExportExcel,
  onImportFile,
  isImporting = false,
  importProgress = null,
  onSearchPartner,
}: OrdersToolbarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => onImportFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn-3d btn-3d-white flex items-center gap-2 px-4 py-2.5 text-sm"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <UploadSimple size={18} weight="bold" />{' '}
                  {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
                </button>
                <button
                  type="button"
                  className="btn-3d btn-3d-green flex items-center gap-2 px-4 py-2.5 text-sm"
                  onClick={onExportExcel}
                >
                  <FileXls size={18} weight="bold" /> Xuất Excel
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onOpenCreate}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Plus size={18} weight="bold" /> Thêm vé mới
            </button>
          </div>
        }
      >
        Quản lý vé &amp; Đơn đặt xe
      </PageTitle>

      {/* Thanh tiến trình nhập Excel: tải lên 0-100%, sau đó chờ máy chủ xử lý */}
      {isAdmin && isImporting && importProgress !== null && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-sm font-medium text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200">
          <div className="mb-2 flex justify-between">
            <span>
              {importProgress < 100
                ? 'Đang tải file lên...'
                : 'Đang xử lý và lưu đơn, vui lòng chờ...'}
            </span>
            <span>{importProgress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
            <div
              className={`h-full rounded-full bg-blue-600 transition-all ${
                importProgress >= 100 ? 'animate-pulse' : ''
              }`}
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Cảnh báo đối tác không có trong danh sách (chỉ Admin) */}
      {isAdmin && unlistedPartners.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm font-medium text-amber-900 shadow-[0_2px_0_#fcd34d] dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <WarningCircle
            size={20}
            weight="fill"
            className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
          />
          <div>
            Có <strong>{unlistedPartners.length}</strong> đối tác không có trong danh sách:{' '}
            {unlistedPartners.map((u, i) => (
              <span key={u.partner}>
                {i > 0 && ', '}
                <button
                  type="button"
                  onClick={() => onSearchPartner(u.partner)}
                  className="font-bold underline decoration-amber-400 underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
                  title={`Bấm để tìm kiếm vé của "${u.partner}"`}
                >
                  {u.partner} ({u.orders} đơn)
                </button>
              </span>
            ))}
            . Tìm theo tên ở ô tìm kiếm của Quản lý vé và sửa lại đối tác.
          </div>
        </div>
      )}
    </>
  );
}
