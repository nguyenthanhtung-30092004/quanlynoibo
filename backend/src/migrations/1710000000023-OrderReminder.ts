import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nhắc khách qua Zalo trước giờ khởi hành 1 tiếng: đánh dấu đơn đã được nhắc (hoặc đã thử nhắc) để không gửi lặp.
 * Thêm cột không có giá trị mặc định nên chạy tức thì, không ghi lại cả bảng.
 */
export class OrderReminder1710000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminderSentAt" timestamptz;`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reminderError" varchar(255);`);
    // Bộ quét chỉ cần tìm đơn còn hiệu lực, chưa nhắc, theo ngày khởi hành
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_reminder_pending" ON "orders" ("departureDate") WHERE "reminderSentAt" IS NULL AND "cancelledAt" IS NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_reminder_pending";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "reminderError";`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "reminderSentAt";`);
  }
}
