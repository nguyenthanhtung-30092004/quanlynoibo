import { MigrationInterface, QueryRunner } from 'typeorm';

/** Chấm công bằng máy Hikvision: mã nhân viên trên máy + nhật ký từng lượt quẹt (vào / ra) */
export class HikvisionPunches1710000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deviceEmployeeNo" varchar(32)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_device_employee_no_uq" ON "users" ("deviceEmployeeNo") WHERE "deviceEmployeeNo" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "attendance_punches" (
      "id" serial PRIMARY KEY,
      "userId" integer NOT NULL,
      "day" date NOT NULL,
      "at" timestamptz NOT NULL,
      "kind" varchar(3) NOT NULL,
      UNIQUE ("userId", "at")
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "attendance_punches_day_idx" ON "attendance_punches" ("day", "userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "attendance_punches"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "users_device_employee_no_uq"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deviceEmployeeNo"`);
  }
}
