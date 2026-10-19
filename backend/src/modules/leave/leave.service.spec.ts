import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { vietnamClock } from '../attendance/attendance.logic.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { LeaveDayLimit } from './entities/leave-day-limit.entity.js';
import { LeaveHistory } from './entities/leave-history.entity.js';
import { LeaveRequest } from './entities/leave-request.entity.js';
import { LeaveService } from './leave.service.js';

const admin = { sub: 1, username: 'admin', role: UserRole.ADMIN } as never;
const staffUser = { sub: 5, username: 'nv', role: UserRole.STAFF } as never;

const addDays = (day: string, delta: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};
const today = () => vietnamClock().day;

interface World {
  /** Người dùng hiện có theo id */
  users?: Record<number, { id: number; fullName: string; role: UserRole; isActive: boolean }>;
  /** Lượt nghỉ đã có: `${userId}|${day}` */
  existing?: string[];
  /** Số người đã nghỉ theo ngày */
  countByDay?: Record<string, number>;
  /** Giới hạn riêng của ngày */
  overrideByDay?: Record<string, number>;
}

function build(world: World = {}) {
  const saved: Array<{ type: string; value: Record<string, unknown> }> = [];
  const manager = {
    query: async () => undefined,
    create: (type: unknown, v: Record<string, unknown>) => ({ __type: type, ...v }),
    getRepository: () => ({
      findOne: async () => ({ id: 1, fullName: 'Admin' }),
    }),
    findOne: async (type: unknown, opts: { where: Record<string, unknown> }) => {
      if (type === User) return world.users?.[opts.where.id as number] ?? null;
      if (type === LeaveDayLimit) {
        const max = world.overrideByDay?.[opts.where.day as string];
        return max === undefined ? null : { maxOff: max };
      }
      return null;
    },
    count: async (type: unknown, opts: { where: Record<string, unknown> }) => {
      if (type !== LeaveRequest) return 0;
      const { userId, day } = opts.where as { userId?: number; day: string };
      if (userId !== undefined) return world.existing?.includes(`${userId}|${day}`) ? 1 : 0;
      return world.countByDay?.[day] ?? 0;
    },
    save: async (v: { __type: unknown } & Record<string, unknown>) => {
      saved.push({ type: v.__type === LeaveHistory ? 'history' : 'request', value: v });
      return { id: 99, ...v };
    },
  };
  const service = new LeaveService(
    { transaction: async (fn: (m: unknown) => unknown) => fn(manager) } as never,
    { findOne: async () => null } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, saved };
}

const staff = (id: number, fullName = 'Nhân viên') => ({ id, fullName, role: UserRole.STAFF, isActive: true });

describe('nhân viên đăng ký nghỉ', () => {
  it('không đăng ký được cho hôm nay, chỉ từ ngày mai', async () => {
    const { service } = build();
    await expect(service.register(staffUser, today())).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.register(staffUser, addDays(today(), -1))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Admin đăng ký nghỉ hộ nhân viên', () => {
  it('hôm nay: ghi nhận nghỉ đột xuất, kể cả khi ngày đã đủ người', async () => {
    const { service, saved } = build({
      users: { 7: staff(7, 'Lan') },
      countByDay: { [today()]: 50 },
      overrideByDay: { [today()]: 0 },
    });
    const result = await service.registerForStaff(admin, 7, today());
    expect(result).toMatchObject({ day: today(), urgent: true });
    expect(saved.find((s) => s.type === 'request')?.value).toMatchObject({ userId: 7, urgent: true });
    expect(saved.find((s) => s.type === 'history')?.value).toMatchObject({
      action: 'URGENT',
      userName: 'Lan',
      actorId: 1,
    });
  });

  it('ngày sau hôm nay: không phải nghỉ đột xuất và vẫn theo giới hạn số người', async () => {
    const tomorrow = addDays(today(), 1);
    const open = build({ users: { 7: staff(7) } });
    const ok = await open.service.registerForStaff(admin, 7, tomorrow);
    expect(ok).toMatchObject({ urgent: false });
    expect(open.saved.find((s) => s.type === 'history')?.value).toMatchObject({ action: 'REGISTER' });

    const full = build({ users: { 7: staff(7) }, countByDay: { [tomorrow]: 50 } });
    await expect(full.service.registerForStaff(admin, 7, tomorrow)).rejects.toBeInstanceOf(ConflictException);
  });

  it('từ chối: ngày đã qua, trùng lượt, người không phải nhân viên hoặc bị khóa', async () => {
    const { service } = build({
      users: {
        7: staff(7),
        8: { id: 8, fullName: 'Quản lý', role: UserRole.ADMIN, isActive: true },
      },
      existing: [`7|${today()}`],
    });
    await expect(service.registerForStaff(admin, 7, addDays(today(), -1))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerForStaff(admin, 7, today())).rejects.toBeInstanceOf(ConflictException);
    await expect(service.registerForStaff(admin, 8, today())).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registerForStaff(admin, 404, today())).rejects.toBeInstanceOf(BadRequestException);
  });
});
