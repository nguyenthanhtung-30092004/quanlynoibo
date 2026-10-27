import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity.js';
import { AppSetting } from '../settings/entities/app-setting.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import {
  DEFAULT_PAYROLL_CONFIG,
  EMPTY_PAYROLL_ENTRY,
  sanitizeConfig,
  sanitizeEntry,
  type PayrollConfig,
  type PayrollEntry,
} from './payroll.config.js';

const CONFIG_KEY = 'payroll_config';
const entriesKey = (month: string) => `payroll_${month}`;

export interface PayrollDay {
  commission: number;
  tickets: number;
}

/**
 * Bảng lương: server chỉ gom hoa hồng theo ngày của từng nhân viên và lưu công thức / phần nhập tay
 * (vào bảng cài đặt có sẵn nên production không cần tạo bảng mới).
 * Phép tính lương nằm ở giao diện để Admin sửa công thức hoặc số công là thấy kết quả ngay.
 */
@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  /**
   * Lương của chính nhân viên đang đăng nhập (chỉ xem). Chỉ trả đúng một người; bảng bậc lương cũng chỉ
   * giữ bậc của người đó để nhân viên không thấy mức lương cứng của bậc khác.
   */
  async getMine(month: string, userId: number) {
    const data = await this.get(month, userId);
    const me = data.staff[0];
    if (!me) return { ...data, staff: [] };
    const level = Math.min(me.entry.level, data.config.levels.length - 1);
    return {
      ...data,
      config: { ...data.config, levels: [data.config.levels[level]] },
      staff: [{ ...me, entry: { ...me.entry, level: 0 } }],
    };
  }

  async get(month: string, onlyUserId?: number) {
    const config = await this.loadConfig();
    const entries = await this.loadEntries(month, config);
    const [yearStr, monthStr] = month.split('-');
    const daysInMonth = new Date(Date.UTC(Number(yearStr), Number(monthStr), 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const staff = await this.users.find({
      where: {
        role: UserRole.STAFF,
        deletedAt: IsNull(),
        ...(onlyUserId !== undefined ? { id: onlyUserId } : {}),
      },
      select: { id: true, fullName: true, isActive: true },
      order: { fullName: 'ASC' },
    });

    // Hoa hồng từng ngày (theo ngày vào sổ / ngày tạo vé, không lấy theo ngày khởi hành); vé đã hủy không tính
    const effectiveDayExpr = `to_char(COALESCE("order"."entryDate", CAST("order"."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)), 'YYYY-MM-DD')`;
    const rows = await this.orders
      .createQueryBuilder('order')
      .select('"order"."createdById"', 'staffId')
      .addSelect(effectiveDayExpr, 'day')
      .addSelect('COALESCE(SUM("order"."commission"), 0)', 'commission')
      .addSelect('COUNT(*)', 'tickets')
      .where(
        `COALESCE("order"."entryDate", CAST("order"."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)) >= :from AND COALESCE("order"."entryDate", CAST("order"."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh' AS date)) <= :to`,
        { from, to },
      )
      .andWhere('"order"."cancelledAt" IS NULL')
      .andWhere(onlyUserId !== undefined ? '"order"."createdById" = :onlyUserId' : '1=1', { onlyUserId })
      .groupBy('"order"."createdById"')
      .addGroupBy(effectiveDayExpr)
      .getRawMany<{ staffId: number; day: string; commission: string; tickets: string }>();

    const dailyByStaff = new Map<number, Record<string, PayrollDay>>();
    for (const r of rows) {
      const id = Number(r.staffId);
      const days = dailyByStaff.get(id) ?? {};
      days[r.day] = { commission: Number(r.commission), tickets: Number(r.tickets) };
      dailyByStaff.set(id, days);
    }

    const staffList = staff.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      isActive: u.isActive,
      entry: entries[String(u.id)] ?? { ...EMPTY_PAYROLL_ENTRY },
      daily: dailyByStaff.get(u.id) ?? {},
    }));
    staffList.sort((a, b) => {
      const levelA = a.entry?.level ?? 0;
      const levelB = b.entry?.level ?? 0;
      if (levelB !== levelA) {
        return levelB - levelA;
      }
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    return {
      month,
      daysInMonth,
      config,
      staff: staffList,
    };
  }

  async save(month: string, config?: Record<string, unknown>, entries?: Record<string, unknown>) {
    const nextConfig = config ? sanitizeConfig(config) : await this.loadConfig();
    if (config) {
      await this.settings.save(
        this.settings.create({ key: CONFIG_KEY, value: JSON.stringify(nextConfig) }),
      );
    }
    if (entries) {
      const clean: Record<string, PayrollEntry> = {};
      for (const [userId, value] of Object.entries(entries)) {
        if (!/^\d+$/.test(userId)) continue;
        const entry = sanitizeEntry(value, nextConfig.levels.length);
        // Chốt bảo hiểm của tháng này: nhân viên chưa có số riêng thì ghi luôn mức mặc định lúc lưu,
        // để sau này đổi mức mặc định (tháng sau) không kéo theo các tháng đã lưu
        clean[userId] = { ...entry, insurance: entry.insurance ?? nextConfig.insuranceDefault };
      }
      await this.settings.save(
        this.settings.create({ key: entriesKey(month), value: JSON.stringify(clean) }),
      );
    }
    return this.get(month);
  }

  private async loadConfig(): Promise<PayrollConfig> {
    const row = await this.settings.findOne({ where: { key: CONFIG_KEY } });
    if (!row?.value) return DEFAULT_PAYROLL_CONFIG;
    try {
      return sanitizeConfig(JSON.parse(row.value));
    } catch {
      return DEFAULT_PAYROLL_CONFIG;
    }
  }

  private async loadEntries(month: string, config: PayrollConfig): Promise<Record<string, PayrollEntry>> {
    const row = await this.settings.findOne({ where: { key: entriesKey(month) } });
    if (!row?.value) return {};
    try {
      const parsed = JSON.parse(row.value) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([id, e]) => [id, sanitizeEntry(e, config.levels.length)]),
      );
    } catch {
      return {};
    }
  }
}
