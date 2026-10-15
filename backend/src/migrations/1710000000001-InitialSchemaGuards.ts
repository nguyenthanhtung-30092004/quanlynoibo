import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchemaGuards1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatFront" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatMiddle" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seatBack" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelReason" varchar(500)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "createdById" integer`);
    await queryRunner.query(`ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "createdById" integer`);
    await queryRunner.query(`ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "commissionPerSeat" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_createdBy_createdAt" ON "orders" ("createdById", "createdAt")`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "order_history" (
      "id" SERIAL PRIMARY KEY,
      "orderId" integer NOT NULL,
      "action" varchar(20) NOT NULL,
      "actorId" integer,
      "actorName" varchar(100) NOT NULL DEFAULT '',
      "summary" varchar(255),
      "changes" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_history_orderId" ON "order_history" ("orderId")`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "app_settings" (
      "key" varchar(50) PRIMARY KEY,
      "value" text NOT NULL DEFAULT '',
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "attendance_days" (
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
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "attendance_logins" (
      "id" serial PRIMARY KEY,
      "userId" integer NOT NULL,
      "day" date NOT NULL,
      "kind" varchar(8) NOT NULL,
      "at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "attendance_logins_day_idx" ON "attendance_logins" ("day", "userId")`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không rollback dữ liệu bảo vệ hệ thống
  }
}
