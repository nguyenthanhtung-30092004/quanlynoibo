import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Dự án chưa có migration và production chạy DATABASE_SYNCHRONIZE=false, nên cột
 * mới thêm vào bảng orders sẽ không tự có -> mọi truy vấn đơn hàng lỗi 500.
 * Mỗi lần khởi động, bổ sung các cột còn thiếu (idempotent, không đụng dữ liệu cũ).
 */
@Injectable()
export class OrdersSchemaGuard implements OnModuleInit {
  private readonly logger = new Logger(OrdersSchemaGuard.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    const statements = [
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatFront" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatMiddle" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatBack" integer NOT NULL DEFAULT 0`,
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz`,
      `CREATE INDEX IF NOT EXISTS "IDX_orders_createdBy_createdAt" ON "orders" ("createdById", "createdAt")`,
      `CREATE TABLE IF NOT EXISTS "order_history" (
        "id" SERIAL PRIMARY KEY,
        "orderId" integer NOT NULL,
        "action" varchar(20) NOT NULL,
        "actorId" integer,
        "actorName" varchar(100) NOT NULL DEFAULT '',
        "summary" varchar(255),
        "changes" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS "IDX_order_history_orderId" ON "order_history" ("orderId")`,
    ];
    try {
      for (const sql of statements) await this.dataSource.query(sql);
    } catch (err) {
      this.logger.error(`Không bổ sung được cột còn thiếu cho bảng orders: ${(err as Error).message}`);
    }
  }
}
