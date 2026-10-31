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
  findAutoUrgentAbsences,
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
  people: Array<{
    /** null với người được hệ thống tự ghi nhận nghỉ đột xuất (không có lượt đăng ký để hủy) */
    requestId: number | null;
    userId: number;
    fullName: string;
    urgent: boolean;
    /** Không quẹt máy chấm công và chưa đăng ký nghỉ nên hệ thống tự ghi nhận nghỉ đột xuất */
    auto: boolean;
  }>;
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
        .select(['r.id', 'r.userId', 'r.day', 'r.urgent', 'u.id', 'u.fullName'])
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

    const today = vietnamClock().day;
    const autoUrgent = await this.autoUrgentAbsences(daysInMonth, today, byDay);

    const days: LeaveDay[] = daysInMonth.map((day) => {
      const list = byDay.get(day) ?? [];
      const override = overrideByDay.get(day);
      return {
        day,
        limit: limitForDay(day, config, override),
        customLimit: override !== undefined,
        count: list.length,
        mine: list.some((r) => r.userId === actor.sub),
        people: [
          ...list.map((r) => ({
            requestId: r.id,
            userId: r.userId,
            fullName: r.user?.fullName ?? '',
            urgent: r.urgent,
            auto: false,
          })),
          ...(autoUrgent.get(day) ?? []).map((a) => ({
            requestId: null,
            userId: a.userId,
            fullName: a.fullName,
            urgent: true,
            auto: true,
          })),
        ],
      };
    });

    return { month, today, config, quota: MONTHLY_LEAVE_QUOTA, days };
  }

  /**
   * Ngày đã qua mà nhân viên không quẹt lần nào và chưa đăng ký nghỉ thì tính là nghỉ đột xuất (xem `findAutoUrgentAbsences`),
   * khỏi phải Admin ghi tay.
   */
  private async autoUrgentAbsences(
    daysInMonth: string[],
    today: string,
    registeredByDay: Map<string, LeaveRequest[]>,
  ) {
    const pastDays = daysInMonth.filter((d) => d < today);
    if (pastDays.length === 0) return new Map<string, Array<{ userId: number; fullName: string }>>();

    const [staff, punchRows] = await Promise.all([
      this.dataSource.getRepository(User).find({
        where: { role: UserRole.STAFF, isActive: true },
        select: { id: true, fullName: true, createdAt: true },
      }),
      this.dataSource.query(
        `SELECT DISTINCT to_char("day", 'YYYY-MM-DD') AS "day", "userId"
           FROM "attendance_punches" WHERE "day" >= $1 AND "day" <= $2`,
        [pastDays[0], pastDays[pastDays.length - 1]],
      ) as Promise<Array<{ day: string; userId: number }>>,
    ]);

    const punched = new Map<string, Set<number>>();
    for (const p of punchRows) punched.set(p.day, (punched.get(p.day) ?? new Set()).add(p.userId));
    const registered = new Map<string, Set<number>>();
    for (const [day, list] of registeredByDay) registered.set(day, new Set(list.map((r) => r.userId)));

    return findAutoUrgentAbsences({
      days: pastDays,
      today,
      staff: staff.map((u) => ({ id: u.id, fullName: u.fullName, since: vietnamClock(u.createdAt).day })),
      punched,
      registered,
    });
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

  /**
   * Admin đăng ký nghỉ hộ nhân viên (nhân viên báo nghỉ ngay trong ngày).
   * Chỉ từ hôm nay trở đi. Ngày hôm nay là nghỉ đột xuất: được ghi nhận dù ngày đã đủ người
   * vì việc nghỉ đã xảy ra; ngày sau hôm nay vẫn theo giới hạn số người.
   */
  async registerForStaff(actor: JwtPayload, userId: number, day: string) {
    if (!isRealDay(day)) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    const today = vietnamClock().day;
    if (day < today) {
      throw new BadRequestException('Không đăng ký nghỉ cho ngày đã qua');
    }
    if (day > addDays(today, MAX_DAYS_AHEAD)) {
      throw new BadRequestException(`Chỉ được đăng ký nghỉ trước tối đa ${MAX_DAYS_AHEAD} ngày`);
    }
    const urgent = day === today;
    const config = await this.loadConfig();

    return this.dataSource.transaction(async (manager) => {
      const staff = await manager.findOne(User, {
        where: { id: userId, isActive: true },
        select: { id: true, fullName: true, role: true },
      });
      if (!staff || staff.role !== UserRole.STAFF) {
        throw new BadRequestException('Nhân viên không tồn tại hoặc đã bị khóa');
      }
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`leave:${day}`]);

      const already = await manager.count(LeaveRequest, { where: { userId, day } });
      if (already > 0) {
        throw new ConflictException(`${staff.fullName} đã đăng ký nghỉ ngày này rồi`);
      }
      const count = await manager.count(LeaveRequest, { where: { day } });
      const override = await manager.findOne(LeaveDayLimit, { where: { day } });
      const limit = limitForDay(day, config, override?.maxOff);
      if (!urgent && (limit <= 0 || count >= limit)) {
        throw new ConflictException('Ngày này đã đủ số người nghỉ, hãy nâng giới hạn của ngày trước khi đăng ký');
      }
      const saved = await manager.save(manager.create(LeaveRequest, { userId, day, urgent }));
      await manager.save(
        manager.create(LeaveHistory, {
          day,
          action: urgent ? 'URGENT' : 'REGISTER',
          userId,
          userName: staff.fullName,
          actorId: actor.sub,
          actorName: await this.nameOf(manager.getRepository(User), actor),
        }),
      );
      return { id: saved.id, day, urgent, count: count + 1, limit };
    });
  }

  private async nameOf(users: Repository<User>, actor: JwtPayload): Promise<string> {
    const u = await users.findOne({ where: { id: actor.sub }, select: { id: true, fullName: true } });
    return u?.fullName || actor.username || '';
  }

  /**
   * Hủy một lượt đăng ký nghỉ: Admin hủy được mọi lượt từ hôm nay trở đi; nhân viên chỉ hủy lượt của mình
   * và chỉ khi ngày nghỉ chưa tới. Ngày đã qua thì không ai hủy được
   */
  async remove(id: number, actor: JwtPayload) {
    const found = await this.requests.findOne({ where: { id }, relations: { user: true } });
    if (!found) {
      throw new NotFoundException('Không tìm thấy lượt đăng ký nghỉ');
    }
    if (found.day < vietnamClock().day) {
      throw new BadRequestException('Ngày nghỉ đã qua, không hủy được');
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

  /** Admin chỉnh giới hạn riêng cho một ngày (0 = khóa); max rỗng = quay về mặc định theo nhóm. Không chỉnh ngày đã qua */
  async setDayLimit(day: string, max: number | null | undefined) {
    if (!isRealDay(day)) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    if (day < vietnamClock().day) {
      throw new BadRequestException('Không chỉnh giới hạn cho ngày đã qua');
    }
    if (max === null || max === undefined) {
      await this.limits.delete({ day });
    } else {
      await this.limits.save(this.limits.create({ day, maxOff: max }));
    }
    return { day, max: max ?? null };
  }
}
