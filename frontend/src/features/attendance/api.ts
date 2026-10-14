import { api, type ApiResponse } from '@/lib/api-client';
import type {
  AttendanceConfig,
  AttendanceMonth,
  DayLog,
  HeartbeatResult,
  MyTodayStatus,
  OnlineUser,
  OverrideInput,
} from './types';

export const attendanceApi = {
  heartbeat: () =>
    api<ApiResponse<HeartbeatResult>>('attendance/heartbeat', { method: 'POST', body: {} }).then((r) => r.data),

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

  onlineUsers: (signal?: AbortSignal) =>
    api<ApiResponse<OnlineUser[]>>('realtime/online', { signal }).then((r) => r.data),
};
