import { MigrationInterface, QueryRunner } from 'typeorm';

/** Đánh dấu lượt "ra" do hệ thống tự chấm lúc 23:59 cho người quên quẹt ra (không tính công) */
export class AttendancePunchAuto1710000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_punches" ADD COLUMN IF NOT EXISTS "auto" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance_punches" DROP COLUMN IF EXISTS "auto"`);
  }
}
