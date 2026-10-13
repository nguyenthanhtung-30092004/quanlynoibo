import { api, type ApiResponse } from '@/lib/api-client';
import type { PayrollData, SavePayrollInput } from './types';

export const payrollApi = {
  get: (month: string, signal?: AbortSignal) =>
    api<ApiResponse<PayrollData>>('payroll', { query: { month }, signal }).then((res) => res.data),

  save: (input: SavePayrollInput) =>
    api<ApiResponse<PayrollData>>('payroll', { method: 'PUT', body: input }).then((res) => res.data),
};
