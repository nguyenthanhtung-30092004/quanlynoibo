'use client';

import { useRef } from 'react';
import { FileXls, Plus, UploadSimple } from '@phosphor-icons/react';
import { PageTitle } from '@/features/xvip/ui';

interface OrdersToolbarProps {
  isAdmin: boolean;
  onOpenCreate: () => void;
  onExportExcel: () => void;
  onImportFile: (file: File | undefined) => void;
  isImporting?: boolean;
  /** 0-100 khi đang tải file lên; null khi không nhập */
  importProgress?: number | null;
}

export function OrdersToolbar({
  isAdmin,
  onOpenCreate,
  onExportExcel,
  onImportFile,
  isImporting = false,
  importProgress = null,
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
    </>
  );
}
