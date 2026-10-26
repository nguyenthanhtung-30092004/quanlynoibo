import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phân loại khách quen / khách lạ theo số điện thoại: cột "phone" nhập tự do (0912…, +84912…, 0084912…)
 * nên thêm cột sinh sẵn "phoneKey" chỉ giữ chữ số và quy đầu số 84 / 0084 về 0, để cùng một người thì cùng một khóa.
 */
export class OrderPhoneKey1710000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm cột sinh sẵn trên bảng lớn phải ghi lại cả bảng nên có thể lâu hơn giới hạn 10 giây của kết nối thường
    await queryRunner.query(`SET LOCAL statement_timeout = 0`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION normalize_phone(p text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
        SELECT CASE
          WHEN d LIKE '0084%' THEN '0' || substr(d, 5)
          WHEN d LIKE '84%' AND length(d) >= 11 THEN '0' || substr(d, 3)
          ELSE d
        END
        FROM (SELECT regexp_replace(coalesce(p, ''), '\\D', '', 'g') AS d) x
      $$;
    `);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "phoneKey" text GENERATED ALWAYS AS (normalize_phone("phone")) STORED;`);
    // Chỉ đơn còn hiệu lực mới tính vào số chuyến của khách
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_phoneKey_active" ON "orders" ("phoneKey") WHERE "cancelledAt" IS NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_phoneKey_active";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "phoneKey";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS normalize_phone(text);`);
  }
}
