import { api, type ApiResponse } from '@/lib/api-client';
import type {
  AttendanceConfig,
  AttendanceMonth,
  DayLog,
  MyTodayStatus,
  OnlineUser,
  OverrideInput,
} from './types';

export const attendanceApi = {
  dayLog: (signal?: AbortSignal) =>
    api<ApiResponse<DayLog>>('attendance/day-log', { signal }).then((r) => r.data),

  me: (signal?: AbortSignal) =>
    api<ApiResponse<MyTodayStatus>>('attendance/me', { signal }).then((r) => r.data),

  month: (month: string, signal?: AbortSignal) =>
    api<ApiResponse<AttendanceMonth>>('attendance', { query: { month }, signal }).then((r) => r.data),

  saveConfig: (config: AttendanceConfig) =>
    api<ApiResponse<AttendanceConfig>>('attendance/config', { method: 'PUT', body: { config } }).then((r) => r.data),

  override: (input: OverrideInput) =>
    api<ApiResponse<{ ok: boolean }>>('attendance/override', { method: 'PUT', body: input }).then((r) => r.data),

  /** Admin chọn lại ca cho một ngày (shiftStart null = bỏ chọn) */
  setShiftOverride: (input: { userId: number; day: string; shiftStart: number | null }) =>
    api<ApiResponse<{ ok: boolean }>>('attendance/shift-override', { method: 'PUT', body: input }).then((r) => r.data),

  /** Ca mặc định của nhân viên (shiftStart null = bỏ) */
  setDefaultShift: (input: { userId: number; shiftStart: number | null }) =>
    api<ApiResponse<{ ok: boolean }>>('attendance/default-shift', { method: 'PUT', body: input }).then((r) => r.data),

  onlineUsers: (signal?: AbortSignal) =>
    api<ApiResponse<OnlineUser[]>>('realtime/online', { signal }).then((r) => r.data),
};
