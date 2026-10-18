import { api, type ApiResponse } from '@/lib/api-client';

export interface AppSettings {
  companyName: string;
  hotline: string;
  email: string;
  address: string;
  smsTemplate: string;
  /** JSON: [{ bank, number, holder, vietqrBank }] */
  qrAccounts: string;
}

export const settingsApi = {
  get: (signal?: AbortSignal) =>
    api<ApiResponse<AppSettings>>('settings', { signal }).then((res) => res.data),

  update: (input: Partial<AppSettings>) =>
    api<ApiResponse<AppSettings>>('settings', { method: 'PUT', body: input }).then(
      (res) => res.data,
    ),
};
