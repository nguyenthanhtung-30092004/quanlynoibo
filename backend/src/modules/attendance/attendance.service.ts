import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import {
  DEFAULT_ATTENDANCE_CONFIG,
  congFromMinutes,
  evaluateBeat,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
} from './attendance.logic.js';
import type { HeartbeatDto } from './dto/attendance.dto.js';

const CONFIG_KEY = 'attendance_config';

export interface AttendanceDayCell {
  /** Số phút thao tác online */
  minutes: number;
  /** Số công cuối cùng của ngày (đã tính cả chỉnh tay) */
  cong: number;
  /** Số công tự tính từ số phút, bỏ qua chỉnh tay */
  autoCong: number;
  overridden: boolean;
  note: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async loadConfig(): Promise<AttendanceConfig> {
    const row = await this.settings.findOne({ where: { key: CONFIG_KEY } });
    if (!row?.value) return DEFAULT_ATTENDANCE_CONFIG;
    try {
      return sanitizeAttendanceConfig(JSON.parse(row.value));
    } catch {
      return DEFAULT_ATTENDANCE_CONFIG;
    }
  }

  async saveConfig(input: Record<string, unknown>): Promise<AttendanceConfig> {
    const config = sanitizeAttendanceConfig(input);
    await this.settings.save(this.settings.create({ key: CONFIG_KEY, value: JSON.stringify(config) }));
    return config;
  }

  /**
   * Nhận một lượt "tôi đang thao tác" từ trình duyệt của nhân viên. Giờ do server ghi.
   * Đủ điều kiện (nhân viên, active trong 5 phút) thì đánh dấu phút hiện tại là có công.
   */
  async heartbeat(actor: JwtPayload, dto: HeartbeatDto) {
    const config = await this.loadConfig();
    const verdict = evaluateBeat({
      role: actor.role,
      active: dto.active,
    });
    const { day, minuteOfDay } = vietnamClock();

    const minutes = verdict.counted
      ? await this.markMinute(actor.sub, day, minuteOfDay)
      : await this.minutesOf(actor.sub, day);

    return { ...this.statusOf(minutes, config), counted: verdict.counted, reason: verdict.reason };
  }

  /** Số phút và công hôm nay của chính người đăng nhập (cho chip trạng thái ở đầu trang) */
  async today(actor: JwtPayload) {
    const config = await this.loadConfig();
    const { day } = vietnamClock();
    const minutes = await this.minutesOf(actor.sub, day);
    return this.statusOf(minutes, config);
  }

  /** Số phút online hôm nay của một danh sách nhân viên */
  async getTodayMinutesMap(userIds: number[]): Promise<Map<number, number>> {
    if (userIds.length === 0) return new Map();
    const { day } = vietnamClock();
    const rows: Array<{ userId: number; minutes: string }> = await this.dataSource.query(
      `SELECT "userId", length(replace("bits", '0', '')) AS "minutes" FROM "attendance_days" WHERE "userId" = ANY($1) AND "day" = $2`,
      [userIds, day],
    );
    const map = new Map<number, number>();
    for (const r of rows) {
      map.set(Number(r.userId), Number(r.minutes));
    }
    return map;
  }

  /** Bảng chấm công cả tháng cho Admin: từng nhân viên, từng ngày, tổng công */
  async month(month: string) {
    const config = await this.loadConfig();
    const [yearStr, monthStr] = month.split('-');
    const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const staff = await this.users.find({
      where: { role: UserRole.STAFF, deletedAt: IsNull() },
      select: { id: true, fullName: true, isActive: true },
      order: { fullName: 'ASC' },
    });

    const rows: Array<{
      userId: number;
      day: string;
      minutes: string;
      overrideCong: string | null;
      overrideNote: string | null;
    }> = await this.dataSource.query(
      `SELECT "userId", to_char("day", 'YYYY-MM-DD') AS "day",
              length(replace("bits", '0', '')) AS "minutes",
              "overrideCong", "overrideNote"
         FROM "attendance_days"
        WHERE "day" >= $1 AND "day" <= $2`,
      [from, to],
    );

    const byUser = new Map<number, Record<string, AttendanceDayCell>>();
    for (const r of rows) {
      const minutes = Number(r.minutes);
      const autoCong = congFromMinutes(minutes, config);
      const overridden = r.overrideCong !== null;
      const days = byUser.get(r.userId) ?? {};
      days[r.day] = {
        minutes,
        autoCong,
        cong: overridden ? Number(r.overrideCong) : autoCong,
        overridden,
        note: r.overrideNote ?? '',
      };
      byUser.set(r.userId, days);
    }

    return {
      month,
      daysInMonth,
      config,
      staff: staff.map((u) => {
        const days = byUser.get(u.id) ?? {};
        const totalCong = Object.values(days).reduce((sum, d) => sum + d.cong, 0);
        return { id: u.id, fullName: u.fullName, isActive: u.isActive, days, totalCong };
      }),
    };
  }

  /** Admin chỉnh tay số công một ngày (null = bỏ chỉnh tay), có ghi chú để đối chiếu khi khiếu nại */
  async setOverride(adminId: number, userId: number, day: string, cong: number | null, note: string | undefined) {
    const target = await this.users.findOne({ where: { id: userId, role: UserRole.STAFF, deletedAt: IsNull() } });
    if (!target) throw new BadRequestException('Không tìm thấy nhân viên.');

    if (cong === null) {
      await this.dataSource.query(
        `UPDATE "attendance_days" SET "overrideCong" = NULL, "overrideNote" = NULL, "overrideBy" = NULL
          WHERE "userId" = $1 AND "day" = $2`,
        [userId, day],
      );
      return { ok: true };
    }

    const rounded = Math.round(cong * 2) / 2; // chỉ nhận bội số của 0,5
    await this.dataSource.query(
      `INSERT INTO "attendance_days" ("userId", "day", "overrideCong", "overrideNote", "overrideBy")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "day")
       DO UPDATE SET "overrideCong" = EXCLUDED."overrideCong", "overrideNote" = EXCLUDED."overrideNote", "overrideBy" = EXCLUDED."overrideBy"`,
      [userId, day, rounded, (note ?? '').slice(0, 200) || null, adminId],
    );
    return { ok: true };
  }

  private statusOf(minutes: number, config: AttendanceConfig) {
    return {
      minutesToday: minutes,
      congToday: congFromMinutes(minutes, config),
      fullMinutes: config.fullMinutes,
      halfMinutes: config.halfMinutes,
    };
  }

  private async minutesOf(userId: number, day: string): Promise<number> {
    const rows: Array<{ minutes: string }> = await this.dataSource.query(
      `SELECT length(replace("bits", '0', '')) AS "minutes" FROM "attendance_days" WHERE "userId" = $1 AND "day" = $2`,
      [userId, day],
    );
    return rows.length ? Number(rows[0].minutes) : 0;
  }

  /** Đánh dấu phút `minuteOfDay` của ngày đó là có công, trả về tổng số phút trong ngày */
  private async markMinute(userId: number, day: string, minuteOfDay: number): Promise<number> {
    const position = minuteOfDay + 1; // overlay đánh số vị trí từ 1
    const rows: Array<{ minutes: string }> = await this.dataSource.query(
      `INSERT INTO "attendance_days" ("userId", "day", "bits", "firstAt", "lastAt")
       VALUES ($1, $2, overlay(repeat('0', 1440) placing '1' from $3::int for 1), now(), now())
       ON CONFLICT ("userId", "day")
       DO UPDATE SET "bits" = overlay("attendance_days"."bits" placing '1' from $3::int for 1),
                     "lastAt" = now()
       RETURNING length(replace("bits", '0', '')) AS "minutes"`,
      [userId, day, position],
    );
    return Number(rows[0].minutes);
  }
}
