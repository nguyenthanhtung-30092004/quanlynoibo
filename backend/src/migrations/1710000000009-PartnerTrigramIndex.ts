import { MigrationInterface, QueryRunner } from 'typeorm';

/** Index trigram cho "partner" để tìm kiếm ILIKE '%...%' theo đối tác không phải quét toàn bảng */
export class PartnerTrigramIndex1710000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo index trên bảng lớn có thể lâu hơn giới hạn 10 giây của kết nối thường
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_partner_trgm" ON "orders" USING gin ("partner" gin_trgm_ops);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_partner_trgm";`);
  }
}
