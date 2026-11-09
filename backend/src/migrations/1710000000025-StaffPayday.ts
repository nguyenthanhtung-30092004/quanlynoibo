import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ngày nhận lương chuyển từ "đánh dấu theo từng ngày" sang "mỗi nhân viên một ngày cố định trong tháng".
 * Bảng leave_paydays cũ chưa dùng thật nên bỏ luôn.
 */
export class StaffPayday1710000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_paydays";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_paydays" (
        "userId" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "dayOfMonth" integer NOT NULL CHECK ("dayOfMonth" BETWEEN 1 AND 31)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_paydays";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_paydays" (
        "day" varchar(10) PRIMARY KEY,
        "note" varchar(100) NOT NULL DEFAULT ''
      );
    `);
  }
}
