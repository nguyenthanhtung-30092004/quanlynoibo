import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tìm kiếm chỉ còn theo số điện thoại / mã đơn: thêm trigram cho "phone", bỏ cột và index tìm kiếm cũ */
export class PhoneTrigramDropSearchText1710000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo index trên bảng lớn có thể lâu hơn giới hạn 10 giây của kết nối thường
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_phone_trgm" ON "orders" USING gin ("phone" gin_trgm_ops);`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_search_text_trgm";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_partner_trgm";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "search_text";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "search_text" text GENERATED ALWAYS AS (lower(coalesce("customerName", '') || ' ' || coalesce("phone", '') || ' ' || coalesce("note", '') || ' ' || coalesce("pickupPoint", '') || ' ' || coalesce("dropoffPoint", '') || ' ' || coalesce("vehicleType", ''))) STORED;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_search_text_trgm" ON "orders" USING gin ("search_text" gin_trgm_ops);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_partner_trgm" ON "orders" USING gin ("partner" gin_trgm_ops);`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_phone_trgm";`);
  }
}
