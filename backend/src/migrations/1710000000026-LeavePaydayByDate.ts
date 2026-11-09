import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ngày nhận lương quay về dạng "Admin đánh dấu một ngày cụ thể, áp dụng chung cho mọi người",
 * bỏ cấu hình theo từng nhân viên (staff_paydays).
 */
export class LeavePaydayByDate1710000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_paydays";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_paydays";`);
    await queryRunner.query(`CREATE TABLE "leave_paydays" ("day" varchar(10) PRIMARY KEY);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_paydays";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_paydays" (
        "userId" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
        "dayOfMonth" integer NOT NULL CHECK ("dayOfMonth" BETWEEN 1 AND 31)
      );
    `);
  }
}
