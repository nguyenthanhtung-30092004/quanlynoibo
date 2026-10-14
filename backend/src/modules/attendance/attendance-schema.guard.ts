import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Production chạy DATABASE_SYNCHRONIZE=false nên bảng chấm công phải tự tạo khi khởi động
 * (idempotent, không đụng dữ liệu cũ). Mỗi nhân viên một dòng mỗi ngày:
 * `bits` là chuỗi 1440 ký tự '0'/'1', ký tự thứ n = phút thứ n trong ngày có thao tác tại công ty.
 * Gộp theo phút nên mở nhiều tab cũng không đếm trùng, và gửi dồn cũng không nhanh hơn giờ thật.
 */
@Injectable()
export class AttendanceSchemaGuard implements OnModuleInit {
  private readonly logger = new Logger(AttendanceSchemaGuard.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.dataSource.query(`CREATE TABLE IF NOT EXISTS "attendance_days" (
        "userId" integer NOT NULL,
        "day" date NOT NULL,
        "bits" text NOT NULL DEFAULT repeat('0', 1440),
        "firstAt" timestamptz,
        "lastAt" timestamptz,
        "lastDistanceM" integer,
        "overrideCong" numeric(3,1),
        "overrideNote" varchar(200),
        "overrideBy" integer,
        PRIMARY KEY ("userId", "day")
      )`);
      // Nhật ký đăng nhập / đăng xuất: mỗi lần là một dòng, để Admin xem lịch sử vào ra trong ngày của từng người
      await this.dataSource.query(`CREATE TABLE IF NOT EXISTS "attendance_logins" (
        "id" serial PRIMARY KEY,
        "userId" integer NOT NULL,
        "day" date NOT NULL,
        "kind" varchar(8) NOT NULL,
        "at" timestamptz NOT NULL DEFAULT now()
      )`);
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS "attendance_logins_day_idx" ON "attendance_logins" ("day", "userId")`,
      );
    } catch (err) {
      this.logger.error(`Không tạo được bảng attendance_days: ${(err as Error).message}`);
    }
  }
}
