import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { vietnamClock } from '../attendance/attendance.logic.js';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { LeaveHistory } from './entities/leave-history.entity.js';
import { LeaveDayLimit } from './entities/leave-day-limit.entity.js';
import { LeaveRequest } from './entities/leave-request.entity.js';
import {
  DEFAULT_LEAVE_CONFIG,
  isRealDay,
  limitForDay,
  sanitizeLeaveConfig,
  type LeaveConfig,
} from './leave.logic.js';

const CONFIG_KEY = 'leave_config';
/** Chỉ cho đăng ký nghỉ trước tối đa chừng này ngày để tránh đặt kín cả năm */
const MAX_DAYS_AHEAD = 120;
/** Mỗi nhân viên được nghỉ tối đa chừng này ngày/tháng; vượt thì giao diện cảnh báo */
export const MONTHLY_LEAVE_QUOTA = 4;

export interface LeaveDay {
  day: string;
  /** Số người được nghỉ tối đa trong ngày (đã tính chỉnh riêng) */
  limit: number;
  /** Ngày này đang dùng giới hạn Admin chỉnh riêng thay vì mặc định theo nhóm */
  customLimit: boolean;
  count: number;
  /** Người đang xem đã đăng ký nghỉ ngày này */
  mine: boolean;
  /** Ai đã đăng ký nghỉ ngày này (mọi người dùng đều xem được, chỉ Admin mới hủy được) */
  people: Array<{ requestId: number; userId: number; fullName: string }>;
}

const addDays = (day: string, delta: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
};

@Injectable()
export class LeaveService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(LeaveRequest) private readonly requests: Repository<LeaveRequest>,
    @InjectRepository(LeaveDayLimit) private readonly limits: Repository<LeaveDayLimit>,
    @InjectRepository(LeaveHistory) private readonly history: Repository<LeaveHistory>,
  ) {}

  async loadConfig(): Promise<LeaveConfig> {
    const row = await this.settings.findOne({ where: { key: CONFIG_KEY } });
    if (!row?.value) return DEFAULT_LEAVE_CONFIG;
    try {
      return sanitizeLeaveConfig(JSON.parse(row.value));
    } catch {
      return DEFAULT_LEAVE_CONFIG;
    }
  }

  async saveConfig(input: LeaveConfig): Promise<LeaveConfig> {
    const config = sanitizeLeaveConfig(input);
    await this.settings.save(this.settings.create({ key: CONFIG_KEY, value: JSON.stringify(config) }));
    return config;
  }

  /** Lịch nghỉ của một tháng: số người đã đăng ký / giới hạn từng ngày; kèm tên những người đã đăng ký */
  async month(month: string, actor: JwtPayload) {
    const first = `${month}-01`;
    const last = `${month}-31`; // so sánh chuỗi: tháng ngắn hơn vẫn không có ngày lớn hơn
    const daysInMonth: string[] = [];
    for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) daysInMonth.push(d);

    const [config, rows, overrides] = await Promise.all([
      this.loadConfig(),
      this.requests
        .createQueryBuilder('r')
        .innerJoin('r.user', 'u')
        .select(['r.id', 'r.userId', 'r.day', 'u.id', 'u.fullName'])
        .where('r.day >= :first AND r.day <= :last', { first, last })
        .orderBy('r.createdAt', 'ASC')
        .getMany(),
      this.limits
        .createQueryBuilder('l')
        .where('l.day >= :first AND l.day <= :last', { first, last })
        .getMany(),
    ]);

    const overrideByDay = new Map(overrides.map((o) => [o.day, o.maxOff]));
    const byDay = new Map<string, LeaveRequest[]>();
    for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);

    const days: LeaveDay[] = daysInMonth.map((day) => {
      const list = byDay.get(day) ?? [];
      const override = overrideByDay.get(day);
      return {
        day,
        limit: limitForDay(day, config, override),
        customLimit: override !== undefined,
        count: list.length,
        mine: list.some((r) => r.userId === actor.sub),
        people: list.map((r) => ({ requestId: r.id, userId: r.userId, fullName: r.user?.fullName ?? '' })),
      };
    });

    return { month, today: vietnamClock().day, config, quota: MONTHLY_LEAVE_QUOTA, days };
  }

  /** Nhân viên tự đăng ký nghỉ: có hiệu lực ngay nếu ngày đó còn chỗ; không tự hủy được (Admin hủy) */
  async register(actor: JwtPayload, day: string) {
    if (actor.role !== UserRole.STAFF) {
      throw new ForbiddenException('Chỉ nhân viên mới đăng ký nghỉ');
    }
    if (!isRealDay(day)) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    const today = vietnamClock().day;
    if (day <= today) {
      throw new BadRequestException('Chỉ được đăng ký nghỉ từ ngày mai trở đi');
    }
    if (day > addDays(today, MAX_DAYS_AHEAD)) {
      throw new BadRequestException(`Chỉ được đăng ký nghỉ trước tối đa ${MAX_DAYS_AHEAD} ngày`);
    }
    const config = await this.loadConfig();

    return this.dataSource.transaction(async (manager) => {
      // Khóa theo ngày để hai người cùng bấm vào chỗ cuối cùng không cùng lọt qua giới hạn
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`leave:${day}`]);

      const already = await manager.count(LeaveRequest, { where: { userId: actor.sub, day } });
      if (already > 0) {
        throw new ConflictException('Bạn đã đăng ký nghỉ ngày này rồi');
      }
      const override = await manager.findOne(LeaveDayLimit, { where: { day } });
      const limit = limitForDay(day, config, override?.maxOff);
      if (limit <= 0) {
        throw new ConflictException('Ngày này không nhận đăng ký nghỉ');
      }
      const count = await manager.count(LeaveRequest, { where: { day } });
      if (count >= limit) {
        throw new ConflictException('Ngày này đã đủ số người nghỉ, vui lòng chọn ngày khác');
      }
      const saved = await manager.save(manager.create(LeaveRequest, { userId: actor.sub, day }));
      const name = await this.nameOf(manager.getRepository(User), actor);
      await manager.save(
        manager.create(LeaveHistory, {
          day,
          action: 'REGISTER',
          userId: actor.sub,
          userName: name,
          actorId: actor.sub,
          actorName: name,
        }),
      );
      return { id: saved.id, day, count: count + 1, limit };
    });
  }

  private async nameOf(users: Repository<User>, actor: JwtPayload): Promise<string> {
    const u = await users.findOne({ where: { id: actor.sub }, select: { id: true, fullName: true } });
    return u?.fullName || actor.username || '';
  }

  /** Hủy một lượt đăng ký nghỉ: Admin hủy được mọi lượt; nhân viên chỉ hủy lượt của mình và chỉ khi ngày nghỉ chưa tới */
  async remove(id: number, actor: JwtPayload) {
    const found = await this.requests.findOne({ where: { id }, relations: { user: true } });
    if (!found) {
      throw new NotFoundException('Không tìm thấy lượt đăng ký nghỉ');
    }
    if (actor.role !== UserRole.ADMIN) {
      if (found.userId !== actor.sub) {
        throw new ForbiddenException('Bạn chỉ hủy được lượt đăng ký nghỉ của chính mình');
      }
      if (found.day <= vietnamClock().day) {
        throw new BadRequestException('Chỉ hủy được khi ngày nghỉ chưa tới');
      }
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(LeaveRequest, { id });
      await manager.save(
        manager.create(LeaveHistory, {
          day: found.day,
          action: 'CANCEL',
          userId: found.userId,
          userName: found.user?.fullName ?? '',
          actorId: actor.sub,
          actorName: await this.nameOf(manager.getRepository(User), actor),
        }),
      );
    });
    return { id, day: found.day };
  }

  /** Lịch sử đăng ký / hủy nghỉ của một ngày, mới nhất trước (ai cũng xem được) */
  async historyOfDay(day: string) {
    if (!isRealDay(day)) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    const rows = await this.history.find({ where: { day }, order: { createdAt: 'DESC', id: 'DESC' }, take: 200 });
    return rows.map((h) => ({
      id: h.id,
      action: h.action,
      userName: h.userName,
      actorId: h.actorId,
      actorName: h.actorName,
      createdAt: h.createdAt,
    }));
  }

  /** Admin chỉnh giới hạn riêng cho một ngày (0 = khóa); max rỗng = quay về mặc định theo nhóm */
  async setDayLimit(day: string, max: number | null | undefined) {
    if (!isRealDay(day)) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    if (max === null || max === undefined) {
      await this.limits.delete({ day });
    } else {
      await this.limits.save(this.limits.create({ day, maxOff: max }));
    }
    return { day, max: max ?? null };
  }
}
