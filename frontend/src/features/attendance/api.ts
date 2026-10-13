import { api, type ApiResponse } from '@/lib/api-client';
import type {
  AttendanceConfig,
  AttendanceMonth,
  HeartbeatInput,
  HeartbeatResult,
  MyTodayStatus,
  OverrideInput,
} from './types';

export const attendanceApi = {
  heartbeat: (input: HeartbeatInput) =>
    api<ApiResponse<HeartbeatResult>>('attendance/heartbeat', { method: 'POST', body: input }).then((r) => r.data),

  me: (signal?: AbortSignal) =>
    api<ApiResponse<MyTodayStatus>>('attendance/me', { signal }).then((r) => r.data),

  month: (month: string, signal?: AbortSignal) =>
    api<ApiResponse<AttendanceMonth>>('attendance', { query: { month }, signal }).then((r) => r.data),

  saveConfig: (config: AttendanceConfig) =>
    api<ApiResponse<AttendanceConfig>>('attendance/config', { method: 'PUT', body: { config } }).then((r) => r.data),

  override: (input: OverrideInput) =>
    api<ApiResponse<{ ok: boolean }>>('attendance/override', { method: 'PUT', body: input }).then((r) => r.data),
};
