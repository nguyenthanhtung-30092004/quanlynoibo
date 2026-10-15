import { api, type ApiResponse } from '@/lib/api-client';
import type { LeaveConfig, LeaveMonth } from './types';

export const leaveApi = {
  month: (month: string, signal?: AbortSignal) =>
    api<ApiResponse<LeaveMonth>>('leave', { query: { month }, signal }).then((r) => r.data),

  register: (day: string) =>
    api<ApiResponse<{ id: number; day: string }>>('leave', { method: 'POST', body: { day } }).then((r) => r.data),

  remove: (id: number) => api<ApiResponse<{ id: number }>>(`leave/${id}`, { method: 'DELETE' }).then((r) => r.data),

  saveConfig: (config: LeaveConfig) =>
    api<ApiResponse<LeaveConfig>>('leave/config', { method: 'PUT', body: config }).then((r) => r.data),

  setDayLimit: (day: string, max: number | null) =>
    api<ApiResponse<{ day: string }>>('leave/day-limit', { method: 'PUT', body: { day, max } }).then((r) => r.data),
};
