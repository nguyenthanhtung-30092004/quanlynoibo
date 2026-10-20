import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đơn giao hàng + hoa hồng giao hàng riêng cho đối tác (theo % cước hoặc mức cố định mỗi đơn) */
export class Deliveries1710000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "deliveryCommissionPercent" double precision NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "deliveryCommissionPerOrder" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deliveries" (
        "id" SERIAL PRIMARY KEY,
        "entryDate" date NOT NULL,
        "createdById" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "shipDate" date NOT NULL,
        "shipTime" varchar(5) NOT NULL,
        "senderName" varchar(100),
        "senderPhone" varchar(30) NOT NULL,
        "senderAddress" varchar(255),
        "receiverName" varchar(100),
        "receiverPhone" varchar(30) NOT NULL,
        "receiverAddress" varchar(255) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "goodsType" varchar(255),
        "weightKg" double precision NOT NULL DEFAULT 0,
        "payer" varchar(10) NOT NULL DEFAULT 'SENDER',
        "fee" integer NOT NULL DEFAULT 0,
        "commission" integer NOT NULL DEFAULT 0,
        "partner" varchar(100),
        "note" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deliveries_shipDate" ON "deliveries" ("shipDate")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_deliveries_createdAt" ON "deliveries" ("createdAt", "id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deliveries"`);
    await queryRunner.query(`ALTER TABLE "partners" DROP COLUMN IF EXISTS "deliveryCommissionPerOrder"`);
    await queryRunner.query(`ALTER TABLE "partners" DROP COLUMN IF EXISTS "deliveryCommissionPercent"`);
  }
}
