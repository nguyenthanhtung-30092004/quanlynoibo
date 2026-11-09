import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ngày nhận lương hiển thị trên lịch đăng ký nghỉ: mỗi ngày một dòng, kèm chú thích */
export class LeavePayday1710000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_paydays" (
        "day" varchar(10) PRIMARY KEY,
        "note" varchar(100) NOT NULL DEFAULT ''
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "leave_paydays";`);
  }
}
