import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexesAndNormalizedColumns1710000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_createdAt_id_desc" ON "orders" ("createdAt" DESC, "id" DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_createdById_createdAt_id_desc" ON "orders" ("createdById", "createdAt" DESC, "id" DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_entryDate_createdById_active" ON "orders" ("entryDate", "createdById") WHERE "cancelledAt" IS NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_departureDate_active" ON "orders" ("departureDate") WHERE "cancelledAt" IS NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_routeId_entryDate" ON "orders" ("routeId", "entryDate");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_messageRefId" ON "orders" ("messageRefId") WHERE "messageRefId" IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_phone" ON "orders" ("phone");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_history_orderId_createdAt_desc" ON "order_history" ("orderId", "createdAt" DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_history_createdAt_desc" ON "order_history" ("createdAt" DESC);`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "partnerKey" text GENERATED ALWAYS AS (lower(trim(coalesce("partner", 'XVIP')))) STORED;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_partnerKey" ON "orders" ("partnerKey");`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerKey" text GENERATED ALWAYS AS (lower(trim(coalesce("customerName", 'khách lẻ')))) STORED;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_customerKey" ON "orders" ("customerKey");`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "search_text" text GENERATED ALWAYS AS (lower(coalesce("customerName", '') || ' ' || coalesce("phone", '') || ' ' || coalesce("note", '') || ' ' || coalesce("pickupPoint", '') || ' ' || coalesce("dropoffPoint", '') || ' ' || coalesce("vehicleType", ''))) STORED;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_search_text_trgm" ON "orders" USING gin ("search_text" gin_trgm_ops);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_search_text_trgm";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_customerKey";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_partnerKey";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_history_createdAt_desc";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_history_orderId_createdAt_desc";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_phone";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_messageRefId";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_routeId_entryDate";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_departureDate_active";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_entryDate_createdById_active";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_createdById_createdAt_id_desc";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_createdAt_id_desc";`);
  }
}
