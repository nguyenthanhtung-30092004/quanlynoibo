import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import {
  AUTO_CLOSE_MINUTE,
  DEFAULT_ATTENDANCE_CONFIG,
  PUNCH_COOLDOWN_SECONDS,
  decidePunch,
  SHIFTS,
  congFromMinutes,
  evaluateDay,
  sanitizeAttendanceConfig,
  vietnamClock,
  type AttendanceConfig,
  type DayResult,
  type DayStatus,
  type ShiftSource,
} from './attendance.logic.js';
import { directionByOrder, directionFromStatus, type HikvisionPunch } from './hikvision-event.js';
import {
  DEFAULT_PAYROLL_CONFIG,
  sanitizeConfig as sanitizePayrollConfig,
  type PayrollConfig,
} from '../payroll/payroll.config.js';

export type PunchResult = 'recorded' | 'duplicate' | 'after_out' | 'unknown_employee' | 'not_counted';

const CONFIG_KEY = 'attendance_config';
/** Khóa cấu hình lương, do module Bảng lương ghi; ở đây chỉ đọc */
const PAYROLL_CONFIG_KEY = 'payroll_config';
/** Ca mặc định của từng nhân viên: { "<userId>": giờ bắt đầu ca (phút trong ngày) } */
const DEFAULT_SHIFT_KEY = 'attendance_shift_default';
/** Ca Admin chọn tay cho từng ngày của một tháng: { "<userId>|<YYYY-MM-DD>": giờ bắt đầu ca } */
const shiftOverrideKey = (month: string) => `attendance_shift_override_${month}`;

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
  /** Ở lại sau giờ kết thúc ca bao nhiêu phút */
  overtimeMinutes: number;
  /** Số giờ tăng ca được tính (mốc 0,5 giờ, tối đa 3 giờ) */
  overtimeHours: number;
  /** Giờ bắt đầu ca (phút trong ngày) đang áp dụng; null nếu chưa có ca */
  shiftStart: number | null;
  shiftSource: ShiftSource | null;
  /** Cách hiểu ca khác cho số giờ tăng ca khác, cần Admin xem lại; null nếu không mập mờ */
  alternative: { shiftStart: number; shift: string; overtimeHours: number } | null;
}

/** Admin xem được mọi nhân viên; người khác chỉ xem được chính mình (không lộ công của đồng nghiệp) */
const onlyOwn = (viewer: JwtPayload) => (viewer.role === UserRole.ADMIN ? {} : { id: viewer.sub });

interface PunchSummaryRow {
  userId: number;
  day: string;
  firstAt: Date;
  lastAt: Date;
  /** Số lượt quẹt thật (không tính lượt hệ thống tự chấm ra) */
  n: string;
  autoClosed: boolean;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Optional() private readonly realtime?: RealtimeService,
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

  /** Cấu hình lương (mức trừ vào muộn, mức tăng ca...) để bảng xuất Excel tính ra tiền; chỉ đọc, không đổi */
  async loadPayrollConfig(): Promise<PayrollConfig> {
    const row = await this.settings.findOne({ where: { key: PAYROLL_CONFIG_KEY } });
    if (!row?.value) return DEFAULT_PAYROLL_CONFIG;
    try {
      return sanitizePayrollConfig(JSON.parse(row.value));
    } catch {
      return DEFAULT_PAYROLL_CONFIG;
    }
  }

  async saveConfig(input: Record<string, unknown>): Promise<AttendanceConfig> {
    const config = sanitizeAttendanceConfig(input);
    await this.settings.save(this.settings.create({ key: CONFIG_KEY, value: JSON.stringify(config) }));
    this.cachedConfig = { data: config, expiresAt: Date.now() + this.CONFIG_TTL_MS };
    return config;
  }

  private async loadShiftMap(key: string): Promise<Record<string, number>> {
    const row = await this.settings.findOne({ where: { key } });
    if (!row?.value) return {};
    try {
      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      const map: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && SHIFTS.some((sh) => sh.startMinute === v)) map[k] = v;
      }
      return map;
    } catch {
      return {};
    }
  }

  private async saveShiftMap(key: string, map: Record<string, number>) {
    await this.settings.save(this.settings.create({ key, value: JSON.stringify(map) }));
  }

  private assertShift(startMinute: number | null) {
    if (startMinute !== null && !SHIFTS.some((sh) => sh.startMinute === startMinute)) {
      throw new BadRequestException('Ca làm việc không hợp lệ.');
    }
  }

  /** Admin chọn lại ca cho một ngày của nhân viên (null = bỏ chọn, quay về tự đoán / ca mặc định) */
  async setShiftOverride(userId: number, day: string, startMinute: number | null) {
    this.assertShift(startMinute);
    const key = shiftOverrideKey(day.slice(0, 7));
    const map = await this.loadShiftMap(key);
    const field = `${userId}|${day}`;
    if (startMinute === null) delete map[field];
    else map[field] = startMinute;
    await this.saveShiftMap(key, map);
    return { ok: true };
  }

  /** Ca mặc định của một nhân viên (null = bỏ, quay về tự đoán) */
  async setDefaultShift(userId: number, startMinute: number | null) {
    this.assertShift(startMinute);
    const map = await this.loadShiftMap(DEFAULT_SHIFT_KEY);
    if (startMinute === null) delete map[String(userId)];
    else map[String(userId)] = startMinute;
    await this.saveShiftMap(DEFAULT_SHIFT_KEY, map);
    return { ok: true };
  }

  /**
   * Ghi một lượt quẹt từ máy chấm công Hikvision. Giờ lấy theo giờ của máy (máy gửi lại khi mất mạng vẫn đúng giờ).
   * Quẹt lại trong vòng PUNCH_COOLDOWN_SECONDS của một lượt đã ghi thì bỏ qua, nên quẹt liền hai lần chỉ tính lượt vào.
   * Mỗi ngày chỉ ghi tối đa MAX_PUNCHES_PER_DAY lượt (vào, ra): đã chấm ra rồi thì quẹt thêm không tính, hôm sau mới tính lại.
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

    const counts: Array<{ nearby: string; today: string }> = await this.dataSource.query(
      `SELECT
         (SELECT count(*) FROM "attendance_punches"
           WHERE "userId" = $1 AND NOT "auto"
             AND "at" BETWEEN $2::timestamptz - make_interval(secs => $3::int) AND $2::timestamptz + make_interval(secs => $3::int)) AS "nearby",
         (SELECT count(*) FROM "attendance_punches"
           WHERE "userId" = $1 AND NOT "auto" AND "day" = $4::date) AS "today"`,
      [user.id, punch.at, PUNCH_COOLDOWN_SECONDS, day],
    );
    const decision = decidePunch(Number(counts[0].today), Number(counts[0].nearby));
    if (decision !== 'recorded') return decision;

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
   * Hết ngày lúc 23:59 (giờ VN): ai mới có một lượt quẹt (quên quẹt ra) thì hệ thống tự ghi một lượt "ra" lúc 23:59
   * và đánh dấu `auto`; ngày đó không tính công. Cũng dọn luôn các ngày đã qua còn sót (vd máy chủ tắt lúc 23:59).
   * Chạy lại nhiều lần vẫn an toàn: mỗi người mỗi ngày chỉ bị tự chấm ra một lần. Trả về số người vừa bị tự chấm ra.
   */
  async autoCloseOpenDays(now: { day: string; minuteOfDay: number } = vietnamClock()): Promise<number> {
    const rows: Array<{ userId: number }> = await this.dataSource.query(
      `INSERT INTO "attendance_punches" ("userId", "day", "at", "kind", "auto")
       SELECT p."userId", p."day", (p."day"::text || ' 23:59:00+07')::timestamptz, 'out', true
         FROM "attendance_punches" p
        WHERE NOT p."auto"
          AND (p."day" < $1::date OR ($2::boolean AND p."day" = $1::date))
          AND NOT EXISTS (
            SELECT 1 FROM "attendance_punches" a WHERE a."userId" = p."userId" AND a."day" = p."day" AND a."auto"
          )
        GROUP BY p."userId", p."day"
       HAVING count(*) = 1
       ON CONFLICT ("userId", "at") DO NOTHING
       RETURNING "userId"`,
      [now.day, now.minuteOfDay >= AUTO_CLOSE_MINUTE],
    );
    if (rows.length > 0) this.realtime?.emit({ topic: 'attendance', actorId: null });
    return rows.length;
  }

  /**
   * Tình hình từng nhân viên trong một ngày (mặc định hôm nay): đã quẹt vào lúc nào, đã quẹt ra chưa,
   * ca nào, đi muộn / về sớm bao nhiêu phút và công tạm tính. Người chưa quẹt vẫn có mặt trong danh sách.
   */
  async dayLog(day: string | undefined, viewer: JwtPayload) {
    const config = await this.loadConfig();
    const today = vietnamClock().day;
    const target = day ?? today;

    const staff = await this.users.find({
      where: { role: UserRole.STAFF, deletedAt: IsNull(), isActive: true, ...onlyOwn(viewer) },
      select: { id: true, fullName: true },
      order: { fullName: 'ASC' },
    });

    const punchRows: Array<{ userId: number; at: Date; auto: boolean }> = await this.dataSource.query(
      `SELECT "userId", "at", "auto" FROM "attendance_punches" WHERE "day" = $1 ORDER BY "at" ASC`,
      [target],
    );
    // Lượt hệ thống tự chấm ra lúc 23:59 không phải lượt quẹt thật: chỉ dùng để biết người đó đã bị tự chấm ra
    const autoClosedBy = new Set(punchRows.filter((p) => p.auto).map((p) => p.userId));
    const punches = punchRows.filter((p) => !p.auto);
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
    const [defaultShifts, shiftOverrides] = await Promise.all([
      this.loadShiftMap(DEFAULT_SHIFT_KEY),
      this.loadShiftMap(shiftOverrideKey(target.slice(0, 7))),
    ]);

    return {
      day: target,
      shifts: SHIFTS.map((sh) => ({ startMinute: sh.startMinute, label: sh.label })),
      staff: staff.map((u) => {
        const list = punchesBy.get(u.id) ?? [];
        const result = evaluateDay(
          {
            firstAt: list[0] ?? null,
            lastAt: list[list.length - 1] ?? null,
            punchCount: list.length,
            isToday: target === today,
            autoClosed: autoClosedBy.has(u.id),
            forcedShiftStart: shiftOverrides[`${u.id}|${target}`],
            defaultShiftStart: defaultShifts[String(u.id)],
          },
          config,
        );
        const override = overrideBy.get(u.id);
        return {
          userId: u.id,
          fullName: u.fullName,
          status: result.status,
          shift: result.shift?.label ?? null,
          shiftStart: result.shift?.startMinute ?? null,
          shiftSource: result.shiftSource,
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
    const rows: Array<{ at: Date; auto: boolean }> = await this.dataSource.query(
      `SELECT "at", "auto" FROM "attendance_punches" WHERE "userId" = $1 AND "day" = $2 ORDER BY "at" ASC`,
      [actor.sub, day],
    );
    const list = rows.filter((r) => !r.auto).map((r) => new Date(r.at));
    const [defaultShifts, shiftOverrides] = await Promise.all([
      this.loadShiftMap(DEFAULT_SHIFT_KEY),
      this.loadShiftMap(shiftOverrideKey(day.slice(0, 7))),
    ]);
    const result = evaluateDay(
      {
        firstAt: list[0] ?? null,
        lastAt: list[list.length - 1] ?? null,
        punchCount: list.length,
        isToday: true,
        autoClosed: rows.some((r) => r.auto),
        forcedShiftStart: shiftOverrides[`${actor.sub}|${day}`],
        defaultShiftStart: defaultShifts[String(actor.sub)],
      },
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
  async month(month: string, viewer: JwtPayload) {
    const config = await this.loadConfig();
    const today = vietnamClock().day;
    const [yearStr, monthStr] = month.split('-');
    const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const staff = await this.users.find({
      where: { role: UserRole.STAFF, deletedAt: IsNull(), ...onlyOwn(viewer) },
      select: { id: true, fullName: true, isActive: true },
      order: { fullName: 'ASC' },
    });

    const punchRows: PunchSummaryRow[] = await this.dataSource.query(
      `SELECT "userId", to_char("day", 'YYYY-MM-DD') AS "day",
              min("at") FILTER (WHERE NOT "auto") AS "firstAt",
              max("at") FILTER (WHERE NOT "auto") AS "lastAt",
              count(*) FILTER (WHERE NOT "auto") AS "n",
              bool_or("auto") AS "autoClosed"
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

    const [defaultShifts, shiftOverrides] = await Promise.all([
      this.loadShiftMap(DEFAULT_SHIFT_KEY),
      this.loadShiftMap(shiftOverrideKey(month)),
    ]);

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
      if (p && Number(p.n) > 0) {
        result = evaluateDay(
          {
            firstAt: new Date(p.firstAt),
            lastAt: new Date(p.lastAt),
            punchCount: Number(p.n),
            isToday: day === today,
            autoClosed: p.autoClosed,
            forcedShiftStart: shiftOverrides[k],
            defaultShiftStart: defaultShifts[String(userId)],
          },
          config,
        );
      } else if (d && day < PUNCH_ONLY_FROM && Number(d.legacyMinutes) > 0) {
        const minutes = Number(d.legacyMinutes);
        result = {
          status: 'done',
          shift: null,
          minutes,
          cong: congFromMinutes(minutes, config),
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          overtimeHours: 0,
          shiftSource: null,
          alternative: null,
        };
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
        overtimeMinutes: result.overtimeMinutes,
        overtimeHours: result.overtimeHours,
        shiftStart: result.shift?.startMinute ?? null,
        shiftSource: result.shiftSource,
        alternative: result.alternative
          ? {
              shiftStart: result.alternative.shift.startMinute,
              shift: result.alternative.shift.label,
              overtimeHours: result.alternative.overtimeHours,
            }
          : null,
      };
      byUser.set(userId, cells);
    }

    return {
      month,
      daysInMonth,
      config,
      shifts: SHIFTS.map((sh) => ({ startMinute: sh.startMinute, label: sh.label })),
      staff: staff.map((u) => {
        const days = byUser.get(u.id) ?? {};
        const totalCong = Object.values(days).reduce((sum, d) => sum + d.cong, 0);
        const totalOvertimeHours = Object.values(days).reduce((sum, d) => sum + d.overtimeHours, 0);
        return {
          id: u.id,
          fullName: u.fullName,
          isActive: u.isActive,
          defaultShift: defaultShifts[String(u.id)] ?? null,
          days,
          totalCong,
          totalOvertimeHours,
        };
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
