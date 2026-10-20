import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import {
  DEFAULT_ATTENDANCE_CONFIG,
  PUNCH_COOLDOWN_SECONDS,
  congFromMinutes,
  evaluateDay,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
  type DayResult,
  type DayStatus,
} from './attendance.logic.js';
import { directionByOrder, directionFromStatus, type HikvisionPunch } from './hikvision-event.js';

export type PunchResult = 'recorded' | 'duplicate' | 'unknown_employee' | 'not_counted';

const CONFIG_KEY = 'attendance_config';

/**
 * Từ ngày này công chỉ tính theo lượt quẹt máy chấm công. Các ngày trước đó vốn tính theo thời gian đăng nhập
 * (cột `bits` của attendance_days) nên vẫn đọc lại để bảng lương các tháng cũ không bị mất công.
 */
const PUNCH_ONLY_FROM = '2026-10-21';

/** Số phút đăng nhập của cách tính cũ (từ phút online đầu tiên đến phút cuối cùng trong ngày) */
const LEGACY_MINUTES_SQL = `(CASE WHEN position('1' in "bits") = 0 THEN 0 ELSE length(rtrim("bits", '0')) - position('1' in "bits") + 1 END)`;

export interface AttendanceDayCell {
  /** Số phút được tính trong ca */
  minutes: number;
  /** Số công cuối cùng của ngày (đã tính cả chỉnh tay) */
  cong: number;
  /** Số công tự tính từ lượt quẹt, bỏ qua chỉnh tay */
  autoCong: number;
  overridden: boolean;
  note: string;
  status: DayStatus;
  /** Nhãn ca, vd "6h - 15h30"; null nếu chưa xác định được ca (hoặc là công cũ tính theo đăng nhập) */
  shift: string | null;
  firstAt: string | null;
  lastAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

interface PunchSummaryRow {
  userId: number;
  day: string;
  firstAt: Date;
  lastAt: Date;
  n: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private cachedConfig: { data: AttendanceConfig; expiresAt: number } | null = null;
  private readonly CONFIG_TTL_MS = 60_000;

  async loadConfig(): Promise<AttendanceConfig> {
    const now = Date.now();
    if (this.cachedConfig && this.cachedConfig.expiresAt > now) {
      return this.cachedConfig.data;
    }
    const row = await this.settings.findOne({ where: { key: CONFIG_KEY } });
    let config = DEFAULT_ATTENDANCE_CONFIG;
    if (row?.value) {
      try {
        config = sanitizeAttendanceConfig(JSON.parse(row.value));
      } catch {
        config = DEFAULT_ATTENDANCE_CONFIG;
      }
    }
    this.cachedConfig = { data: config, expiresAt: now + this.CONFIG_TTL_MS };
    return config;
  }

  async saveConfig(input: Record<string, unknown>): Promise<AttendanceConfig> {
    const config = sanitizeAttendanceConfig(input);
    await this.settings.save(this.settings.create({ key: CONFIG_KEY, value: JSON.stringify(config) }));
    this.cachedConfig = { data: config, expiresAt: Date.now() + this.CONFIG_TTL_MS };
    return config;
  }

  /**
   * Ghi một lượt quẹt từ máy chấm công Hikvision. Giờ lấy theo giờ của máy (máy gửi lại khi mất mạng vẫn đúng giờ).
   * Quẹt lại trong vòng PUNCH_COOLDOWN_SECONDS của một lượt đã ghi thì bỏ qua, nên quẹt liền hai lần chỉ tính lượt vào.
   * Công của ngày tính từ lượt quẹt đầu (vào) đến lượt quẹt cuối (ra), xem `evaluateDay`.
   */
  async recordPunch(punch: HikvisionPunch): Promise<PunchResult> {
    const user = await this.users.findOne({
      where: { deviceEmployeeNo: punch.employeeNo, deletedAt: IsNull() },
      select: { id: true, role: true, isActive: true },
    });
    if (!user) return 'unknown_employee';
    if (!user.isActive || user.role !== UserRole.STAFF) return 'not_counted';

    const { day } = vietnamClock(punch.at);

    const near: Array<{ n: string }> = await this.dataSource.query(
      `SELECT count(*) AS "n" FROM "attendance_punches"
        WHERE "userId" = $1
          AND "at" BETWEEN $2::timestamptz - make_interval(secs => $3::int) AND $2::timestamptz + make_interval(secs => $3::int)`,
      [user.id, punch.at, PUNCH_COOLDOWN_SECONDS],
    );
    if (Number(near[0].n) > 0) return 'duplicate';

    // `kind` chỉ để đối chiếu nhật ký; công không dựa vào nó mà dựa vào lượt đầu và lượt cuối trong ngày
    let kind = directionFromStatus(punch.status);
    if (!kind) {
      const before: Array<{ n: string }> = await this.dataSource.query(
        `SELECT count(*) AS "n" FROM "attendance_punches" WHERE "userId" = $1 AND "day" = $2 AND "at" < $3`,
        [user.id, day, punch.at],
      );
      kind = directionByOrder(Number(before[0].n));
    }

    await this.dataSource.query(`INSERT INTO "attendance_punches" ("userId", "day", "at", "kind") VALUES ($1, $2, $3, $4)`, [
      user.id,
      day,
      punch.at,
      kind,
    ]);
    return 'recorded';
  }

  /**
   * Tình hình từng nhân viên trong một ngày (mặc định hôm nay): đã quẹt vào lúc nào, đã quẹt ra chưa,
   * ca nào, đi muộn / về sớm bao nhiêu phút và công tạm tính. Người chưa quẹt vẫn có mặt trong danh sách.
   */
  async dayLog(day?: string) {
    const config = await this.loadConfig();
    const today = vietnamClock().day;
    const target = day ?? today;

    const staff = await this.users.find({
      where: { role: UserRole.STAFF, deletedAt: IsNull(), isActive: true },
      select: { id: true, fullName: true },
      order: { fullName: 'ASC' },
    });

    const punches: Array<{ userId: number; at: Date }> = await this.dataSource.query(
      `SELECT "userId", "at" FROM "attendance_punches" WHERE "day" = $1 ORDER BY "at" ASC`,
      [target],
    );
    const overrides: Array<{ userId: number; overrideCong: string | null }> = await this.dataSource.query(
      `SELECT "userId", "overrideCong" FROM "attendance_days" WHERE "day" = $1`,
      [target],
    );

    const punchesBy = new Map<number, Date[]>();
    for (const p of punches) {
      const list = punchesBy.get(p.userId) ?? [];
      list.push(new Date(p.at));
      punchesBy.set(p.userId, list);
    }
    const overrideBy = new Map(overrides.map((o) => [o.userId, o.overrideCong]));

    return {
      day: target,
      staff: staff.map((u) => {
        const list = punchesBy.get(u.id) ?? [];
        const result = evaluateDay(
          { firstAt: list[0] ?? null, lastAt: list[list.length - 1] ?? null, punchCount: list.length, isToday: target === today },
          config,
        );
        const override = overrideBy.get(u.id);
        return {
          userId: u.id,
          fullName: u.fullName,
          status: result.status,
          shift: result.shift?.label ?? null,
          minutes: result.minutes,
          cong: override != null ? Number(override) : result.cong,
          lateMinutes: result.lateMinutes,
          earlyLeaveMinutes: result.earlyLeaveMinutes,
          firstAt: list[0] ? list[0].toISOString() : null,
          lastAt: list.length > 1 ? list[list.length - 1].toISOString() : null,
          punches: list.map((d) => d.toISOString()),
        };
      }),
    };
  }

  /** Trạng thái chấm công hôm nay của chính người đăng nhập (cho chip ở header: đã chấm vào lúc nào, bộ đếm giờ) */
  async today(actor: JwtPayload) {
    const config = await this.loadConfig();
    const { day } = vietnamClock();
    const rows: Array<{ at: Date }> = await this.dataSource.query(
      `SELECT "at" FROM "attendance_punches" WHERE "userId" = $1 AND "day" = $2 ORDER BY "at" ASC`,
      [actor.sub, day],
    );
    const list = rows.map((r) => new Date(r.at));
    const result = evaluateDay(
      { firstAt: list[0] ?? null, lastAt: list[list.length - 1] ?? null, punchCount: list.length, isToday: true },
      config,
    );
    return {
      status: result.status,
      shift: result.shift?.label ?? null,
      minutes: result.minutes,
      cong: result.cong,
      lateMinutes: result.lateMinutes,
      earlyLeaveMinutes: result.earlyLeaveMinutes,
      punchedInAt: list[0] ? list[0].toISOString() : null,
      punchedOutAt: list.length > 1 ? list[list.length - 1].toISOString() : null,
      fullMinutes: config.fullMinutes,
      halfMinutes: config.halfMinutes,
      /** Giờ máy chủ, để bộ đếm ở trình duyệt không lệch theo đồng hồ máy nhân viên */
      serverNow: new Date().toISOString(),
    };
  }

  /** Bảng chấm công cả tháng cho Admin: từng nhân viên, từng ngày, tổng công */
  async month(month: string) {
    const config = await this.loadConfig();
    const today = vietnamClock().day;
    const [yearStr, monthStr] = month.split('-');
    const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const staff = await this.users.find({
      where: { role: UserRole.STAFF, deletedAt: IsNull() },
      select: { id: true, fullName: true, isActive: true },
      order: { fullName: 'ASC' },
    });

    const punchRows: PunchSummaryRow[] = await this.dataSource.query(
      `SELECT "userId", to_char("day", 'YYYY-MM-DD') AS "day", min("at") AS "firstAt", max("at") AS "lastAt", count(*) AS "n"
         FROM "attendance_punches"
        WHERE "day" >= $1 AND "day" <= $2
        GROUP BY "userId", "day"`,
      [from, to],
    );
    const dayRows: Array<{
      userId: number;
      day: string;
      legacyMinutes: string;
      overrideCong: string | null;
      overrideNote: string | null;
    }> = await this.dataSource.query(
      `SELECT "userId", to_char("day", 'YYYY-MM-DD') AS "day",
              ${LEGACY_MINUTES_SQL} AS "legacyMinutes",
              "overrideCong", "overrideNote"
         FROM "attendance_days"
        WHERE "day" >= $1 AND "day" <= $2`,
      [from, to],
    );

    const key = (userId: number, day: string) => `${userId}|${day}`;
    const punchBy = new Map(punchRows.map((r) => [key(r.userId, r.day), r]));
    const dayBy = new Map(dayRows.map((r) => [key(r.userId, r.day), r]));
    const keys = new Set([...punchBy.keys(), ...dayBy.keys()]);

    const byUser = new Map<number, Record<string, AttendanceDayCell>>();
    for (const k of keys) {
      const [userIdText, day] = k.split('|');
      const userId = Number(userIdText);
      const p = punchBy.get(k);
      const d = dayBy.get(k);

      let result: DayResult;
      if (p) {
        result = evaluateDay(
          { firstAt: new Date(p.firstAt), lastAt: new Date(p.lastAt), punchCount: Number(p.n), isToday: day === today },
          config,
        );
      } else if (d && day < PUNCH_ONLY_FROM && Number(d.legacyMinutes) > 0) {
        const minutes = Number(d.legacyMinutes);
        result = { status: 'done', shift: null, minutes, cong: congFromMinutes(minutes, config), lateMinutes: 0, earlyLeaveMinutes: 0 };
      } else {
        result = evaluateDay({ firstAt: null, lastAt: null, punchCount: 0, isToday: day === today }, config);
      }

      const overridden = d?.overrideCong != null;
      const cells = byUser.get(userId) ?? {};
      cells[day] = {
        minutes: result.minutes,
        autoCong: result.cong,
        cong: overridden ? Number(d!.overrideCong) : result.cong,
        overridden,
        note: d?.overrideNote ?? '',
        status: result.status,
        shift: result.shift?.label ?? null,
        firstAt: p ? new Date(p.firstAt).toISOString() : null,
        lastAt: p && Number(p.n) > 1 ? new Date(p.lastAt).toISOString() : null,
        lateMinutes: result.lateMinutes,
        earlyLeaveMinutes: result.earlyLeaveMinutes,
      };
      byUser.set(userId, cells);
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
}
