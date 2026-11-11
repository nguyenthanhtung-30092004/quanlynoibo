import { apiUpload, type ApiResponse } from '@/lib/api-client';
import type { TicketCompareResult } from './types';

export const ticketCompareApi = {
  compare: (fileA: File, fileB: File) => {
    const form = new FormData();
    form.append('fileA', fileA);
    form.append('fileB', fileB);
    return apiUpload<ApiResponse<TicketCompareResult>>('ticket-compare', form).then((r) => r.data);
  },
};
