import { api, type ApiResponse } from '@/lib/api-client';
import type { LeaveConfig, LeaveHistoryEntry, LeaveMonth, StaffPaydayRow } from './types';

export const leaveApi = {
  month: (month: string, signal?: AbortSignal) =>
    api<ApiResponse<LeaveMonth>>('leave', { query: { month }, signal }).then((r) => r.data),

  history: (day: string, signal?: AbortSignal) =>
    api<ApiResponse<LeaveHistoryEntry[]>>('leave/history', { query: { day }, signal }).then((r) => r.data),

  register: (day: string) =>
    api<ApiResponse<{ id: number; day: string }>>('leave', { method: 'POST', body: { day } }).then((r) => r.data),

  /** Admin đăng ký nghỉ hộ nhân viên; ngày hôm nay là nghỉ đột xuất */
  registerForStaff: (day: string, userId: number) =>
    api<ApiResponse<{ id: number; day: string; urgent: boolean }>>('leave/admin', {
      method: 'POST',
      body: { day, userId },
    }).then((r) => r.data),

  remove: (id: number) => api<ApiResponse<{ id: number }>>(`leave/${id}`, { method: 'DELETE' }).then((r) => r.data),

  saveConfig: (config: LeaveConfig) =>
    api<ApiResponse<LeaveConfig>>('leave/config', { method: 'PUT', body: config }).then((r) => r.data),

  /** Admin: ngày nhận lương hằng tháng của từng nhân viên đang làm */
  paydays: (signal?: AbortSignal) =>
    api<ApiResponse<StaffPaydayRow[]>>('leave/paydays', { signal }).then((r) => r.data),

  /** Admin đặt cùng một ngày nhận lương hằng tháng cho nhiều nhân viên */
  setStaffPaydays: (userIds: number[], dayOfMonth: number) =>
    api<ApiResponse<{ userIds: number[]; dayOfMonth: number }>>('leave/paydays', {
      method: 'PUT',
      body: { userIds, dayOfMonth },
    }).then((r) => r.data),

  /** Admin đặt ngày nhận lương (1-31) cho nhân viên; null = bỏ */
  setStaffPayday: (userId: number, dayOfMonth: number | null) =>
    api<ApiResponse<{ userId: number; dayOfMonth: number | null }>>('leave/payday', {
      method: 'PUT',
      body: { userId, dayOfMonth },
    }).then((r) => r.data),

  setDayLimit: (day: string, max: number | null) =>
    api<ApiResponse<{ day: string }>>('leave/day-limit', { method: 'PUT', body: { day, max } }).then((r) => r.data),
};
