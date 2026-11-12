import { apiUpload, apiUploadDownload, type ApiResponse } from '@/lib/api-client';
import type { TicketCompareResult } from './types';

const twoFiles = (fileA: File, fileB: File) => {
  const form = new FormData();
  form.append('fileA', fileA);
  form.append('fileB', fileB);
  return form;
};

export const ticketCompareApi = {
  compare: (fileA: File, fileB: File) =>
    apiUpload<ApiResponse<TicketCompareResult>>('ticket-compare', twoFiles(fileA, fileB)).then((r) => r.data),

  /** Báo cáo đối chiếu dạng Excel đã định dạng (server so lại đúng 2 file này, không lưu gì) */
  exportExcel: (fileA: File, fileB: File) => apiUploadDownload('ticket-compare/export', twoFiles(fileA, fileB)),
};
